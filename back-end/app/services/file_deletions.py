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


def permanently_delete_documents(db, rows):
    """Caller locks document rows; all database changes share its transaction."""
    for row in rows:
        db.execute(
            'INSERT INTO file_deletions(document_id,storage_key) VALUES (%s,%s) ON CONFLICT DO NOTHING',
            (row['id'], row['storage_key']),
        )
    ids = [row['id'] for row in rows]
    db.execute('DELETE FROM query_logs WHERE document_id = ANY(%s)', (ids,))
    db.execute('DELETE FROM documents WHERE id = ANY(%s)', (ids,))
    # Foreign keys cascade to extracted chunks, answers, and citations.


def purge_expired_trash():
    """Purge up to 100 documents older than ten elapsed days, across pipelines."""
    with connect() as db:
        rows = db.execute(
            """SELECT id,storage_key FROM documents
               WHERE deleted_at < now() - interval '240 hours'
               ORDER BY deleted_at,id LIMIT 100 FOR UPDATE SKIP LOCKED"""
        ).fetchall()
        if rows:
            permanently_delete_documents(db, rows)
    return len(rows)
