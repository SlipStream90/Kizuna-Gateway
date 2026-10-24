# Audit Findings — Kizuna Gateway

All findings below follow the required format: ID, severity, category, evidence, reproduction, impact, fix, effort, verification.

---

## F-01: No live PostgreSQL database available locally

- **Severity:** Critical
- **Category:** Infrastructure / Data
- **Confirmed defect:** Yes
- **Evidence:** `backend/migrations/002_pilot_foundation.sql` requires PostgreSQL 18 with pgcrypto and RLS. `backend/tests/test_pilot_isolation.py:14` skips without `PILOT_TEST_DATABASE_URL`. `backend/.env.example` references `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kizuna` but no PostgreSQL service is installed on this machine (`Get-Command psql` returned nothing).
- **Reproduction:** Run `python -m pytest` — 4 tests skip because `PILOT_TEST_DATABASE_URL` is not set. Backend `lifespan` in `backend/app/repositories/database.py:20` calls `pool.open(wait=True)` which will fail without a valid `DATABASE_URL`.
- **Impact:** Backend cannot start or persist data locally. All tenant-scoped persistence, RLS, and audit events are untested. Blocks any end-to-end demo.
- **Fix:** Provision a disposable PostgreSQL 18 database (locally via Docker or CI service), apply migrations `001_initial.sql` and `002_pilot_foundation.sql`, create non-owner app role, set `DATABASE_URL` and `PILOT_TEST_DATABASE_URL` environment variables.
- **Effort:** S (assuming Docker available; M if manual install required)
- **Dependencies:** PostgreSQL 18+, pgcrypto extension, psycopg-binary (installed)
- **Verification:** `python -m pytest backend/tests/test_pilot_isolation.py -v` passes against the provisioned DB; 4 previously-skipped tests now execute.

---

## F-02: No real data source integrations implemented

- **Severity:** High
- **Category:** Data / Integrations
- **Confirmed defect:** Yes
- **Evidence:** `backend/app/seed/` contains hardcoded fixtures for regions, sources, and partners. `backend/app/repositories/pilot_repository.py` queries `source_documents`, `source_versions`, `source_passages` tables but no ingestion pipeline exists to populate them from official sources. `frontend/lib/api.ts` calls `http://localhost:8000/api/v1` with mocked responses in tests.
- **Data source status (researched):**
  - India Industrial Land Bank (IILB): `https://www.indiaindustriallandbank.gov.in/` — GIS-based industrial land repository, ~4,240 parks, 6.58 lakh ha. API docs available at `IIS_API_Doc_V2.3.5.pdf`. Status: Access documented; not implemented.
  - DGFT IEC / ITC-HS: `https://www.dgft.gov.in/` — Importer-Exporter Code and HS code policy. Status: Access documented; not implemented.
  - Open Government Data Platform: `https://data.gov.in/` — API catalog available. Status: Access documented; not implemented.
  - BIS compulsory certification: `https://www.bis.gov.in/` — 187 QCOs covering 769 products. Status: Access documented; not implemented.
  - India-Japan CEPA: In force since 1 August 2011, ~94% of goods at 0% tariff. Rules of Origin: CTH + RVC ≥ 35%. Official: `https://www.mofa.go.jp/region/asia-paci/india/epa201102/index.html`. Status: Not implemented.
- **Reproduction:** Any call to `/compliance/search`, `/partners`, or `/market-ranking` returns seeded fixture data, not live official source data.
- **Impact:** All engine outputs are illustrative only. Cannot support real SME decisions. Product is a demo skeleton, not a decision-support tool.
- **Fix:** Build a data-source abstraction layer (`backend/app/services/ingestion/`) with adapters for IILB, DGFT, data.gov.in, and BIS. Populate `source_documents`, `source_versions`, `source_passages` via scheduled ingestion. Flag all data with `retrieved_at` and `source_id` provenance.
- **Effort:** L (four adapters + scheduling + schema alignment)
- **Dependencies:** F-01 (live DB), network access to source APIs, API keys/terms review
- **Verification:** Integration test confirms at least one source record is retrieved from a live API and stored with correct provenance fields.

