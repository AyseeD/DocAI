"""Backend acceptance checks; no live database/provider required."""
import asyncio
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import patch
import unittest
from test_backend import DB, DOC_A, chunk, document, frames, _uploads
from fastapi.testclient import TestClient
from app.main import app
from app.routers import documents as routes
from app.routers.questions import managed_stream
from app.services import worker, questions

class UploadTests(unittest.TestCase):
    def test_size_boundary_and_cleanup(self):
        for size, expected in [(20 * 1024 * 1024, 202), (20 * 1024 * 1024 + 1, 413)]:
            with patch.object(routes, 'uuid4', return_value=DOC_A), patch.object(routes, 'connect', return_value=DB([dict(id=DOC_A, status='queued')])):
                with TestClient(app) as client:
                    response = client.post('/documents', files={'file': ('a.txt', b'a' * size)})
            self.assertEqual(response.status_code, expected)
            files = list(Path(_uploads.name).iterdir())
            self.assertEqual(len(files), int(expected == 202))
            for path in files:
                path.unlink()

    def test_duplicate_removes_new_file(self):
        with patch.object(routes, 'connect', return_value=DB([None, dict(id=DOC_A, status='ready')])), TestClient(app) as client:
            response = client.post('/documents', files={'file': ('a.txt', b'hello')})
        self.assertTrue(response.json()['duplicate'])
        self.assertEqual(list(Path(_uploads.name).iterdir()), [])

    def test_storage_cleaned_on_database_failure(self):
        with patch.object(routes, 'connect', side_effect=RuntimeError('unavailable')), TestClient(app, raise_server_exceptions=False) as client:
            self.assertEqual(client.post('/documents', files={'file': ('a.txt', b'hello')}).status_code, 500)
        self.assertEqual(list(Path(_uploads.name).iterdir()), [])

    def test_retry_resets_status_and_timestamp(self):
        for row, status in [(dict(id=DOC_A, status='queued'), 202), (None, 409)]:
            db = DB([row])
            with patch.object(routes, 'connect', return_value=db), TestClient(app) as client:
                self.assertEqual(client.post(f'/documents/{DOC_A}/retry').status_code, status)
            self.assertIn("status='failed'", db.calls[0][0])
            self.assertIn('processed_at=NULL', db.calls[0][0])

class WorkerTests(unittest.TestCase):
    def test_failure_then_success(self):
        doc = dict(id=DOC_A, storage_key='a.txt', mime_type='text/plain')
        for pages, status in [([(None, '   ')], 'failed'), ([(None, 'hello')], 'ready')]:
            db = DB([doc])
            db.transaction = nullcontext
            with patch.object(worker, 'connect', return_value=db), patch.object(worker, 'extract', return_value=pages):
                self.assertTrue(worker.process_one())
            self.assertIn(f"status='{status}'", db.calls[-1][0])
            if status == 'failed':
                self.assertIn('No text found', db.calls[-1][1][0])

    def test_invalid_utf8_and_bom(self):
        path = Path(_uploads.name) / 'encoding.txt'
        try:
            path.write_bytes(b'\xff')
            with self.assertRaisesRegex(worker.DocumentProcessingError, 'UTF-8'):
                worker.extract(path, 'text/plain')
            path.write_bytes(b'\xef\xbb\xbfhello')
            self.assertEqual(worker.extract(path, 'text/plain'), [(None, 'hello')])
        finally:
            path.unlink()

class RetrievalTests(unittest.TestCase):
    def test_irrelevant_sources_filtered_and_generation_skipped(self):
        db = DB([document(), None, [{**chunk(), 'distance': 0.9}]])
        with patch.object(questions, 'MODE', 'model'), patch.object(questions, 'connect', return_value=db), patch.object(questions, 'generate') as generate:
            events = frames(questions.stream_answer('unrelated', DOC_A))
        generate.assert_not_called()
        self.assertEqual(events[0][1]['sources'], [])
        self.assertEqual(events[-1][1]['answer'], questions.REFUSAL)
        self.assertEqual(events[-1][1]['generation_token_usage']['total_token_count'], 0)

    def test_threshold_changes_cache_identity(self):
        keys = []
        for threshold in [0.3, 0.7]:
            with patch.object(questions, 'MAX_DISTANCE', threshold), patch.object(questions, 'connect', return_value=DB([document(), None, []])):
                keys.append(questions.prepare('question', DOC_A)[0])
        self.assertNotEqual(*keys)

class CancellationTests(unittest.TestCase):
    def test_closing_response_closes_provider_logs_cancel_and_skips_cache(self):
        closed = []
        def generate(*args):
            try:
                yield 'partial'
                yield 'answer [1]'
            finally:
                closed.append(True)
        async def run():
            stream = managed_stream(questions.stream_answer('hello', DOC_A))
            await anext(stream)
            await anext(stream)
            await stream.aclose()
        db = DB()
        with patch.object(questions, 'prepare', return_value=('k', 'v', None, [chunk()])), patch.object(questions, 'connect', return_value=db), patch.object(questions, 'generate', generate), patch.object(questions, 'save_answer') as save:
            asyncio.run(run())
        self.assertEqual(closed, [True])
        save.assert_not_called()
        self.assertEqual(db.calls[-1][1][-2], 'cancelled')
