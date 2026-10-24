-- Shared reference data: statute chunks (backend/migrations/003) and the partner
-- registry (backend/migrations/004). Signed-in users read; only service_role writes
-- (the Python ingest worker and the fixture loader).

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.statutory_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code text NOT NULL CHECK (document_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  document_title text NOT NULL CHECK (length(trim(document_title)) > 0),
  document_short_title text NOT NULL CHECK (length(trim(document_short_title)) > 0),
  authority text NOT NULL DEFAULT 'Unknown',
  reference_style text NOT NULL DEFAULT 'clause',
  clause_reference text NOT NULL CHECK (length(trim(clause_reference)) > 0),
  citation_id text NOT NULL,
  hierarchy jsonb NOT NULL DEFAULT '{}'::jsonb,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  content text NOT NULL CHECK (length(trim(content)) > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  embedding extensions.vector(384) NOT NULL,
  embedding_model text NOT NULL,
  source_url_or_file text NOT NULL,
  page_start integer CHECK (page_start IS NULL OR page_start >= 1),
  page_end integer CHECK (page_end IS NULL OR page_end >= page_start),
  last_verified_date timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_code, chunk_index),
  UNIQUE (document_code, content_hash)
);
CREATE INDEX statutory_chunks_embedding_hnsw ON public.statutory_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX statutory_chunks_document ON public.statutory_chunks(document_code);
CREATE INDEX statutory_chunks_citation ON public.statutory_chunks(citation_id);

ALTER TABLE public.statutory_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY statutory_chunks_read ON public.statutory_chunks FOR SELECT TO authenticated USING (true);

-- Nearest clauses for a query embedding (computed by the worker). SECURITY INVOKER,
-- so the caller's RLS still applies.
CREATE FUNCTION public.match_statutory_chunks(
  query_embedding extensions.vector(384),
  embedding_model_name text,
  match_count integer DEFAULT 5,
  document_codes text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid, document_code text, document_title text, document_short_title text, authority text,
  clause_reference text, citation_id text, hierarchy jsonb, content text, source_url_or_file text,
  page_start integer, page_end integer, last_verified_date timestamptz, similarity double precision
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT c.id, c.document_code, c.document_title, c.document_short_title, c.authority,
         c.clause_reference, c.citation_id, c.hierarchy, c.content, c.source_url_or_file,
         c.page_start, c.page_end, c.last_verified_date,
         1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.statutory_chunks c
  WHERE c.embedding_model = embedding_model_name
    AND (document_codes IS NULL OR c.document_code = ANY(document_codes))
  ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT least(greatest(match_count, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.match_statutory_chunks(extensions.vector, text, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_statutory_chunks(extensions.vector, text, integer, text[]) TO authenticated, service_role;

CREATE TABLE public.partner_registry (
  id uuid PRIMARY KEY,
  partner_name text NOT NULL CHECK (length(trim(partner_name)) > 0),
  record_source text NOT NULL CHECK (record_source IN ('simulated_fixture', 'registry_mock', 'registry_verified')),
  sector text NOT NULL,
  state text NOT NULL,
  city text,
  partner_type text NOT NULL CHECK (partner_type IN ('distributor', 'supplier', 'jv_partner', 'contract_manufacturer')),
  mca_registration_no text NOT NULL UNIQUE,
  gstin text NOT NULL UNIQUE CHECK (gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  registered_address text NOT NULL,
  incorporated_on date,
  mca_compliance jsonb NOT NULL,
  gst_compliance jsonb NOT NULL,
  director_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  litigation jsonb NOT NULL DEFAULT '[]'::jsonb,
  litigation_flag boolean NOT NULL,
  financial_solvency_score numeric(5, 2) CHECK (financial_solvency_score BETWEEN 0 AND 100),
  credit_rating jsonb NOT NULL,
  iso_certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  operations jsonb NOT NULL,
  cross_border jsonb NOT NULL,
  data_as_of date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_registry_sector_state ON public.partner_registry(sector, state);

ALTER TABLE public.partner_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_registry_read ON public.partner_registry FOR SELECT TO authenticated USING (true);
