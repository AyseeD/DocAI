"""Validate the selected document before opening an SSE response."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.schemas.questions import Question
from app.services.documents import require_ready_document
from app.services.questions import stream_answer

router = APIRouter(tags=["questions"])

#start streaming the answer once a question is asked
@router.post("/questions/stream")
def ask(body: Question):
    require_ready_document(body.document_id)
    return StreamingResponse(
        stream_answer(body.question, body.document_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
