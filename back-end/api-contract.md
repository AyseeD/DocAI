# DocAI API contract

Updated 2026-10-13 from the implemented routes. Local single-user application; no authentication or ownership model is implemented. Automated tests use scripted database responses; live PostgreSQL/browser verification remains separate.

## HTTP endpoints

| Endpoint | Request | Success | Explicit errors |
| --- | --- | --- | --- |
| GET /health | None | 200: `status`, `ai_mode`; checks database | Database failure may return 500 |
| POST /documents | Multipart `file` | 202: `id`, `status`, `duplicate` | 400 empty; 413 over 20 MiB; 415 extension/header; 422 invalid multipart |
| GET /documents | None | 200: document array, newest first, current pipeline | Database failure may return 500 |
| GET /documents/{id} | UUID | 200: document detail | 404 missing/current pipeline mismatch; 422 invalid UUID |
| POST /documents/{id}/retry | UUID, no body | 202: `id`, `status: queued` | 409 no failed document available (including absent ID); 422 invalid UUID |
| POST /questions/stream | JSON `question`, `document_id` | 200: SSE | 404 missing/current pipeline mismatch; 409 not ready; 422 invalid body |

Document list and detail fields: `id`, `name`, `size`, `mime_type`, `status`, `created_at`, `processed_at`, `error`. IDs are UUID strings; timestamps are ISO-8601. `processed_at` and `error` are nullable. Status is `queued`, `ready`, or `failed`; queued includes active worker processing. Poll queued documents (the frontend currently uses about two seconds).

Uploads accept PDF and UTF-8 TXT up to and including 20 × 1024 × 1024 bytes. PDF header validation happens at upload; parsing, decoding, page/chunk limits and no-text checks happen in the worker. A malformed file can therefore be accepted and later fail. Duplicate content in the same pipeline returns its existing ID/status and removes the redundant file. Retry clears error and processed timestamp; invalid source content must be corrected and uploaded as a new file.

Questions require a nonblank string of at most 2000 characters before whitespace normalization and a document UUID. The document must be ready before SSE opens. Retrieval and caches are scoped to that document and pipeline. Explicit HTTP errors have a string `detail`; FastAPI 422 validation errors have an array `detail`.

## SSE events

- `sources`: `{sources: [...], cache_hit: boolean}`. Each source has `label` (one-based integer), `chunk_id`, `doc_id`, `name`, `page_number`, `section`, `content`. Page numbers are one-based for PDF and null for TXT; section is currently null. Sources may be empty.
- `delta`: `{text: string}`. Provisional answer fragment; cache/refusal may be one fragment.
- `done`: `{answer, cited_labels, cache_hit, generation_token_usage, latency_ms, ai_mode, document_id}`. The only successful terminal event. Citation labels refer to sources. Generation usage is a provider object or null when unavailable; mock, cached, and no-generation responses report `{total_token_count: 0}`. This is not monetary cost or total embedding usage.
- `error`: `{message: "Answer failed. Discard partial text and retry."}`. Terminal failure after SSE has begun. No successful done event follows.

Use POST fetch with a stream reader. Parse frames across network chunk boundaries. On error or EOF before done, discard partial text. Source text is untrusted and should be rendered as text. Abort on navigation remains compatible. The backend closes the generation iterator and logs cancellation when its response iterator is closed. A blocking provider/database call cannot be forcibly interrupted; the provider adapter must implement bounded timeouts and close its own network stream in a finally block.

Real-model retrieval applies `RETRIEVAL_MAX_DISTANCE` (default to 0.85) to the top five candidates. This needs calibration; it is not proof of grounding. Empty retrieval returns the refusal with no citations or generation call. Mock retrieval bypasses the filter.

## Pending integration

OpenRouter embeddings and streamed generation are implemented. Verify live PDF source pages, failed/retry transitions, network disconnects, token usage, cache miss/hit and 20+ quality cases after integration. Authentication/ownership, rate limits and prompt-injection evaluation remain shared design work. Server-side chat history and durable generation across document switches are outside the present API.
