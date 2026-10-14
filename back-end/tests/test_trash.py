"""Document lifecycle contracts, including physical deletion and isolation."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from test_backend import DB, DOC_A, DOC_B
from app.main import app
from app.routers import documents
from app.services import documents as readiness, worker, file_deletions


class TrashTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def action(self, action, ids=None):
        return self.client.post('/documents/actions', json={'action': action, 'document_ids': [str(i) for i in (ids or [DOC_A])]})

    def test_active_and_trash_lists_are_separate(self):
        for trashed in (False, True):
            db = DB([[]])
            with patch.object(documents, 'connect', return_value=db):
                self.assertEqual(self.client.get('/documents', params={'trashed': str(trashed).lower()}).status_code, 200)
            self.assertIn('(deleted_at IS NOT NULL) = %s', db.calls[0][0])
            self.assertEqual(db.calls[0][1][1], trashed)

    def test_trash_and_restore_keep_file_and_history(self):
        for action, assignment in [('trash', 'COALESCE(deleted_at,now())'), ('restore', 'deleted_at=NULL')]:
            db = DB([[{'id': DOC_A, 'storage_key': 'a.txt', 'deleted_at': None}]])
            with tempfile.TemporaryDirectory() as directory, patch.object(documents, 'UPLOADS', Path(directory)), patch.object(documents, 'connect', return_value=db):
                path = Path(directory) / 'a.txt'
                path.write_text('document text')
                self.assertEqual(self.action(action).status_code, 200)
                self.assertTrue(path.exists())
            self.assertIn('FOR UPDATE', db.calls[0][0])
            self.assertIn(assignment, db.calls[1][0])
            self.assertEqual(len(db.calls), 2)

    def test_bulk_permanent_delete_removes_files_and_logs(self):
        rows = [{'id': doc_id, 'storage_key': f'{doc_id}.txt', 'deleted_at': '2026-10-14'} for doc_id in (DOC_A, DOC_B)]
        db = DB([rows])
        cleanup_db = DB([[{'document_id': row['id'], 'storage_key': row['storage_key']} for row in rows]])
        with tempfile.TemporaryDirectory() as directory, patch.object(documents, 'UPLOADS', Path(directory)), patch.object(documents, 'connect', return_value=db), patch.object(file_deletions, 'connect', return_value=cleanup_db), patch.object(file_deletions, 'UPLOADS', Path(directory)):
            for row in rows:
                (Path(directory) / row['storage_key']).write_text('private document')
            response = self.action('delete', [DOC_A, DOC_B])
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.json()['document_ids']), {str(DOC_A), str(DOC_B)})
            self.assertEqual(list(Path(directory).iterdir()), [])
        self.assertIn('DELETE FROM query_logs', db.calls[3][0])
        self.assertIn('DELETE FROM documents', db.calls[4][0])

    def test_cannot_hard_delete_active_document(self):
        for rows, ids, status in [
            ([{'id': DOC_A, 'storage_key': 'a.txt', 'deleted_at': None}], [DOC_A], 409),
        ]:
            db = DB([rows])
            with patch.object(documents, 'connect', return_value=db), patch.object(Path, 'unlink') as unlink:
                self.assertEqual(self.action('delete', ids).status_code, status)
                unlink.assert_not_called()
            self.assertEqual(len(db.calls), 1)

    def test_failed_file_cleanup_is_durable_and_retryable(self):
        db = DB([[{'id': DOC_A, 'storage_key': 'a.txt', 'deleted_at': 'date'}]])
        cleanup_db = DB([[{'document_id': DOC_A, 'storage_key': 'a.txt'}]])
        with patch.object(documents, 'connect', return_value=db), patch.object(file_deletions, 'connect', return_value=cleanup_db), patch.object(Path, 'unlink', side_effect=PermissionError):
            self.assertEqual(self.action('delete').status_code, 503)
        self.assertIn('INSERT INTO file_deletions', db.calls[1][0])
        self.assertIn('DELETE FROM documents', db.calls[3][0])
        self.assertEqual(len(cleanup_db.calls), 1)  # Cleanup job is retained.
        db = DB([[]])  # The document row has already been deleted.
        cleanup_db = DB([[{'document_id': DOC_A, 'storage_key': 'a.txt'}]])
        with patch.object(documents, 'connect', return_value=db), patch.object(file_deletions, 'connect', return_value=cleanup_db), patch.object(Path, 'unlink') as unlink:
            self.assertEqual(self.action('delete').status_code, 200)
            unlink.assert_called_once_with(missing_ok=True)
        self.assertIn('DELETE FROM file_deletions', cleanup_db.calls[1][0])

    def test_missing_restore_batch_rejected_before_changes(self):
        db = DB([[{'id': DOC_A, 'storage_key': 'a.txt', 'deleted_at': 'date'}]])
        with patch.object(documents, 'connect', return_value=db):
            self.assertEqual(self.action('restore', [DOC_A, DOC_B]).status_code, 404)
        self.assertEqual(len(db.calls), 1)

    def test_empty_or_invalid_actions_are_rejected(self):
        for body in ({'action': 'delete', 'document_ids': []}, {'action': 'erase', 'document_ids': [str(DOC_A)]}):
            self.assertEqual(self.client.post('/documents/actions', json=body).status_code, 422)

    def test_trashed_documents_excluded_from_detail_retry_readiness_and_worker(self):
        db = DB([None, None])
        with patch.object(documents, 'connect', return_value=db):
            self.assertEqual(self.client.get(f'/documents/{DOC_A}').status_code, 404)
            self.assertEqual(self.client.post(f'/documents/{DOC_A}/retry').status_code, 409)
        for sql, _ in db.calls:
            self.assertIn('deleted_at IS NULL', sql)
        db = DB([None])
        with patch.object(readiness, 'connect', return_value=db):
            self.assertEqual(self.client.post('/questions/stream', json={'question': 'Explain', 'document_id': str(DOC_A)}).status_code, 404)
        self.assertIn('deleted_at IS NULL', db.calls[0][0])
        db = DB([None])
        with patch.object(worker, 'connect', return_value=db):
            self.assertFalse(worker.process_one())
        self.assertIn('deleted_at IS NULL', db.calls[0][0])

    def test_reupload_trashed_duplicate_requires_restore(self):
        db = DB([None, {'id': DOC_A, 'status': 'ready', 'deleted_at': 'date'}])
        with tempfile.TemporaryDirectory() as directory, patch.object(documents, 'UPLOADS', Path(directory)), patch.object(documents, 'connect', return_value=db):
            response = self.client.post('/documents', files={'file': ('a.txt', b'ordinary content')})
            self.assertEqual(response.status_code, 409)
            self.assertIn('Trash', response.json()['detail'])
            self.assertEqual(list(Path(directory).iterdir()), [])
