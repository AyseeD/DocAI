import hashlib
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from routers.routes import getHealth, listDocs
from uuid import uuid4, UUID
from db.db import UPLOADS, connect
from api.ai import PIPELINE
from services.worker import Question, digest, event, public_source, prepare, save_answer, stream_answer

app = FastAPI(title="DockAI back-end")
#cors middleware for browser errors because of calls from different ports
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"]
)

@app.get("/health")
def health():
    getHealth()

#upload a file, checks for mime type (PDF and TXT), max size is 20 MiB, and adds the file into db
@app.post("/documents", status_code=202)
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
                (doc_id, name, size, mime,content_hash.hexdigest(),storage_key, PIPELINE)
            ).fetchone()
            if row is None:
                row = db.execute(
                    "SELECT id,status FROM documents WHERE content_hash=%s AND pipeline_version=%s",
                    (content_hash.hexdigest(), PIPELINE)
                ).fetchone()
        keep_file = row["id"] == doc_id
        return {**row, "duplicate": not keep_file}
    finally:
        file.file.close()
        if not keep_file:
            path.unlink(missing_ok=True)

@app.get("/documents")
def list_docs():
    listDocs()

#get the document with the given id
@app.get("/documents/{doc_id}")
def document(doc_id: UUID):
    with connect() as db:
        row = db.execute(
            """SELECT id,name,size,status,error,created_at,processed_at FROM documents
               WHERE id=%s AND pipeline_version=%s""", (doc_id, PIPELINE)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Document not found")
    return row

#try to post a document again after it fails
@app.post("/documents/{doc_id}/retry", status_code=202)
def retry_document(doc_id: UUID):
    with connect() as db:
        row = db.execute(
            """UPDATE documents SET status='queued',error=NULL
               WHERE id=%s AND pipeline_version=%s AND status='failed' RETURNING id,status""",
            (doc_id, PIPELINE),
        ).fetchone()
    if row is None:
        raise HTTPException(409, "No failed document available to retry")
    return row

@app.post("/questions/stream")
def ask(body: Question):
    question = " ".join(body.question.split())
    if not question:
        raise HTTPException(422, "Question must not be blank")
    return StreamingResponse(stream_answer(question), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})