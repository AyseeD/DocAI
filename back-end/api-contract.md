# DocAI — Frontend / Backend API Contract v1 (Draft)

**Status:** Draft — requires frontend and backend developer approval  
**Scope:** Local single-user MVP; React + Vite + TypeScript ↔ FastAPI  
**Source of truth:** Backend `app/main.py`, `app/services/worker.py` shared on 2026-10-08; database schema screenshots and backend reference notes. Endpoint declarations have been inspected, but end-to-end execution has **not** been verified.  
**Decision:** Chat queries are scoped to **one selected document** (Option B). This behavior is **proposed**, not yet implemented.

## 1. Conventions

- **Development API base URL (proposed):** `http://localhost:8000`. Confirm the exposed Docker port before integration.
- **Frontend origin allowed in code:** `http://localhost:5173`, `http://127.0.0.1:5173`.
- **Formats:** JSON for normal requests/responses, `multipart/form-data` for uploads, `text/event-stream` for streamed answers.
- **Identifiers:** Document and chunk IDs are UUID strings.
- **Time values:** JSON ISO-8601 date-time strings with timezone information; `processed_at` may be `null`.
- **Statuses:** `queued | ready | failed` are persisted backend statuses. `selected`, `uploading`, and `streaming` are frontend-only UI states.
- **Authentication:** Not included in the current single-user prototype. Do not deploy to a multi-user environment without authorization and document ownership checks.
- **Error shape:** Explicit `HTTPException` responses use FastAPI's `{"detail": "message"}`. Framework validation errors (HTTP 422) use a structured `detail` array; unexpected server errors must not be assumed to have a fixed shape.

## 2. Endpoints currently declared in backend code

### GET `/health` — Implemented in code

**200 JSON** (example):

```json
{"status":"ok","ai_mode":"mock"}
```

Checks the database with `SELECT 1`. A database failure can prevent HTTP 200.

### POST `/documents` — Implemented in code

**Request:** `multipart/form-data` with one field named `file` containing a PDF or UTF-8 TXT file. Max size **20 MiB** (20 × 1024 × 1024 bytes). Backend checks extension and PDF header; TXT UTF-8 decoding happens during background processing.

**202 JSON** (illustrative UUID):

```json
{"id":"a73f1b82-4d2e-4c5a-9f6a-112233445566","status":"queued","duplicate":false}
```

For a duplicate upload, `duplicate: true` and the existing document's `id` and current `status` are returned; the status need not be `queued`.

**Known explicit errors:** `400` empty file; `413` size above 20 MiB; `415` unsupported extension or invalid PDF header. `422` may occur for invalid/missing multipart fields. Other errors may occur on storage/database failure. Frontend checks file size and extension for early feedback; backend remains authoritative.

**Important:** HTTP 202 means accepted, **not processed**. Frontend must query document status before enabling chat.

### GET `/documents` — Implemented in code

**200 JSON:** A top-level array ordered by `created_at DESC`, scoped to the backend's current pipeline version.

```json
[
  {
    "id":"a73f1b82-4d2e-4c5a-9f6a-112233445566",
    "name":"AI Research.pdf",
    "size":102400,
    "mime_type":"application/pdf",
    "status":"ready",
    "created_at":"2026-10-08T11:30:00+00:00",
    "processed_at":"2026-10-08T11:30:15+00:00",
    "error":null
  }
]
```

### GET `/documents/{doc_id}` — Implemented in code

`doc_id`: UUID path parameter.

**200 JSON** (example):

```json
{
  "id":"a73f1b82-4d2e-4c5a-9f6a-112233445566",
  "name":"AI Research.pdf",
  "size":102400,
  "status":"queued",
  "error":null,
  "created_at":"2026-10-08T11:30:00+00:00",
  "processed_at":null
}
```

Unlike the list response, this endpoint currently **does not include** `mime_type`. `404` if document does not exist in the current pipeline; malformed UUID may yield `422`.

