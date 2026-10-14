"""Durable file cleanup after the owning document transaction commits."""
import logging
from app.db.db import UPLOADS, connect


def cleanup_deleted_files(document_ids=None):
    with connect() as db:
        if document_ids is None:
            rows = db.execute(
                'SELECT document_id,storage_key FROM file_deletions ORDER BY document_id LIMIT 100 FOR UPDATE SKIP LOCKED'
            ).fetchall()
        else:
            rows = db.execute(
                'SELECT document_id,storage_key FROM file_deletions WHERE document_id = ANY(%s) ORDER BY document_id FOR UPDATE',
                (document_ids,),
            ).fetchall()
        complete = True
        for row in rows:
            try:
                (UPLOADS / row['storage_key']).unlink(missing_ok=True)
            except OSError:
                logging.exception('Document file cleanup failed: %s', row['document_id'])
                complete = False
                continue
            db.execute('DELETE FROM file_deletions WHERE document_id=%s', (row['document_id'],))
        return complete
