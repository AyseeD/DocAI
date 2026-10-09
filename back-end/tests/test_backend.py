"""Contract and document-isolation regressions; no running database/provider required."""
import importlib
import json
import math
import os
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

os.environ["AI_MODE"] = "mock"
_uploads = tempfile.TemporaryDirectory()
os.environ["UPLOAD_DIR"] = _uploads.name

from fastapi import HTTPException
from fastapi.testclient import TestClient
from psycopg._queries import PostgresQuery
from psycopg.adapt import Transformer
from app.main import app
from app.api import ai
from app.services import questions, documents, worker

DOC_A, DOC_B = uuid4(), uuid4()


def document(doc_id=DOC_A, status="ready", processed="2026-01-01"):
    return dict(id=doc_id, status=status, content_hash="hash", processed_at=processed)


def chunk(doc_id=DOC_A):
    return dict(id=uuid4(), doc_id=doc_id, name="sample.txt", page_number=None,
                section=None, content="The project is Cedar.")


class DB:
    """Scripted results; validate actual Psycopg parameter binding for every query."""
    def __init__(self, responses=()):
        self.responses = iter(responses)
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        if params is not None:
            PostgresQuery(Transformer()).convert(sql, params)
        return self

    def fetchone(self):
        return next(self.responses)

    def fetchall(self):
        return next(self.responses)


def frames(stream):
    return [(frame.splitlines()[0][7:], json.loads(frame.splitlines()[1][6:])) for frame in stream]


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()

    def test_document_id_required_and_uuid_validated(self):
        for payload in [{"question": "hello"}, {"question": "hello", "document_id": "1"}]:
            self.assertEqual(self.client.post("/questions/stream", json=payload).status_code, 422)

    def test_blank_and_long_questions_rejected(self):
        for question in ["   ", "x" * 2001]:
            response = self.client.post("/questions/stream", json={"question": question, "document_id": str(DOC_A)})
            self.assertEqual(response.status_code, 422)

    def test_missing_and_unready_fail_before_stream(self):
        for doc, status in [(None, 404), (document(status="queued"), 409), (document(status="failed"), 409)]:
            with patch.object(documents, "connect", return_value=DB([doc])), patch("app.routers.questions.stream_answer") as stream:
                response = self.client.post("/questions/stream", json={"question": "hello", "document_id": str(DOC_A)})
            self.assertEqual(response.status_code, status)
            self.assertIn("application/json", response.headers["content-type"])
            self.assertIsInstance(response.json()["detail"], str)
            stream.assert_not_called()

    def test_normalized_question_and_uuid_forwarded(self):
        with patch("app.routers.questions.require_ready_document"), patch("app.routers.questions.stream_answer", return_value=iter([questions.event("done", {})])) as stream:
            response = self.client.post("/questions/stream", json={"question": "  hello   there ", "document_id": str(DOC_A)})
        stream.assert_called_once_with("hello there", DOC_A)
        self.assertIn("text/event-stream", response.headers["content-type"])

    def test_health_and_listing_return_data(self):
        with patch("app.main.connect", return_value=DB()):
            self.assertEqual(self.client.get("/health").json()["ai_mode"], "mock")
        with patch("app.routers.documents.connect", return_value=DB([[]])):
            self.assertEqual(self.client.get("/documents").json(), [])

    def test_invalid_uploads(self):
        for name, body, status in [("a.exe", b"abc", 415), ("a.txt", b"", 400), ("a.pdf", b"not pdf", 415)]:
            response = self.client.post("/documents", files={"file": (name, body)})
            self.assertEqual(response.status_code, status)
        self.assertEqual(list(Path(_uploads.name).iterdir()), [])


