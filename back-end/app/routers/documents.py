"""Document upload, list, status, and retry endpoints."""
import hashlib
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, UploadFile
from app.db.db import UPLOADS, connect
from app.api.ai import PIPELINE

router = APIRouter(tags=["documents"])

#upload a file, checks for mime type (PDF and TXT), max size is 20 MiB, and adds the file into db
@router.post("/documents", status_code=202)
def uploadFile(file:UploadFile):
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
                    "SELECT id,status FROM documents WHERE content_hash=%s AND pipeline_version=%s",
                    (content_hash.hexdigest(), PIPELINE,)
                ).fetchone()
        keep_file = row["id"] == doc_id
        return {**row, "duplicate": not keep_file}
    finally:
        file.file.close()
        if not keep_file:
            path.unlink(missing_ok=True)

@router.get("/documents")
def list_docs():
    with connect() as db:
        return db.execute(
            """SELECT id,name,size,mime_type,status,created_at,processed_at,error
                FROM documents WHERE pipeline_version=%s ORDER BY created_at DESC""",
            (PIPELINE,),
        ).fetchall()

#get the document with the given id
@router.get("/documents/{doc_id}")
def document(doc_id: UUID):
    with connect() as db:
        row = db.execute(
            """SELECT id,name,size,status,error,created_at,processed_at FROM documents
               WHERE id=%s AND pipeline_version=%s""", (doc_id, PIPELINE,)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Document not found")
    return row

#try to post a document again after it fails
@router.post("/documents/{doc_id}/retry", status_code=202)
def retry_document(doc_id: UUID):
    with connect() as db:
        row = db.execute(
            """UPDATE documents SET status='queued',error=NULL
               WHERE id=%s AND pipeline_version=%s AND status='failed' RETURNING id,status""",
            (doc_id, PIPELINE,),
        ).fetchone()
    if row is None:
        raise HTTPException(409, "No failed document available to retry")
    return row

