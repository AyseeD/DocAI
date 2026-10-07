import logging
import time
from uuid import uuid4
from pypdf import PdfReader
from app.api.ai import PIPELINE, embed
from app.db.db import UPLOADS, connect, vector_literal

logging.basicConfig(level=logging.INFO)

#extract the pdf file pages' texts
def extract(path, mime_type):
    if mime_type == "application/pdf":
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise ValueError("Encrypted pdf is unsupported")
        if len(reader.pages) > 200:
            raise ValueError("PDF exceeds 200 pages")
        return [(i, page.extract_text() or "") for i, page in enumerate(reader.pages, 1)]
    return [(None, path.read_text(encoding="utf-8"))]

#split the texts inside the pages into 150-180 word chunks with the page numbers as well
def split_pages(pages):
    for page_number, text in pages:
        words = text.split()
        for start in range (0, len(words), 150):
            yield page_number, " ".join(words[start:start + 180])
            if start + 180 >= len(words):
                break

#process the document and create the chunks inside the documents and turn the status of document to ready if it is able to be processed 
def process_one():
    with connect() as db:
        # Lock remains held until processing commits. A worker crash releases it;
        # the queued row becomes available to another worker after rollback.
        doc = db.execute(
            """SELECT * FROM documents WHERE status = 'queued'
                AND pipeline_version = %s ORDER BY created_at
                FOR UPDATE SKIP LOCKED LIMIT 1""", (PIPELINE,)
        ).fetchone()
        if doc is None:
            return False
        try:
            # Nested transaction is a savepoint, remove partial chunks on failure.
            with db.transaction():
                pages = extract(UPLOADS / doc["storage_key"], doc["mime_type"])
                pieces = list(split_pages(pages))
                if not pieces:
                    raise ValueError("No text found; scanned PDFs need OCR")
                if len(pieces) > 2000:
                    raise ValueError("Document exceeds 2000 chunks")
                for order, (page, content) in enumerate(pieces):
                    db.execute(
                        """INSERT INTO chunks
                            (id, doc_id, content, chunk_order, page_number, embedding)
                            VALUES (%s, %s, %s, %s, %s, %s::vector)""",
                            (uuid4(), doc["id"], content, order, page,
                             vector_literal(embed(content))),
                    )
                db.execute(
                    "UPDATE documents SET status='ready', processed_at=now(), error=NULL WHERE id=%s",
                    (doc["id"],),
                )
                
        except Exception:
            logging.exception("Document processing failed: %s", doc["id"])
            db.execute(
                "UPDATE documents SET status='failed', error=%s WHERE id=%s",
                ("Processing failed. Inspect worker logs, then retry.", doc["id"]),
            )
    return True