class IsolationTests(unittest.TestCase):
    def prepare(self, doc_id=DOC_A, processed="2026-01-01"):
        row = chunk(doc_id)
        db = DB([document(doc_id, processed=processed), None, [row]])
        with patch.object(questions, "connect", return_value=db):
            result = questions.prepare("same question", doc_id)
        return result, db

    def test_retrieval_and_cache_are_document_scoped(self):
        a, db_a = self.prepare(DOC_A)
        b, db_b = self.prepare(DOC_B)
        self.assertNotEqual(a[0], b[0])
        self.assertNotEqual(a[1], b[1])
        for doc_id, db in [(DOC_A, db_a), (DOC_B, db_b)]:
            sql, params = db.calls[-1]
            self.assertIn("WHERE d.id=%s", sql)
            self.assertEqual(params[0], doc_id)
            cache_sql, cache_params = db.calls[-2]
            self.assertIn("document_id=%s", cache_sql)
            self.assertEqual(cache_params[-1], doc_id)

    def test_reprocessing_invalidates_document_fingerprint(self):
        before, _ = self.prepare(processed="old")
        after, _ = self.prepare(processed="new")
        self.assertNotEqual(before[1], after[1])

    def test_cache_hit_skips_embedding_and_filters_sources(self):
        cache_id = uuid4()
        db = DB([document(), {"id": cache_id, "answer": "Cached [1]"}, [chunk()]])
        with patch.object(questions, "connect", return_value=db), patch.object(questions, "embed") as embed:
            result = questions.prepare("question", DOC_A)
        embed.assert_not_called()
        self.assertEqual(result[2], "Cached [1]")
        self.assertIn("c.doc_id=%s", db.calls[-1][0])
        self.assertEqual(db.calls[-1][1], (cache_id, DOC_A))

    def test_reject_cache_sources_from_another_document(self):
        with self.assertRaises(ValueError):
            questions.save_answer("k", "v", "a", [chunk(DOC_B)], DOC_A)

    def test_readiness_query_includes_pipeline(self):
        db = DB([document()])
        documents.require_ready_document(DOC_A, db=db)
        self.assertIn("pipeline_version=%s", db.calls[0][0])
        self.assertEqual(db.calls[0][1], (DOC_A, ai.PIPELINE))


class StreamingTests(unittest.TestCase):
    def run_stream(self, rows, cached=None, generator=None):
        with ExitStack() as stack:
            stack.enter_context(patch.object(questions, "prepare", return_value=("key", "ver", cached, rows)))
            save = stack.enter_context(patch.object(questions, "save_answer"))
            db = DB()
            stack.enter_context(patch.object(questions, "connect", return_value=db))
            if generator is not None:
                stack.enter_context(patch.object(questions, "generate", generator))
            events = frames(questions.stream_answer("question", DOC_A))
        return events, save, db

    def test_mock_stream_cites_selected_document_and_logs_it(self):
        events, save, db = self.run_stream([chunk()])
        self.assertEqual(events[0][0], "sources")
        self.assertEqual(events[0][1]["sources"][0]["doc_id"], str(DOC_A))
        self.assertEqual(events[-1][0], "done")
        self.assertEqual(events[-1][1]["cited_labels"], [1])
        self.assertEqual(events[-1][1]["generation_token_usage"]["total_token_count"], 0)
        self.assertEqual(events[-1][1]["document_id"], str(DOC_A))
        self.assertGreater(sum(name == "delta" for name, _ in events), 1)
        save.assert_called_once()
        self.assertEqual(db.calls[-1][1][-1], DOC_A)

    def test_empty_retrieval_refuses(self):
        events, save, _ = self.run_stream([])
        self.assertEqual(events[-1][1]["answer"], ai.REFUSAL)
        save.assert_not_called()

    def test_cached_stream_does_not_generate_or_resave(self):
        with patch.object(questions, "generate") as generate:
            events, save, _ = self.run_stream([chunk()], cached="Cached [1]")
        generate.assert_not_called()
        save.assert_not_called()
        self.assertTrue(events[-1][1]["cache_hit"])

    def test_invalid_citation_emits_error_and_is_not_cached(self):
        events, save, _ = self.run_stream([chunk()], generator=lambda *args: iter(["Wrong [9]"]))
        self.assertEqual(events[-1][0], "error")
        save.assert_not_called()

    def test_provider_error_after_partial_text_is_not_cached(self):
        def broken(*args):
            yield "Partial "
            raise RuntimeError("provider failed")
        events, save, _ = self.run_stream([chunk()], generator=broken)
        self.assertEqual(events[-1][0], "error")
        self.assertFalse(any(name == "done" for name, _ in events))
        save.assert_not_called()


class PipelineTests(unittest.TestCase):
    def test_chunk_overlap_and_page_boundaries(self):
        pieces = list(worker.split_pages([(2, " ".join(map(str, range(400)))), (3, "next page")]))
        self.assertEqual([p for p, _ in pieces], [2, 2, 2, 3])
        self.assertEqual(pieces[0][1].split()[-30:], pieces[1][1].split()[:30])
        self.assertEqual(pieces[2][1].split()[-1], "399")

    def test_mock_embedding_is_normalized(self):
        values = ai.embed("hello")
        self.assertEqual(len(values), 768)
        self.assertTrue(math.isclose(sum(x*x for x in values), 1))

    def test_migration_supports_existing_database(self):
        migration = importlib.import_module("app.db.migrate")
        db = DB([{"name": "documents"}])
        with patch.object(migration, "connect", return_value=db):
            migration.migrate()
        sql = "\n".join(s for s, _ in db.calls)
        self.assertIn("ALTER TABLE answer_cache ADD COLUMN IF NOT EXISTS", sql)
        self.assertNotIn("DROP", sql)
        self.assertNotIn("DELETE FROM", sql)


if __name__ == "__main__":
    unittest.main()
