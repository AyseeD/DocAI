from ..db.db import connect
from ..api.ai import MODE,PIPELINE

#get the database connection health status
def getHealth():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok", "ai_mode": MODE}

#show a list of all the documents in db
def listDocs():
    with connect() as db:
        return db.execute(
            """SELECT id,name,size,mime_type,status,created_at,processed_at,error
                FROM documents WHERE pipeline_version=%s ORDER BY created_at DESC""",
            (PIPELINE,),
        ).fetchall()