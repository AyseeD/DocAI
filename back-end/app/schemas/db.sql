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

CREATE TABLE answer_cache (
    id uuid PRIMARY KEY,
    question_key text NOT NULL,
    doc_set_ver text NOT NULL,
    answer text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (question_key, doc_set_ver)
);

CREATE TABLE answer_cache_chunks (
    cache_id uuid NOT NULL REFERENCES answer_cache(id) ON DELETE CASCADE,
    chunk_id uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    source_order integer NOT NULL,
    PRIMARY KEY (cache_id, chunk_id),
    UNIQUE (cache_id, source_order)
);

CREATE TABLE query_logs (
    id uuid PRIMARY KEY,
    question text NOT NULL,
    model text NOT NULL,
    token_usage jsonb NOT NULL,
    latency integer NOT NULL CHECK (latency >= 0),
    cache_hit boolean NOT NULL,
    outcome text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
