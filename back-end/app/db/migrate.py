"""Add document scoping without deleting existing documents, chunks or logs.

Run before starting API/worker: python -m app.db.migrate
Also initializes an empty database using the current schema.
"""
from pathlib import Path
from app.db.db import connect


def migrate():
    with connect() as db:
        # Serialize concurrent startup migrations; automatically released on commit.
        db.execute("SELECT pg_advisory_xact_lock(48103921)")
        if db.execute("SELECT to_regclass('public.documents') AS name").fetchone()["name"] is None:
            schema = Path(__file__).resolve().parents[1] / "schemas" / "db.sql"
            db.execute(schema.read_text())
        else:
            db.execute("""ALTER TABLE answer_cache ADD COLUMN IF NOT EXISTS
                       document_id uuid REFERENCES documents(id) ON DELETE CASCADE""")
            db.execute("""ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS
                       document_id uuid REFERENCES documents(id) ON DELETE SET NULL""")
        # Legacy unscoped cache entries stay intact but cannot match new requests.
        db.execute("CREATE INDEX IF NOT EXISTS answer_cache_document_idx ON answer_cache(document_id)")
        db.execute("CREATE INDEX IF NOT EXISTS query_logs_document_idx ON query_logs(document_id, created_at)")


if __name__ == "__main__":
    migrate()
    print("Database schema is ready.")
