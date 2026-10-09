# DocAI backend

FastAPI, PostgreSQL/pgvector and a persistent ingestion worker. Chat searches **only the selected document**. The frontend must send the real document UUID on every question. No frontend files are changed by this backend implementation.

## Run with Docker

Start Docker Desktop, then from `back-end/`:

```bash
# For a new checkout only; keep an existing .env and its database password.
cp -n .env.example .env
# For a new checkout only; keep an existing compose.yml.
cp -n compose-example.yml compose.yml
docker compose up --build -d
docker compose logs --tail=100 migrate api worker
curl http://localhost:8000/health
```

Your existing Compose configuration uses a custom `docai-img`. It must be a PostgreSQL image with pgvector installed. The example configuration uses `pgvector/pgvector:pg16`; do not replace the image of an existing data volume with a different PostgreSQL major version without a database upgrade plan.

The `migrate` service must finish successfully before API and worker start. It initializes an empty database or adds the new document references/indexes to the previous project schema. It preserves documents, chunks, old cache rows and query logs. Legacy cache entries have no document scope and are ignored. Do not delete your database volume to apply this update.

If API/worker are already running, stop them before manually migrating and then rebuild:

```bash
docker compose stop api worker
docker compose build
docker compose run --rm migrate
docker compose up -d
```

PostgreSQL is `db:5432` inside Compose and `localhost:5555` from your Mac. API docs are at `http://localhost:8000/docs`; OpenAPI JSON is at `/openapi.json`. API and worker share the uploads volume and the same model settings.

## Frontend request

```http
POST /questions/stream
Content-Type: application/json

{
  "question": "What is the main topic of this document?",
  "document_id": "a73f1b82-4d2e-4c5a-9f6a-112233445566"
}
```

`document_id` is required. Missing/malformed UUIDs and blank/overlong questions return HTTP 422. An unknown document, including one from another embedding pipeline, returns 404. A queued or failed document returns 409. These checks happen **before** SSE begins. An error during retrieval/generation after streaming starts is an SSE `error` event, not a new HTTP status.

## Mock and real AI

`AI_MODE=mock` is the default. It uses deterministic artificial vectors and a labeled mock answer emitted in several deltas. This is for UI/protocol testing, not semantic retrieval or answer-quality evaluation. It makes no external model calls.

To use the implemented provider adapter:

```dotenv
AI_MODE=gemini
GEMINI_API_KEY=your-private-key
GENERATION_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
```

Check model access and quota in your provider account; no free quota is assumed. Both the document text and question are sent to that provider. Recreate API and worker after editing `.env`. Re-upload documents after changing the embedding model or switching from mock: the pipeline version intentionally separates incompatible vectors. Provider calls live in `app/api/ai.py`, with bounded exponential-backoff retries for transient embedding errors. Generation failures produce an error event; streams are not automatically restarted after partial output.

The generation prompt treats source passages as untrusted data, supplies no tools or secrets, and requests citations or an explicit refusal. Code validates citation label ranges before caching. This does not prove factual grounding or guarantee immunity to prompt injection; run the evaluation fixture and manually inspect supporting passages.

## Code layout

```text
app/main.py                 App setup and health
app/routers/documents.py    Upload, list, status and retry endpoints
app/routers/questions.py    Question validation and SSE response
app/schemas/questions.py    Required question/document request model
app/services/documents.py   Shared document readiness check
app/services/questions.py   Scoped retrieval, caching, citations and logging
app/services/worker.py      PDF/TXT extraction, chunking and embedding
app/api/ai.py               Mock/Gemini provider boundary
app/db/db.py                Connections and vector formatting
app/db/migrate.py           Non-destructive schema upgrade
app/schemas/db.sql          Fresh database schema
```

## Tests and evaluation

From `back-end/`, using your Python environment with `requirements.txt` installed:

```bash
python -m unittest discover -s tests -v
python evaluation/run.py --smoke
```

The first command tests validation, SQL parameter binding and document filters, document-specific cache keys, source isolation, streaming, failure handling, chunk overlap and migrations using scripted database results. It does **not** replace PostgreSQL integration testing.

The second command requires running API, database and worker. It uploads the synthetic handbook, waits for indexing, and runs the 20 questions in `evaluation/cases.json`. `--smoke` measures protocol behavior only and supports mock mode.

For real-answer evaluation:

```bash
python evaluation/run.py > evaluation-results.json
```

Without `--smoke`, mock mode is rejected. This runner measures expected-keyword matches, refusal behavior, citation label validity, document scoping and whether the injected `BANANA_OVERRIDE` instruction appears. These are reproducible heuristics, not a complete semantic evaluation. Manually verify that citations support each claim. A previously indexed handbook UUID can be supplied with `--document-id`; cached answers may be reused and `cache_hit` is reported.

## Scope and remaining limits

- PDF/TXT uploads, duplicate detection, worker processing, selected-document retrieval, streaming, citations, cache and generation token metadata are implemented.
- The 20-case test set includes unsupported questions and a malicious source instruction; live quality results have to be collected with provider access.
- Generation token metadata is exposed and logged. Embedding token usage is currently unknown (`null`), not zero, so this is not complete cost accounting.
- `queued` includes waiting and actively processing work. The worker holds a transaction/row lock while indexing; a crashed worker releases its work on rollback. This is suitable for a small project; use leases or a durable queue for larger workloads.
- Splitting is page-aware, 180 words with 30-word overlap; it is not token-aware. Scanned PDFs need OCR; heading extraction (`section`) is not implemented.
- This is a local, single-user backend with no authentication or document ownership. Do not expose it as a multi-user service without ownership checks, request limits before multipart parsing and parser resource limits.
- Filesystem writes and database commits are not atomic; a process crash can leave orphan files. Cache cleanup, connection pooling and operational limits remain future work.