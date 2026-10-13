"""Validate the selected document before opening an SSE response."""
import anyio
from starlette.concurrency import run_in_threadpool
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.schemas.questions import Question
from app.services.documents import require_ready_document
from app.services.questions import stream_answer

router = APIRouter(tags=["questions"])

async def managed_stream(stream):
    """Close the sync generator deterministically on disconnect or send failure."""
    sentinel = object()
    try:
        while True:
            item = await run_in_threadpool(next, stream, sentinel)
            if item is sentinel:
                break
            yield item
    finally:
        # The response may already be in a cancelled scope. Wait for the current
        # blocking step before closing; provider timeouts must bound that step.
        with anyio.CancelScope(shield=True):
            close = getattr(stream, "close", None)
            if close is not None:
                await run_in_threadpool(close)


#start streaming the answer once a question is asked
@router.post("/questions/stream")
def ask(body: Question):
    require_ready_document(body.document_id)
    return StreamingResponse(
        managed_stream(stream_answer(body.question, body.document_id)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