---

## F-03: Product marketed as "AI-powered" but contains zero AI/LLM components

- **Severity:** High
- **Category:** Product / AI
- **Confirmed defect:** Yes
- **Evidence:** README.md describes "Compliance Copilot" and "GTM Simulator" as engines but `backend/app/domain/compliance_search.py` is deterministic keyword matching (`sp.text ILIKE %s`). `backend/app/services/compliance_service.py` does not exist as an LLM service. No `openai`, `anthropic`, `langchain`, or similar package in `requirements.lock`. No embedding model, no vector store, no reranker, no prompt template.
- **Reproduction:** Search `backend/` for "llm", "embed", "vector", "prompt", "completion" — zero results in source code (only in pydantic warnings).
- **Impact:** Misrepresents product capabilities. Compliance Copilot cannot handle regulatory nuance, tables, scanned PDFs, or conflicting guidance. GTM calculations are pure Python, not AI.
- **Fix:** Either (a) remove "AI-powered" claims from marketing, or (b) implement a genuine LLM component with model provider abstraction, structured generation, citation grounding, and prompt-injection safeguards. If adding LLM, start with Compliance Copilot retrieval + citation validation.
- **Effort:** M (remove claims) or XL (implement LLM pipeline properly)
- **Dependencies:** None for removal; LLM provider account + API key for implementation
- **Verification:** Code search confirms no "AI-powered" claims in README/PRD; or LLM component passes citation grounding benchmark.

---

## F-04: OIDC authentication environment variables not configured

- **Severity:** High
- **Category:** Security / Configuration
- **Confirmed defect:** Yes
- **Evidence:** `backend/app/auth/dependencies.py:17-23` requires `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_SIGNING_KEY`, `OIDC_JWT_ALGORITHM`. `backend/.env.example` (line 1-2) only defines `DATABASE_URL` and `CORS_ORIGINS` — no OIDC variables. `require_principal()` at line 38-40 raises 401 "OIDC verifier is not configured" if any are missing.
- **Reproduction:** Start backend without OIDC env vars; any API request returns 401.
- **Impact:** Backend cannot serve authenticated requests in any environment. Frontend `api()` helper sends no Authorization header, so all calls fail.
- **Fix:** Add OIDC variables to `.env.example` and deployment config. Configure issuer, audience, signing key, algorithm. Provide a development JWT helper for local testing.
- **Effort:** S
- **Dependencies:** OIDC provider (or dev mock), signing key
- **Verification:** Backend starts without 401 on config check; valid JWT returns `Principal` with `org_id`.

---

## F-05: Frontend has no API authentication handling

- **Severity:** Medium
- **Category:** Security / Frontend
- **Confirmed defect:** Yes
- **Evidence:** `frontend/lib/api.ts:1` — `fetch(`${base}${path}`, {...init, headers: {'Content-Type':'application/json', ...init?.headers}})` — no `Authorization` header. `backend/app/main.py:12` requires `require_principal` on all routers.
- **Reproduction:** Frontend calls to `/api/v1/assessments` return 401 once backend OIDC is enforced.
- **Impact:** All frontend-to-backend communication is broken. The workflow cannot function.
- **Fix:** Add token storage (httpOnly cookie or localStorage) and inject `Authorization: Bearer <token>` header in `api()` helper. Handle 401 with redirect to login.
- **Effort:** S
- **Dependencies:** F-04 (OIDC configured)
- **Verification:** Frontend test mocks a valid JWT and confirms API calls include `Authorization` header; 401 triggers login redirect.

---

## F-06: No idempotency keys on write endpoints

- **Severity:** Medium
- **Category:** API Reliability
- **Confirmed defect:** Yes
- **Evidence:** `backend/app/api/assessments.py:11-15` — `create_assessment` accepts `X-Request-ID` header but `PilotRepository.create_assessment` does not use it for idempotency checks. `CREATE TABLE assessments` has no idempotency key column. Retry of POST `/api/v1/assessments` creates duplicate records.
- **Reproduction:** POST same assessment payload twice; two records created with different IDs.
- **Impact:** Network retries cause duplicate assessments, corrupting audit trail and versioning.
- **Fix:** Add `idempotency_key` column to `assessments` table; check for existing key before insert; return cached response on replay.
- **Effort:** M
- **Dependencies:** F-01 (live DB migration)
- **Verification:** Idempotency test: POST same key twice returns same assessment ID, single database row.

