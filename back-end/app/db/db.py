import os
from pathlib import Path #for file paths

#imports for postgresql adapter of python
import psycopg
from psycopg.rows import dict_row 

UPLOADS = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
UPLOADS.mkdir(parents=True, exist_ok=True)


def connect():
    # Psycopg reads PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD.
    return psycopg.connect(row_factory=dict_row, connect_timeout=5)


def vector_literal(values):
    # Values originate from the embedding service, never interpolated SQL.
    return "[" + ",".join(str(float(value)) for value in values) + "]"
