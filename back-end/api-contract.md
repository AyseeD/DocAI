# DocAI API contract

Updated 2026-10-13 from the implemented routes. Local single-user application; no authentication or ownership model is implemented. Automated tests use scripted database responses; live PostgreSQL/browser verification remains separate.

## HTTP endpoints

| Endpoint | Request | Success | Explicit errors |
| --- | --- | --- | --- |
| GET /health | None | 200: `status`, `ai_mode`; checks database | Database failure may return 500 |
| POST /documents | Multipart `file`, optional `acknowledge_injection` (default false) | 202: `id`, `status`, `duplicate`; 200: `requires_confirmation: true` | 400 empty; 413 over 20 MiB; 415 extension/header; 422 invalid multipart or unreadable document text |
| GET /documents | Optional `trashed=true` (default false) | 200: document array, newest first, current pipeline | Database failure may return 500 |
| GET /documents/{id} | UUID | 200: document detail | 404 missing/current pipeline mismatch; 422 invalid UUID |
| POST /documents/actions | JSON `action`: `trash`, `restore`, or `delete`; `document_ids`: 1–1000 UUIDs | 200: `action`, `document_ids` | 404 missing/current pipeline mismatch; 409 permanent deletion outside Trash; 422 invalid request; 503 file deletion failed |
| POST /documents/{id}/retry | UUID, no body | 202: `id`, `status: queued` | 409 no failed document available (including absent ID); 422 invalid UUID |
| POST /questions/stream | JSON `question`, `document_id` | 200: SSE | 404 missing/current pipeline mismatch; 409 not ready; 422 invalid body |

Document list and detail fields: `id`, `name`, `size`, `mime_type`, `status`, `created_at`, `processed_at`, `error`. IDs are UUID strings; timestamps are ISO-8601. `processed_at` and `error` are nullable. Status is `queued`, `ready`, or `failed`; queued includes active worker processing. Poll queued documents (the frontend currently uses about two seconds).

Uploads accept PDF and UTF-8 TXT up to and including 20 × 1024 × 1024 bytes. PDF header validation, text extraction, decoding and the 200-page limit are checked before queuing. Chunk limits and no-text checks remain in the worker. A local heuristic scans extracted text for instruction overrides, secret/prompt disclosure and role spoofing. A flagged upload returns `200 {"requires_confirmation": true}` without inserting a database row and deletes its temporary file. Canceling discards the browser’s pending file; continuing resubmits it with `acknowledge_injection=true`. Existing AI safeguards remain unchanged. The scan may flag quoted examples and miss obfuscated, non-English, or image-only instructions; it is not a security guarantee. Duplicate content in the same pipeline returns its existing ID/status and removes the redundant file. Retry clears error and processed timestamp; invalid source content must be corrected and uploaded as a new file.

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

## Trash and deletion

Run `python -m app.db.migrate` before starting the updated API and worker; it adds nullable `documents.deleted_at` and the `file_deletions` cleanup queue to existing databases. Docker Compose runs the migration service before API/worker startup.

The default document list excludes trashed documents. `GET /documents?trashed=true` lists them. Trashed documents cannot be queried, retried, or processed by the ingestion worker. Uploading content already in Trash returns 409 with instructions to restore it.

`trash` preserves the file, chunks, cached answers, and chat history for restoration. `restore` clears the deletion timestamp. `delete` requires every selected document to be in Trash and removes files, query logs, documents, and dependent chunks/cache/citations. IDs are validated and locked before mutations. Missing IDs reject trash/restore batches; permanent deletion is idempotent. File cleanup jobs are committed atomically with database deletion, then files are removed. On filesystem failure the endpoint returns 503 and retains the cleanup jobs; retrying deletion or the ingestion worker finishes cleanup. This also recovers after process crashes without restoring documents whose files are missing.

Chat history remains browser-local. The UI preserves it when moving a document to Trash and removes the selected histories from this browser on permanent deletion. It does not remove copies from other browsers or backups. The frontend asks for confirmation before either delete operation, supports bulk restore/permanent delete, and returns to Home only when moving the currently open document to Trash.
