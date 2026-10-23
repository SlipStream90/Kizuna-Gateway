-- Tenant trust foundation. Apply as a migration owner, then use a distinct
-- non-superuser, non-BYPASSRLS application role at runtime.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('member','advisor','reviewer','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
-- 001_initial.sql shipped a structurally incompatible, unauthenticated MVP.
-- Existing rows cannot be safely assigned to a tenant or actor; require an
-- explicit export/tenant-mapping before applying this migration to such data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM assessments LIMIT 1) OR EXISTS (SELECT 1 FROM report_snapshots LIMIT 1) THEN
    RAISE EXCEPTION '002_pilot_foundation requires empty legacy assessment/report tables; export and map tenants first';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id)
);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE assessments ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE assessments ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE assessments ADD CONSTRAINT assessments_id_org_key UNIQUE (id, org_id);
-- The legacy columns are deliberately removed after the empty-table guard:
-- retaining their NOT NULL constraints would make the pilot payload schema
-- impossible to write and invite parallel unscoped repository use.
ALTER TABLE assessments DROP COLUMN IF EXISTS product, DROP COLUMN IF EXISTS sector,
  DROP COLUMN IF EXISTS target_customer, DROP COLUMN IF EXISTS budget,
  DROP COLUMN IF EXISTS horizon_months, DROP COLUMN IF EXISTS preferred_modes,
  DROP COLUMN IF EXISTS hs_code, DROP COLUMN IF EXISTS unit_value,
  DROP COLUMN IF EXISTS volume, DROP COLUMN IF EXISTS weights,
  DROP COLUMN IF EXISTS score_version, DROP COLUMN IF EXISTS data_version,
  DROP COLUMN IF EXISTS created_at;
CREATE TABLE assessment_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  org_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  payload jsonb NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, org_id) REFERENCES assessments(id, org_id),
  UNIQUE (assessment_id, org_id, version)
);
CREATE TABLE source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL,
  authority text NOT NULL, url text NOT NULL, retrieved_at timestamptz NOT NULL,
  effective_date date, reviewed_at timestamptz, expires_at date,
  content_hash text NOT NULL CHECK (content_hash ~ '^[A-Fa-f0-9]{64}$'),
  reviewed_by uuid, status text NOT NULL CHECK (status IN ('draft','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (source_id, content_hash),
  CHECK (expires_at IS NULL OR effective_date IS NULL OR expires_at >= effective_date)
);
CREATE TABLE source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE source_versions ADD CONSTRAINT source_versions_source_document_fk
  FOREIGN KEY (source_id) REFERENCES source_documents(id);
CREATE TABLE source_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_version_id uuid NOT NULL REFERENCES source_versions(id) ON DELETE CASCADE,
  locator text NOT NULL, text text NOT NULL CHECK (length(trim(text)) > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[A-Fa-f0-9]{64}$'),
  UNIQUE (source_version_id, locator), UNIQUE (source_version_id, content_hash)
);
CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES organizations(id),
  assessment_id uuid NOT NULL, assessment_revision integer NOT NULL,
  formula_version text NOT NULL, data_version text NOT NULL, label_version text NOT NULL,
  source_passage_hashes jsonb NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, org_id) REFERENCES assessments(id, org_id),
  UNIQUE (assessment_id, org_id, assessment_revision)
);
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS assessment_revision integer;
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS formula_version text;
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS data_version text;
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS label_version text;
ALTER TABLE report_snapshots ADD COLUMN IF NOT EXISTS source_passage_hashes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE report_snapshots ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE report_snapshots ALTER COLUMN assessment_revision SET NOT NULL;
ALTER TABLE report_snapshots ALTER COLUMN formula_version SET NOT NULL;
ALTER TABLE report_snapshots ALTER COLUMN data_version SET NOT NULL;
ALTER TABLE report_snapshots ALTER COLUMN label_version SET NOT NULL;
ALTER TABLE report_snapshots ADD CONSTRAINT report_snapshots_assessment_org_revision_key UNIQUE (assessment_id, org_id, assessment_revision);
ALTER TABLE report_snapshots DROP COLUMN IF EXISTS version;
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES organizations(id), actor_id uuid NOT NULL,
  action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, request_id text NOT NULL,
  before_hash text, after_hash text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assessments_org_id_idx ON assessments(org_id);
CREATE INDEX assessment_revisions_org_assessment_idx ON assessment_revisions(org_id, assessment_id, version DESC);
CREATE INDEX report_snapshots_org_assessment_idx ON report_snapshots(org_id, assessment_id, assessment_revision);
CREATE INDEX audit_events_org_created_idx ON audit_events(org_id, created_at DESC);
CREATE INDEX source_passages_version_idx ON source_passages(source_version_id);

-- Partner records and their evidence are tenant/assessment assignments, never
-- a process-global catalogue response.  A curator may copy approved catalogue
-- facts into these rows, but every read remains tied to one assessment/org.
CREATE TABLE assessment_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  assessment_id uuid NOT NULL,
  name text NOT NULL, fictional boolean NOT NULL DEFAULT false, region_id text NOT NULL,
  fit jsonb NOT NULL, evidence jsonb NOT NULL, coverage numeric NOT NULL,
  unknowns jsonb NOT NULL DEFAULT '[]'::jsonb, verification_state text NOT NULL,
  verification_date date, missing_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, org_id) REFERENCES assessments(id, org_id)
);
CREATE TABLE partner_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id), partner_id uuid NOT NULL REFERENCES assessment_partners(id) ON DELETE CASCADE,
  evidence_type text NOT NULL, content_hash text NOT NULL CHECK (content_hash ~ '^[A-Fa-f0-9]{64}$'),
  reviewer_id uuid, reviewed_at timestamptz, status text NOT NULL CHECK (status IN ('draft','approved','rejected')),
  UNIQUE (partner_id, content_hash)
);
CREATE INDEX assessment_partners_org_assessment_idx ON assessment_partners(org_id, assessment_id);
CREATE INDEX partner_evidence_org_partner_idx ON partner_evidence(org_id, partner_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_evidence ENABLE ROW LEVEL SECURITY;
-- Sources are global approved editorial material; access is controlled by the API.
CREATE POLICY organization_tenant ON organizations USING (id = current_setting('app.org_id', true)::uuid);
CREATE POLICY membership_tenant ON memberships USING (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY assessment_tenant ON assessments USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY revision_tenant ON assessment_revisions USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY report_tenant ON report_snapshots USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY audit_tenant ON audit_events USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY assessment_partner_tenant ON assessment_partners USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
CREATE POLICY partner_evidence_tenant ON partner_evidence USING (org_id = current_setting('app.org_id', true)::uuid) WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
