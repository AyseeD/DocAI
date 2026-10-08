from pydantic import BaseModel, Field
import logging
import json
import time
import re
import hashlib
from uuid import uuid4
from pypdf import PdfReader
from psycopg.types.json import Jsonb
from app.api.ai import PIPELINE, MODE,MODEL,ANSWER_VERSION, REFUSAL, embed, generate
from app.db.db import UPLOADS, connect, vector_literal

logging.basicConfig(level=logging.INFO)

#Question class for user question (max length is 2000)
class Question(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


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
def prepare(question):
    # Exact-question cache (whitespace normalized, case preserved).
    key = digest(question + "|" + ANSWER_VERSION + "|" + PIPELINE)
    with connect() as db:
        db.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        docs = db.execute(
            """SELECT id,content_hash,processed_at FROM documents
                WHERE status='ready' AND pipeline_version=%s ORDER BY id""", (PIPELINE,)
        ).fetchall()
        version = digest(json.dumps(docs, default=str, sort_keys=True))
        cached = db.execute(
            "SELECT * FROM answer_cache WHERE question_key=%s AND doc_set_ver=%s",
            (key, version,),
        ).fetchone()
        if cached:
            rows = db.execute(
                """SELECT c.*,d.name FROM answer_cache_chunks ac
                    JOIN chunks c ON c.id=ac.chunk_id JOIN documents d ON d.id=c.doc_id
                    WHERE ac.cache_id=%s ORDER BY ac.source_order""", (cached["id"],)
            ).fetchall()
            return key, version, cached["answer"], rows 
        if not docs:
            return key, version, None, []
        vector = vector_literal(embed(question, query=True))
        rows = db.execute(
            """SELECT c.*,d.name FROM chunks c JOIN documents d ON d.id=c.doc_id
                WHERE d.status='ready' AND d.pipeline_version=%s
                ORDER BY c.embedding <=> %s::vector, c.id LIMIT 5""", (PIPELINE, vector,)
        ).fetchall()
    return key, version, None, rows 

#save an answer as cached for the faster answering
def save_answer(key, version, answer, sources):
    with connect() as db:
        inserted = db.execute(
            """INSERT INTO answer_cache(id,question_key,doc_set_ver,answer)
                VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id""",
            (uuid4(), key, version, answer,)
        ).fetchone()
        if inserted:
            for order, source in enumerate(sources):
                db.execute(
                    "INSERT INTO answer_cache_chunks VALUES (%s,%s,%s)",
                    (inserted["id"], source["id"], order,)
                )

#A generator for streaming Rag endpoint. (chain of events)
# Retrieves needed chunks via prepare, emit them as sources, stream them token by token, validate citations, cache new answers, log the whole query
def stream_answer(question):
    start = time.monotonic()
    usage, cached, outcome = {}, None, "error"
    generation_called= False
    try:
        key, version, cached, rows = prepare(question)
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
            save_answer(key, version, answer, rows)
        
        outcome= "ok"

        yield event("done", {
            "answer": answer, "cited_labels": labels, "cache_hit": cached is not None,
            "generation_token_usage": usage or (None if generation_called else {"total_token_count": 0}),
            "latency_ms": round((time.monotonic() - start) * 1000), "ai_mode": MODE,
        })
    except Exception:
        logging.exception("Question failed")
        yield event("error", {"message": "Answer failed. Discard partial text and retry."})
    finally:
        try:
            with connect() as db:
                db.execute(
                    """INSERT INTO query_logs
                        (id,question,model,token_usage,latency,cache_hit,outcome)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                        (uuid4(), question, "mock" if MODE == "mock" else MODEL,
                         Jsonb({"generation": usage or (None if generation_called else {"total_token_count": 0}),
                            "generation_called": generation_called,
                            "embedding_tokens": None}),
                            round((time.monotonic() - start) * 1000), cached is not None, outcome ,
                        )
                )
        except Exception:
            logging.exception("Could not persist query log")

#extract the pdf file pages' texts
def extract(path, mime_type):
    if mime_type == "application/pdf":
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise ValueError("Encrypted pdf is unsupported")
        if len(reader.pages) > 200:
            raise ValueError("PDF exceeds 200 pages")
        return [(i, page.extract_text() or "") for i, page in enumerate(reader.pages, 1)]
    return [(None, path.read_text(encoding="utf-8"))]

#split the texts inside the pages into 150-180 word chunks with the page numbers as well
def split_pages(pages):
    for page_number, text in pages:
        words = text.split()
        for start in range (0, len(words), 150):
            yield page_number, " ".join(words[start:start + 180])
            if start + 180 >= len(words):
                break

#process the document and create the chunks inside the documents and turn the status of document to ready if it is able to be processed 
def process_one():
    with connect() as db:
        # Lock remains held until processing commits. A worker crash releases it;
        # the queued row becomes available to another worker after rollback.
        doc = db.execute(
            """SELECT * FROM documents WHERE status = 'queued'
                AND pipeline_version = %s ORDER BY created_at
                FOR UPDATE SKIP LOCKED LIMIT 1""", (PIPELINE,)
        ).fetchone()
        if doc is None:
            return False
        try:
            # Nested transaction is a savepoint, remove partial chunks on failure.
            with db.transaction():
                pages = extract(UPLOADS / doc["storage_key"], doc["mime_type"])
                pieces = list(split_pages(pages))
                if not pieces:
                    raise ValueError("No text found; scanned PDFs need OCR")
                if len(pieces) > 2000:
                    raise ValueError("Document exceeds 2000 chunks")
                for order, (page, content) in enumerate(pieces):
                    db.execute(
                        """INSERT INTO chunks
                            (id, doc_id, content, chunk_order, page_number, embedding)
                            VALUES (%s, %s, %s, %s, %s, %s::vector)""",
                            (uuid4(), doc["id"], content, order, page,
                             vector_literal(embed(content)),),
                    )
                db.execute(
                    "UPDATE documents SET status='ready', processed_at=now(), error=NULL WHERE id=%s",
                    (doc["id"],),
                )
                
        except Exception:
            logging.exception("Document processing failed: %s", doc["id"])
            db.execute(
                "UPDATE documents SET status='failed', error=%s WHERE id=%s",
                ("Processing failed. Inspect worker logs, then retry.", doc["id"]),
            )
    return True

if __name__ == "__main__":
    while True:
        try:
            if not process_one():
                time.sleep(2)
        except Exception:
            logging.exception("Worker / database is unavailable")
            time.sleep(5)