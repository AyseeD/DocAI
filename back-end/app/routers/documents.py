"""Document upload, list, status, and retry endpoints."""
import hashlib
from uuid import UUID, uuid4
from typing import Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, Form
from fastapi.responses import JSONResponse
from app.services.worker import extract, DocumentProcessingError
from app.services.injection_scan import has_possible_injection
from app.services.file_deletions import cleanup_deleted_files, permanently_delete_documents
from app.db.db import UPLOADS, connect
from app.api.ai import PIPELINE

router = APIRouter(tags=["documents"])

#upload a file, checks for mime type (PDF and TXT), max size is 20 MiB, and adds the file into db
@router.post("/documents", status_code=202)
def uploadFile(file: UploadFile, acknowledge_injection: bool = Form(False)):
    name = (file.filename or "upload").replace("\\", "/").rsplit("/", 1)[-1][:255]
    suffix = name.lower().rsplit(".", 1)[-1]
    mime = {"pdf": "application/pdf", "txt": "text/plain"}.get(suffix)
    if not mime: 
        raise HTTPException(415, "Upload a PDF or UTF-8 TXT file")
    doc_id = uuid4()
    storage_key = f"{doc_id}.{suffix}"
    path= UPLOADS / storage_key
    size, content_hash = 0, hashlib.sha256()
    keep_file = False

    try:
        with path.open("xb") as output:
            while block := file.file.read(1024 * 1024):
                size += len(block)
                if size > 20 * 1024 * 1024:
                    raise HTTPException(413, "Maximum file size is 20 MiB")
                content_hash.update(block)
                output.write(block)

        if size == 0:
            raise HTTPException(400, "Empty file")
        
        with path.open("rb") as source:
            if suffix == "pdf" and not source.read(1024).lstrip().startswith(b"%PDF-"):
                raise HTTPException(415, "File does not have a PDF header")
        try:
            pages = extract(path, mime)
        except DocumentProcessingError as exc:
            raise HTTPException(422, str(exc)) from exc
        except Exception as exc:
            raise HTTPException(422, "Could not scan document text. Upload a valid PDF or UTF-8 TXT file.") from exc
        if has_possible_injection(pages) and not acknowledge_injection:
            # No database row exists yet, so no worker can ingest this file.
            # The finally block deletes this copy before the response is sent.
            return JSONResponse(status_code=200, content={"requires_confirmation": True})

        with connect() as db:
            row = db.execute(
                """INSERT INTO documents
                    (id,name,size,mime_type,content_hash,storage_key,pipeline_version)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (content_hash,pipeline_version) DO NOTHING
                    RETURNING id,status""",
                (doc_id, name, size, mime,content_hash.hexdigest(),storage_key, PIPELINE,)
            ).fetchone()
            if row is None:
                row = db.execute(
                    "SELECT id,status,deleted_at FROM documents WHERE content_hash=%s AND pipeline_version=%s",
                    (content_hash.hexdigest(), PIPELINE,)
                ).fetchone()
        if row.get("deleted_at") is not None:
            raise HTTPException(409, "This document is in Trash. Restore it there before uploading again.")
        keep_file = row["id"] == doc_id
        return {**row, "duplicate": not keep_file}
    finally:
        file.file.close()
        if not keep_file:
            path.unlink(missing_ok=True)

@router.get("/documents")
def list_docs(trashed: bool = False):
    with connect() as db:
        return db.execute(
            """SELECT id,name,size,mime_type,status,created_at,processed_at,error,deleted_at
                FROM documents WHERE pipeline_version=%s AND (deleted_at IS NOT NULL) = %s
                ORDER BY created_at DESC""",
            (PIPELINE, trashed),
        ).fetchall()

@router.get('/documents/retained-ids')
def retained_document_ids():
    # Include active and trashed records from all pipelines so clients do not
    # discard restorable chats or histories belonging to an older pipeline.
    with connect() as db:
        rows = db.execute('SELECT id FROM documents').fetchall()
    return [row['id'] for row in rows]


#get the document with the given id
@router.get("/documents/{doc_id}")
def document(doc_id: UUID):
    with connect() as db:
        row = db.execute(
            """SELECT id,name,size,mime_type,status,error,created_at,processed_at FROM documents
               WHERE id=%s AND pipeline_version=%s AND deleted_at IS NULL""", (doc_id, PIPELINE,)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Document not found")
    return row

#try to post a document again after it fails
@router.post("/documents/{doc_id}/retry", status_code=202)
def retry_document(doc_id: UUID):
    with connect() as db:
        row = db.execute(
            """UPDATE documents SET status='queued',error=NULL,processed_at=NULL
               WHERE id=%s AND pipeline_version=%s AND deleted_at IS NULL AND status='failed' RETURNING id,status""",
            (doc_id, PIPELINE,),
        ).fetchone()
    if row is None:
        raise HTTPException(409, "No failed document available to retry")
    return row



class DocumentAction(BaseModel):
    action: Literal['trash', 'restore', 'delete']
    document_ids: list[UUID] = Field(min_length=1, max_length=1000)


@router.post('/documents/actions')
def document_action(body: DocumentAction):
    ids = sorted(set(body.document_ids))
    with connect() as db:
        # Serialize against ingestion and concurrent restore/delete actions.
        rows = db.execute(
            """SELECT id,storage_key,deleted_at FROM documents
               WHERE id = ANY(%s) AND pipeline_version=%s ORDER BY id FOR UPDATE""",
            (ids, PIPELINE),
        ).fetchall()
        if body.action != 'delete' and len(rows) != len(ids):
            raise HTTPException(404, 'One or more documents no longer exist. Refresh and try again.')
        if body.action == 'delete':
            if any(row['deleted_at'] is None for row in rows):
                raise HTTPException(409, 'Move documents to Trash before deleting permanently.')
            permanently_delete_documents(db, rows)
        elif body.action == 'trash':
            db.execute('UPDATE documents SET deleted_at=COALESCE(deleted_at,now()) WHERE id = ANY(%s)', (ids,))
        else:
            db.execute('UPDATE documents SET deleted_at=NULL WHERE id = ANY(%s)', (ids,))
    if body.action == 'delete' and not cleanup_deleted_files(ids):
        raise HTTPException(503, 'Records deleted; file cleanup is pending. Retry to finish deletion.')
    return {'document_ids': ids, 'action': body.action}