---

## F-07: No rate limiting or abuse protection on API

- **Severity:** Medium
- **Category:** Security / Reliability
- **Confirmed defect:** Yes
- **Evidence:** `backend/app/main.py` — FastAPI app with CORS middleware only. No rate limiting middleware, no request size limits, no IP-based throttling. `psycopg_pool` has `max_size=10` but no connection-level concurrency control per tenant.
- **Reproduction:** Rapid sequential requests to `/api/v1/assessments` — no 429 responses.
- **Impact:** Vulnerable to abuse/DoS; a single tenant can exhaust the connection pool.
- **Fix:** Add rate limiting middleware (e.g., `slowapi` or Redis-backed limiter) with per-tenant limits. Add connection pool per-tenant reservation.
- **Effort:** M
- **Dependencies:** F-01 (live DB), F-04 (tenant identification via OIDC)
- **Verification:** Load test confirms 429 responses after threshold; no pool exhaustion under burst.

---

## F-08: No database migration safety or rollback procedures

- **Severity:** Medium
- **Category:** Infrastructure / Data
- **Confirmed defect:** Yes
- **Evidence:** `backend/migrations/002_pilot_foundation.sql:20-23` has a guard requiring empty legacy tables but no `DROP TABLE` rollback, no migration version tracking table, no `BEGIN/COMMIT` around DDL. `backend/scripts/test-postgres-integration.ps1` applies migrations but no rollback script exists.
- **Reproduction:** Apply `002_pilot_foundation.sql` to a DB with existing `assessments` rows — migration aborts with exception but leaves partial schema changes.
- **Impact:** Failed migration can leave database in inconsistent state. No point-in-time recovery.
- **Fix:** Add migration version table (`schema_migrations`). Wrap migration in transaction. Provide rollback SQL for each migration.
- **Effort:** M
- **Dependencies:** F-01
- **Verification:** Migration applies atomically; rollback script restores prior schema.

---

## F-09: No audit trail for compliance decisions or financial calculations

- **Severity:** Medium
- **Category:** Security / Audit
- **Confirmed defect:** Yes
- **Evidence:** `audit_events` table exists (`002_pilot_foundation.sql:106-110`) and `PilotRepository` writes audit events for assessment CRUD and source version changes. However, `compliance_search` (`pilot_repository.py:129-154`) and `create_report` (`pilot_repository.py:94-127`) do not write audit events for compliance queries or report generation. GTM calculations (`gtm.py`) produce no audit records.
- **Reproduction:** Call `/compliance/search` — no `audit_events` row created.
- **Impact:** No traceability of compliance decisions or financial recommendations. Cannot demonstrate due diligence to auditors.
- **Fix:** Add audit events for compliance_search (query, abstention reasons, citations returned) and report generation (assessment ID, formula version, data version).
- **Effort:** S
- **Dependencies:** F-01
- **Verification:** Compliance search creates audit event with query text and abstention reasons.

---

## F-10: No frontend error recovery or loading states for API failures

- **Severity:** Low
- **Category:** UX / Frontend
- **Confirmed defect:** Yes
- **Evidence:** `frontend/components/assessment-form.tsx:13-24` — `try/catch` sets error string but no retry mechanism, no exponential backoff, no partial success handling. Other controls (`market-controls.tsx`, `gtm-controls.tsx`) have no error handling at all — uncaught fetch errors crash the component.
- **Reproduction:** Backend unavailable; frontend shows unhandled promise rejection or blank state.
- **Impact:** Poor user experience; users cannot distinguish transient failure from permanent error.
- **Fix:** Add retry with backoff, loading spinners, and error boundaries. Display actionable error messages.
- **Effort:** S
- **Dependencies:** None
- **Verification:** Component displays retry button on API failure; recovers after backend returns.