**Frontend behavior:** Poll while `queued` (proposed initial interval: 2 seconds; stop on `ready`, `failed`, navigation away, or component cleanup). Polling cadence is a frontend implementation choice, not an existing backend guarantee.

### POST `/documents/{doc_id}/retry` — Implemented in code

**Request:** No body. UUID path parameter. Only failed documents may be retried.

**202 JSON** (example):

```json
{"id":"a73f1b82-4d2e-4c5a-9f6a-112233445566","status":"queued"}
```

**409:** No failed document available to retry (also used when ID is absent or not in the current pipeline). Malformed UUID may yield `422`.

### POST `/questions/stream` — Implemented in code; **selection scope change pending**

**Current request:**

```json
{"question":"What is the main topic?"}
```

`question` is a string of 1–2000 characters according to the Pydantic model; the route normalizes whitespace and rejects blank-only questions with HTTP 422.

**Current response:** `text/event-stream` (SSE). The current backend retrieves chunks across **all ready documents** in the current pipeline; it does **not** filter by the selected document.

#### SSE event contract — Implemented in code

**`sources`**: emitted before answer deltas, including cache hits and empty results.

```text
event: sources
data: {"sources":[{"label":1,"chunk_id":"11111111-1111-4111-8111-111111111111","doc_id":"a73f1b82-4d2e-4c5a-9f6a-112233445566","name":"AI Research.pdf","page_number":3,"section":null,"content":"Relevant passage..."}],"cache_hit":false}

```

`page_number` and `section` may be null. The `sources` list may be empty. These are **retrieved** sources, not necessarily all cited in the final answer.

**`delta`**: text fragments; can be a single entire answer for cache hits or refusals.

```text
event: delta
data: {"text":"According to the document "}

```

**`done`**: the **only successful terminal event**.

```text
event: done
data: {"answer":"According to the document [1].","cited_labels":[1],"cache_hit":false,"generation_token_usage":{"total_token_count":125},"latency_ms":1420,"ai_mode":"mock"}

```

`generation_token_usage` may be `null` or a provider-specific object. Example counts are illustrative, not guaranteed. `cited_labels` indexes `sources[].label`.

**`error`**: emitted on generation/retrieval/validation failures after streaming begins.

```text
event: error
data: {"message":"Answer failed. Discard partial text and retry."}

```

**Frontend handling:** Use `fetch` and a streaming reader for the POST request (not native `EventSource`, which cannot send this POST JSON body). Parse SSE frames across arbitrary network chunks. Display provisional `delta` text; on `done`, use the final `answer` and map `cited_labels` to `sources`. On `error` or premature stream termination, discard provisional output and offer retry. Never inject raw source text as HTML. Support abort/cancellation when changing documents.

## 3. Proposed change — document-scoped chat (Option B)

**Not implemented. Backend developer approval and implementation required.**

### Request v1 target

```json
{
  "question":"What is the main topic?",
  "document_id":"a73f1b82-4d2e-4c5a-9f6a-112233445566"
}
```

- `document_id`: **required UUID** identifying the selected document.
- `question`: required nonblank string, maximum 2000 characters (normalization on server).
- Validate document existence, pipeline membership, and `ready` status **before** opening SSE if possible.
- **Proposed pre-stream errors:** `404` document not found; `409` document not ready; `422` malformed or missing fields. Final error code decisions require backend approval.
- Retrieval SQL must include `d.id = document_id` in addition to `ready` and pipeline-version filters.
- The ready-document fingerprint and cache identity must be **document-specific**. A question asked about document A must never retrieve a cached answer or chunks from document B. Account for pipeline, answer/prompt version, and document content/index version.
- The streaming event schema remains the same. Every returned `sources[].doc_id` must match the requested document ID.
- Changing selected documents in the UI cancels the prior stream and clears or separates previous conversation state.
- **No frontend-only filtering workaround:** Filtering returned sources cannot correct an answer already generated using another document.

### Proposed backend change locations

