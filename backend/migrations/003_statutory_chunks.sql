-- Statutory RAG corpus: clause-level chunks of public statutes and regulator
-- directions (RBI, DPIIT, MCA, ...) with pgvector embeddings.
--
-- This is public law shared by every tenant, so unlike the assessment tables it
-- is intentionally NOT row-level-security scoped. The runtime application role
-- only needs SELECT; ingestion runs as a separate writer (or the migration
-- owner) via `python -m app.rag.ingest`.
--
-- The vector dimension is fixed by the embedding model. 384 matches the default
-- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (and the test
-- hashing embedder). Switching to a model with another dimension needs a new
-- migration that alters this column and re-embeds the corpus.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE statutory_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code text NOT NULL CHECK (document_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  document_title text NOT NULL CHECK (length(trim(document_title)) > 0),
  -- Badge label, e.g. 'RBI Master Direction (FI)'; issuing body, e.g. 'RBI'.
  document_short_title text NOT NULL CHECK (length(trim(document_short_title)) > 0),
  authority text NOT NULL DEFAULT 'Unknown',
  -- 'section' | 'paragraph' | 'clause' | 'rule' | 'regulation' | 'article'
  reference_style text NOT NULL DEFAULT 'clause',
  -- Human-readable locator exactly as cited, e.g. 'Section 149(3)' or 'Paragraph 4.2(a)'.
  clause_reference text NOT NULL CHECK (length(trim(clause_reference)) > 0),
  -- Stable machine identifier, e.g. 'RBI-MD-FI/Paragraph 4.2(a)'.
  citation_id text NOT NULL,
  -- Enclosing structure: {"chapter": "III", "chapter_title": "...", "section": "4", ...}.
  hierarchy jsonb NOT NULL DEFAULT '{}'::jsonb,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  content text NOT NULL CHECK (length(trim(content)) > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  embedding vector(384) NOT NULL,
  embedding_model text NOT NULL,
  source_url_or_file text NOT NULL,
  page_start integer CHECK (page_start IS NULL OR page_start >= 1),
  page_end integer CHECK (page_end IS NULL OR page_end >= page_start),
  last_verified_date timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_code, chunk_index),
  UNIQUE (document_code, content_hash)
);

-- Approximate nearest-neighbour index for `ORDER BY embedding <=> $query`.
CREATE INDEX statutory_chunks_embedding_hnsw
  ON statutory_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX statutory_chunks_document ON statutory_chunks (document_code);
CREATE INDEX statutory_chunks_citation ON statutory_chunks (citation_id);
