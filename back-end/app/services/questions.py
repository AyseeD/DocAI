"""Document-scoped retrieval, caching, and SSE answers."""
import hashlib
import json
import logging
import re
import time
from uuid import uuid4
from psycopg.types.json import Jsonb
from app.api.ai import PIPELINE, MODE, MODEL, ANSWER_VERSION, REFUSAL, embed, generate
from app.db.db import connect, vector_literal
from app.services.documents import require_ready_document

#return the value as a string (hexadecimal digested digits)
def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

#give the event name and data
def event(name, value):
    return f"event: {name}\ndata: {json.dumps(value, ensure_ascii=False, default=str)}\n\n"

#serialization / formatting helper, returns a plain dict
def public_source(row, label):
    return {"label": label, "chunk_id": str(row["id"]), "doc_id": str(row["doc_id"]),
            "name": row["name"], "page_number": row["page_number"],
            "section": row["section"], "content": row["content"]}

#given the question it either returns a cached answer and its answer chunks (fast),
#performs a vector similarity search to fetch the top 5 relevant chunks and returns them for downstream answer generation
def prepare(question, document_id):
    # Exact-question cache (whitespace normalized, case preserved).
    key = digest(json.dumps([str(document_id), question, ANSWER_VERSION, PIPELINE]))
    with connect() as db:
        db.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        doc = require_ready_document(document_id, db=db)
        version = digest(json.dumps(
            [str(doc["id"]), doc["content_hash"], str(doc["processed_at"]), PIPELINE]
        ))
        cached = db.execute(
            "SELECT * FROM answer_cache WHERE question_key=%s AND doc_set_ver=%s AND document_id=%s",
            (key, version, document_id),
        ).fetchone()
        if cached:
            rows = db.execute(
                """SELECT c.*,d.name FROM answer_cache_chunks ac
                    JOIN chunks c ON c.id=ac.chunk_id JOIN documents d ON d.id=c.doc_id
                    WHERE ac.cache_id=%s AND c.doc_id=%s ORDER BY ac.source_order""", (cached["id"], document_id)
            ).fetchall()
            return key, version, cached["answer"], rows 
        vector = vector_literal(embed(question, query=True))
        rows = db.execute(
            """SELECT c.*,d.name FROM chunks c JOIN documents d ON d.id=c.doc_id
                WHERE d.id=%s AND d.status='ready' AND d.pipeline_version=%s
                ORDER BY c.embedding <=> %s::vector, c.id LIMIT 5""", (document_id, PIPELINE, vector)
        ).fetchall()
    return key, version, None, rows 

#save an answer as cached for the faster answering
def save_answer(key, version, answer, sources, document_id):
    if any(str(source["doc_id"]) != str(document_id) for source in sources):
        raise ValueError("Cannot cache sources from another document")
    with connect() as db:
        inserted = db.execute(
            """INSERT INTO answer_cache(id,question_key,doc_set_ver,answer,document_id)
                VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id""",
            (uuid4(), key, version, answer, document_id)
        ).fetchone()
        if inserted:
            for order, source in enumerate(sources):
                db.execute(
                    "INSERT INTO answer_cache_chunks VALUES (%s,%s,%s)",
                    (inserted["id"], source["id"], order,)
                )

#A generator for streaming Rag endpoint. (chain of events)
# Retrieves needed chunks via prepare, emit them as sources, stream them token by token, validate citations, cache new answers, log the whole query
def stream_answer(question, document_id):
    start = time.monotonic()
    usage, cached, outcome = {}, None, "cancelled"
    generation_called= False
    try:
        key, version, cached, rows = prepare(question, document_id)
        sources = [public_source(row, i) for i, row in enumerate(rows, 1)]
        yield event("sources", {"sources": sources, "cache_hit": cached is not None})
        
        if cached is not None:
            answer = cached
            yield event("delta", {"text": answer})
        elif not rows:
            answer = REFUSAL
            yield event("delta", {"text": answer})
        else:
            generation_called = MODE != "mock"
            parts = []
            for text in generate(question, rows, usage):
                parts.append(text)
                yield event("delta", {"text": text})
            answer= "".join(parts).strip()

        labels = sorted(set(int(n) for n in re.findall(r"\[(\d+)\]", answer)))

        if answer != REFUSAL and (
            not answer or not labels or any(n < 1 or n > len(rows) for n in labels)):
            raise ValueError("Answer missing valid citations")
        
        if cached is None and rows:
            save_answer(key, version, answer, rows, document_id)
        
        outcome= "ok"

        yield event("done", {
            "answer": answer, "cited_labels": labels, "cache_hit": cached is not None,
            "generation_token_usage": usage or (None if generation_called else {"total_token_count": 0}),
            "latency_ms": round((time.monotonic() - start) * 1000), "ai_mode": MODE, "document_id": str(document_id),
        })
    except Exception:
        outcome = "error"
        logging.exception("Question failed")
        yield event("error", {"message": "Answer failed. Discard partial text and retry."})
    finally:
        try:
            with connect() as db:
                db.execute(
                    """INSERT INTO query_logs
                        (id,question,model,token_usage,latency,cache_hit,outcome,document_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (uuid4(), question, "mock" if MODE == "mock" else MODEL,
                         Jsonb({"generation": usage or (None if generation_called else {"total_token_count": 0}),
                            "generation_called": generation_called,
                            "embedding_tokens": None}),
                            round((time.monotonic() - start) * 1000), cached is not None, outcome, document_id,
                        )
                )
        except Exception:
            logging.exception("Could not persist query log")
