"""Document readiness checks shared by HTTP validation and retrieval."""
from fastapi import HTTPException
from app.api.ai import PIPELINE
from app.db.db import connect


def require_ready_document(document_id, db=None):
    if db is None:
        with connect() as connection:
            return require_ready_document(document_id, db=connection)
    doc = db.execute(
        "SELECT id,status,content_hash,processed_at FROM documents WHERE id=%s AND pipeline_version=%s",
        (document_id, PIPELINE),
    ).fetchone()
    if doc is None:
        raise HTTPException(404, "Document not found in the current pipeline")
    if doc["status"] != "ready":
        raise HTTPException(409, f"Document is {doc['status']}; wait until it is ready or retry a failed upload")
    return doc
