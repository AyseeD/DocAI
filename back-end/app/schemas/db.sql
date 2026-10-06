CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents(
    id uuid PRIMARY KEY,
    name text NOT NULL,
    size bigint NOT NULL CHECK (size > 0),
    mime_type text NOT NULL,
    content_hash text NOT NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'ready', 'failed')),
    storage_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    pipeline_version text NOT NULL,
    error text,
    UNIQUE (content_hash, pipeline_version)
);

CREATE TABLE chunks (
    id uuid PRIMARY KEY,
    doc_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content text NOT NULL,
    section text,
    chunk_order integer NOT NULL CHECK (chunk_order >= 0),
    page_number integer CHECK (page_number > 0),
    embedding vector(768) NOT NULL,
    UNIQUE(doc_id, chunk_order)
);