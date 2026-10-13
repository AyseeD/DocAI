# DocAI

Upload PDF or TXT documents and ask questions about a selected document.
The backend uses FastAPI, PostgreSQL/pgvector, and an ingestion worker; the frontend uses React and Vite.

## Prerequisites

- Docker Desktop, installed and running.
- Node.js 22.12+ and npm (Node 22.19 works).

## 1. Start the backend

From the project root:

```bash
cd back-end
# First-time setup only; these commands preserve existing files.
cp -n .env.example .env
cp -n compose-example.yml compose.yml
```

Edit `back-end/.env` and set `POSTGRES_PASSWORD` to a nonempty password.
Keep `AI_MODE=mock` for local testing without an API key. For real AI answers,
follow the model configuration in [the backend guide](back-end/README.md#mock-and-real-ai).
Keep any existing credentials and model settings when restarting the project.

Then, from `back-end/`:

```bash
docker compose up --build -d
docker compose ps -a
curl http://localhost:8000/health
```

Compose starts the database, runs migrations automatically, and starts the API
and document ingestion worker. No manual database creation or Python setup is needed.
The `migrate` container exiting with code `0` is expected.

- API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs
- Database: `localhost:5555`, database `docai`, user `postgres`

The example Compose file uses `pgvector/pgvector:pg16`. If an older local
`compose.yml` references the missing `docai-img`, use the example image for a
new database. For an existing database volume, check its PostgreSQL major
version before changing the image; do not delete the volume to fix startup.

## 2. Start the frontend

Open a second terminal and, from the project root, run:

```bash
cd front-end
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173**. Keep this terminal running.
The frontend connects to `http://localhost:8000` by default; no frontend `.env`
is required. Upload a PDF or TXT file, wait for processing, select it, and ask a question.
Mock mode returns labeled test answers rather than real AI answers.

## Restart and stop

For later starts, run `docker compose up -d` from `back-end/` and the same
`npm run dev` command from `front-end/`. After backend code or configuration
changes, use `docker compose up --build -d` instead.

Stop the frontend with `Ctrl+C`. Stop the backend from `back-end/` with:

```bash
docker compose stop
```

Database and uploaded files are retained. Avoid `docker compose down -v`,
which deletes the project's data volumes.

If startup fails, check Docker Desktop is running and inspect backend logs:

```bash
cd back-end
docker compose logs --tail=100 db migrate api worker
```

If port 5173 is occupied, stop the existing frontend process before restarting;
the backend allows frontend requests from port 5173.
