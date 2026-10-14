"""Retention must use the same durable deletion path as explicit deletion."""
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from test_backend import DB, DOC_A, DOC_B
from app.main import app
from app.routers import documents
from app.services import file_deletions


class TrashExpiryTests(unittest.TestCase):
    def test_expired_documents_schedule_cleanup_and_remove_logs(self):
        rows = [{'id': DOC_A, 'storage_key': 'old.pdf'}, {'id': DOC_B, 'storage_key': 'older.txt'}]
        db = DB([rows])
        with patch.object(file_deletions, 'connect', return_value=db), patch.object(file_deletions.UPLOADS.__class__, 'unlink') as unlink:
            self.assertEqual(file_deletions.purge_expired_trash(), 2)
            # Files are removed only after the database transaction commits.
            unlink.assert_not_called()
        self.assertIn('INSERT INTO file_deletions', db.calls[1][0])
        self.assertEqual(db.calls[1][1], (DOC_A, 'old.pdf'))
        self.assertEqual(db.calls[2][1], (DOC_B, 'older.txt'))
        self.assertIn('DELETE FROM query_logs', db.calls[3][0])
        self.assertIn('DELETE FROM documents', db.calls[4][0])
        self.assertEqual(db.calls[4][1], ([DOC_A, DOC_B],))

    def test_retention_query_uses_strict_elapsed_cutoff_and_safe_locks(self):
        db = DB([[]])
        with patch.object(file_deletions, 'connect', return_value=db):
            self.assertEqual(file_deletions.purge_expired_trash(), 0)
        self.assertEqual(len(db.calls), 1)
        sql = db.calls[0][0]
        # Strict < preserves the exact ten-day boundary and NULL (restored) rows.
        self.assertIn("deleted_at < now() - interval '240 hours'", sql)
        self.assertIn('FOR UPDATE SKIP LOCKED', sql)
        self.assertIn('LIMIT 100', sql)
        self.assertNotIn('pipeline_version', sql)

    def test_retained_ids_include_all_pipelines_and_trash(self):
        db = DB([[{'id': DOC_A}, {'id': DOC_B}]])
        with patch.object(documents, 'connect', return_value=db):
            response = TestClient(app).get('/documents/retained-ids')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [str(DOC_A), str(DOC_B)])
        self.assertNotIn('WHERE', db.calls[0][0])