1. `app/services/worker.py`: add `document_id: UUID` to `Question`; pass it through `stream_answer` to `prepare`.
2. `app/main.py`: validate selected document and pass `document_id` to the streaming generator.
3. `prepare`: restrict ready-document lookup and vector retrieval to selected UUID; adjust cache fingerprint/key.
4. Add backend tests for two documents with identical questions, unavailable/failed documents, cache isolation, and correct source document IDs.

## 4. Frontend TypeScript shapes (target, subject to approval)

```ts
export type DocumentStatus = 'queued' | 'ready' | 'failed'

export type DocumentSummary = {
  id: string
  name: string
  size: number
  mime_type: string
  status: DocumentStatus
  created_at: string
  processed_at: string | null
  error: string | null
}

export type DocumentDetail = Omit<DocumentSummary, 'mime_type'>

export type UploadDocumentResponse = {
  id: string
  status: DocumentStatus
  duplicate: boolean
}

export type RetryDocumentResponse = {
  id: string
  status: 'queued'
}

export type AskQuestionRequest = {
  question: string
  document_id: string // Required in proposed Option B contract
}

export type Source = {
  label: number
  chunk_id: string
  doc_id: string
  name: string
  page_number: number | null
  section: string | null
  content: string
}

export type SourcesEvent = { sources: Source[]; cache_hit: boolean }
export type DeltaEvent = { text: string }
export type DoneEvent = {
  answer: string
  cited_labels: number[]
  cache_hit: boolean
  generation_token_usage: Record<string, unknown> | null
  latency_ms: number
  ai_mode: string
}
export type ErrorEvent = { message: string }
```

Keep API response shapes distinct from UI-only state (`selectedFile`, `uploading`, `selectedDocumentId`, `streaming`). Avoid inventing a backend `processing` status.

## 5. Frontend behavior / acceptance checklist

- [ ] Load document list from `GET /documents`; display empty/error/loading states.
- [ ] Accept PDF/TXT; reject obvious unsupported extension and files above 20 MiB before upload.
- [ ] Send `FormData` field `file` to `POST /documents`; **do not manually set multipart Content-Type** (browser supplies boundary).
- [ ] Show `uploading` while HTTP request is pending; after HTTP 202 show returned document as `queued`, not `ready`.
- [ ] Poll `GET /documents/{id}` until `ready` or `failed`; stop polling on unmount/selection changes.
- [ ] Display `failed` and call retry endpoint on explicit user action.
- [ ] Disable chat until a `ready` document is selected.
- [ ] Send `document_id` only after backend Option B is implemented; never claim document-scoped answers beforehand.
- [ ] Stream SSE, map citations, handle `error` and missing `done`, support abort/retry.
- [ ] Show cache hit and generation usage only when supplied; never fabricate cost or token counts.
- [ ] Test invalid/empty/oversized files, duplicates, backend unavailable, processing failures, no sources, and interrupted streams.

## 6. Open decisions / approval checklist

| Question | Proposed owner | Status |
|---|---|---|
| Confirm local API host/port and Docker readiness | Backend | Pending |
| Approve required `document_id` in chat request | Both | Decision made for UX; backend implementation pending |
| Agree on not-found/not-ready HTTP codes before SSE | Backend | Pending |
| Confirm document-scoped retrieval and cache isolation | Backend | Pending |
| Confirm exact 422 validation error shape and any global error handler | Backend | Pending |
| Decide polling interval and whether status updates will eventually use push | Frontend + backend | Proposed 2 seconds |
| Confirm mock-mode behavior and real-model readiness | Backend | Pending |
| Confirm API response fields via Swagger / integration tests | Both | Pending |

## 7. Validation and change control

1. Backend developer reviews and approves proposed changes.
2. Run FastAPI and PostgreSQL; verify `/docs` and the six endpoints against real responses.
3. Record any contract changes here **before** updating frontend types and services.
4. Implement backend document-scoped chat and add tests before enabling selected-document questions in the UI.
5. Both developers approve the final v1; future breaking changes require a documented revision.

**Do not confuse this API Contract with an ADR.** The contract specifies request/response behavior; ADRs record why architectural choices were made.
