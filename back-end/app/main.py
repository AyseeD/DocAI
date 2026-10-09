from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.ai import MODE
from app.db.db import connect
from app.routers.documents import router as documents_router
from app.routers.questions import router as questions_router

app = FastAPI(title="DocAI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)
app.include_router(documents_router)
app.include_router(questions_router)

@app.get("/health")
def health():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok", "ai_mode": MODE}
