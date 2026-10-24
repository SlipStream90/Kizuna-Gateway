-- Screened Indian partner directory for the Partner Trust & Verification Engine.
--
-- Shared reference data (like statutory_chunks), so it is not tenant-scoped; per-tenant
-- shortlists continue to live in assessment_partners (002, RLS). Every row states where it
-- came from in `record_source`; the shipped fixtures are 'simulated_fixture' and use
-- identifiers that cannot belong to a real entity (CIN state code 'ZZ', GSTIN state code '00').
-- Trust scores are not stored: they are computed deterministically from these inputs
-- (app/domain/partner_trust.py, versioned), so a stored row always reproduces its score.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE partner_registry (
  id uuid PRIMARY KEY,
  partner_name text NOT NULL CHECK (length(trim(partner_name)) > 0),
  record_source text NOT NULL CHECK (record_source IN ('simulated_fixture', 'registry_mock', 'registry_verified')),
  sector text NOT NULL,
  state text NOT NULL,
  city text,
  partner_type text NOT NULL CHECK (partner_type IN ('distributor', 'supplier', 'jv_partner', 'contract_manufacturer')),
  mca_registration_no text NOT NULL,            -- CIN
  gstin text NOT NULL CHECK (gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  registered_address text NOT NULL,
  incorporated_on date,
  -- {"status": "active|active_non_compliant|dormant|strike_off|under_liquidation", "annual_filings_on_time_last3": 0-3, "last_annual_return_fy": "2025-26"}
  mca_compliance jsonb NOT NULL,
  -- {"status": "active|suspended|cancelled", "returns_on_time_last12": 0-12, "last_return_period": "2026-09"}
  gst_compliance jsonb NOT NULL,
  director_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  litigation jsonb NOT NULL DEFAULT '[]'::jsonb,
  litigation_flag boolean NOT NULL,             -- any pending major tax/corporate matter
  financial_solvency_score numeric(5, 2) CHECK (financial_solvency_score BETWEEN 0 AND 100),
  credit_rating jsonb NOT NULL,                 -- {"agency": ..., "band": "low|moderate|high|unrated", "as_of": ...}
  iso_certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- trailing-12-month operations: otd_monthly_pct[12], fulfillment_accuracy_pct, client_retention_pct,
  -- foreign_principal_satisfaction_pct, sla_compliance_pct
  operations jsonb NOT NULL,
  -- {"contracts_total": n, "contracts_fulfilled": n, "japanese_principals": n}
  cross_border jsonb NOT NULL,
  data_as_of date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mca_registration_no),
  UNIQUE (gstin)
);

CREATE INDEX partner_registry_sector_state ON partner_registry (sector, state);
