-- Grounded GTM simulation runs. Agents (HQ approver, distributor, regulator, buyer)
-- may only cite statutory_chunks and partner_registry rows; every turn records the
-- ids it relied on so the report can be checked. Runs spend the organisation's own
-- AI key, so each has a hard token budget.

CREATE TABLE public.gtm_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'budget_exhausted')),
  provider text NOT NULL CHECK (provider IN ('groq', 'anthropic', 'openai')),
  model text NOT NULL,
  input jsonb NOT NULL,                      -- product, sector, candidate states, partners, constraints
  token_budget integer NOT NULL CHECK (token_budget BETWEEN 1000 AND 500000),
  tokens_used integer NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{agent, content, citations: [...], partner_ids: [...]}]
  result jsonb,                              -- ranked states, risks, open questions
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX gtm_simulations_org_created_idx ON public.gtm_simulations(org_id, created_at DESC);

ALTER TABLE public.gtm_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY gtm_simulations_member_read ON public.gtm_simulations
  FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));
CREATE POLICY gtm_simulations_member_create ON public.gtm_simulations
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.has_role(org_id, ARRAY['member', 'advisor', 'admin']))
    AND created_by = (SELECT auth.uid())
    AND status = 'queued' AND tokens_used = 0 AND transcript = '[]'::jsonb AND result IS NULL
  );
-- Progress, results and cancellation are written by the server (service_role).
