-- Assessment pilot tables (from backend/migrations/002), on a fresh schema with no
-- legacy MVP columns. RLS: members of the owning organisation; versioned writes and
-- audit rows go through SECURITY DEFINER functions added with the API port.

CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id)
);

CREATE TABLE public.assessment_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  org_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  payload jsonb NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, org_id) REFERENCES public.assessments(id, org_id),
  UNIQUE (assessment_id, org_id, version)
);

CREATE TABLE public.source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.source_documents(id),
  authority text NOT NULL, url text NOT NULL, retrieved_at timestamptz NOT NULL,
  effective_date date, reviewed_at timestamptz, expires_at date,
  content_hash text NOT NULL CHECK (content_hash ~ '^[A-Fa-f0-9]{64}$'),
  reviewed_by uuid, status text NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, content_hash),
  CHECK (expires_at IS NULL OR effective_date IS NULL OR expires_at >= effective_date)
);

CREATE TABLE public.source_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_version_id uuid NOT NULL REFERENCES public.source_versions(id) ON DELETE CASCADE,
  locator text NOT NULL, text text NOT NULL CHECK (length(trim(text)) > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[A-Fa-f0-9]{64}$'),
  UNIQUE (source_version_id, locator), UNIQUE (source_version_id, content_hash)
);

CREATE TABLE public.report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  assessment_id uuid NOT NULL,
  assessment_revision integer NOT NULL,
  formula_version text NOT NULL, data_version text NOT NULL, label_version text NOT NULL,
  source_passage_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, org_id) REFERENCES public.assessments(id, org_id),
  UNIQUE (assessment_id, org_id, assessment_revision)
);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_id uuid NOT NULL,
  action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, request_id text NOT NULL,
  before_hash text, after_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Partners shortlisted for one assessment (tenant data, unlike partner_registry).
CREATE TABLE public.assessment_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  assessment_id uuid NOT NULL,
  name text NOT NULL, fictional boolean NOT NULL DEFAULT false, region_id text NOT NULL,
  fit jsonb NOT NULL, evidence jsonb NOT NULL, coverage numeric NOT NULL,
  unknowns jsonb NOT NULL DEFAULT '[]'::jsonb, verification_state text NOT NULL,
  verification_date date, missing_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, org_id) REFERENCES public.assessments(id, org_id)
);

CREATE TABLE public.partner_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  partner_id uuid NOT NULL REFERENCES public.assessment_partners(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[A-Fa-f0-9]{64}$'),
  reviewer_id uuid, reviewed_at timestamptz,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
  UNIQUE (partner_id, content_hash)
);

CREATE INDEX assessments_org_idx ON public.assessments(org_id);
CREATE INDEX assessment_revisions_org_assessment_idx ON public.assessment_revisions(org_id, assessment_id, version DESC);
CREATE INDEX report_snapshots_org_assessment_idx ON public.report_snapshots(org_id, assessment_id, assessment_revision);
CREATE INDEX audit_events_org_created_idx ON public.audit_events(org_id, created_at DESC);
CREATE INDEX source_passages_version_idx ON public.source_passages(source_version_id);
CREATE INDEX assessment_partners_org_assessment_idx ON public.assessment_partners(org_id, assessment_id);
CREATE INDEX partner_evidence_org_partner_idx ON public.partner_evidence(org_id, partner_id);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_passages ENABLE ROW LEVEL SECURITY;

-- Reads: any member of the organisation. Writes stay with the server-side functions
-- (and service_role), so revision numbering and audit rows cannot be skipped.
CREATE POLICY assessments_member_read ON public.assessments FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));
CREATE POLICY revisions_member_read ON public.assessment_revisions FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));
CREATE POLICY reports_member_read ON public.report_snapshots FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));
CREATE POLICY audit_admin_read ON public.audit_events FOR SELECT TO authenticated USING ((SELECT private.has_role(org_id, ARRAY['admin', 'reviewer'])));
CREATE POLICY assessment_partners_member_read ON public.assessment_partners FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));
CREATE POLICY partner_evidence_member_read ON public.partner_evidence FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));

-- Sources are approved editorial material shared by all tenants.
CREATE POLICY source_documents_read ON public.source_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY source_versions_read ON public.source_versions FOR SELECT TO authenticated USING (status = 'approved');
CREATE POLICY source_passages_read ON public.source_passages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.source_versions v WHERE v.id = source_version_id AND v.status = 'approved')
);
