# Remediation Plan — Kizuna Gateway

**Priority definitions:**
- **P0 — Blocker:** Critical correctness, security, or demo-breaking issues. Must be fixed before any demo or competition.
- **P1 — Before competition:** Material product gaps or reliability defects.
- **P2 — Before real SME pilot:** Operational, data, privacy, and validation gaps.
- **P3 — Later:** Optional improvements and scaling work.

---

## P0 — Blocker

### T-01: Provision PostgreSQL and configure database environment
- **Linked findings:** F-01
- **Severity:** Critical
- **Rationale:** Backend cannot start or persist data without a live database. All tenant-scoped persistence, RLS, and audit events are untested.
- **Implementation change:** Install PostgreSQL 18 (Docker or local). Create database `kizuna_test`. Apply migrations `001_initial.sql` then `002_pilot_foundation.sql`. Create non-owner, non-BYPASSRLS app role `kizuna_app`. Set `DATABASE_URL` and `PILOT_TEST_DATABASE_URL` environment variables. Add `.env` template with all required variables including OIDC.
- **Files affected:** `backend/.env` (new), `backend/.env.example` (update), `backend/migrations/` (no change), CI workflow (verify)
- **Dependencies:** None
- **Effort:** S
- **Acceptance criteria:** `python -m pytest backend/tests/test_pilot_isolation.py -v` — all tests pass (previously 4 skipped). Backend starts without database connection error.
- **Risk:** Low — standard database provisioning.

### T-02: Configure OIDC authentication environment variables
- **Linked findings:** F-04
- **Severity:** Critical
- **Rationale:** `require_principal()` returns 401 "OIDC verifier is not configured" when env vars are missing. Backend cannot serve any authenticated requests.
- **Implementation change:** Add `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_SIGNING_KEY`, `OIDC_JWT_ALGORITHM` to `.env.example`. Provide development JWT generation helper script for local testing. Document that production requires a real OIDC provider.
- **Files affected:** `backend/.env.example`, `backend/.env` (new)
- **Dependencies:** T-01 (for full integration test)
- **Effort:** S
- **Acceptance criteria:** Backend starts without config error. Valid JWT returns `Principal` with correct `org_id`. Invalid/missing token returns 401.
- **Risk:** Low — configuration only.

### T-03: Add Authorization header to frontend API client
- **Linked findings:** F-05
- **Severity:** Critical
- **Rationale:** `frontend/lib/api.ts` sends no `Authorization` header. All frontend-to-backend calls receive 401 once OIDC is enforced.
- **Implementation change:** Modify `api()` helper in `frontend/lib/api.ts` to read token from storage (httpOnly cookie via document.cookie, or localStorage) and inject `Authorization: Bearer <token>`. Add 401 response handler that redirects to login page.
- **Files affected:** `frontend/lib/api.ts`
- **Dependencies:** T-02 (OIDC configured on backend)
- **Effort:** S
- **Acceptance criteria:** Frontend test mocks valid JWT and confirms `Authorization` header present. 401 response triggers login redirect.
- **Risk:** Low — frontend-only change.

---

## P1 — Before competition

### T-04: Add idempotency key to assessment creation
- **Linked findings:** F-06
- **Severity:** Medium
- **Rationale:** Retry of POST `/api/v1/assessments` creates duplicate records. Corrupts audit trail and versioning.
- **Implementation change:** Add `idempotency_key uuid UNIQUE` column to `assessments` table via migration. Check for existing key before insert; return cached assessment on replay with same key.
- **Files affected:** `backend/migrations/` (new migration), `backend/app/repositories/pilot_repository.py` (`create_assessment`), `backend/app/api/assessments.py`
- **Dependencies:** T-01 (live DB)
- **Effort:** M
- **Acceptance criteria:** POST same idempotency key twice returns same assessment ID, single database row. Different key creates new assessment.
- **Risk:** Low — additive column, backward compatible.

### T-05: Implement data source abstraction with at least one live adapter
- **Linked findings:** F-02
- **Severity:** High
- **Rationale:** All data is hardcoded fixtures. Cannot support real SME decisions without at least one live data source.
- **Implementation change:** Create `backend/app/services/ingestion/` directory with base adapter class. Implement one adapter (recommend India Industrial Land Bank — has API docs available). Populate `source_documents`, `source_versions`, `source_passages` tables. Add `retrieved_at` and `source_id` provenance to all records.
- **Files affected:** `backend/app/services/ingestion/` (new), `backend/app/repositories/pilot_repository.py` (compliance_search reads live data)
- **Dependencies:** T-01 (live DB), network access to IILB API
- **Effort:** L
- **Acceptance criteria:** Integration test confirms at least one region record retrieved from live IILB API and stored with correct provenance. `/market-ranking` returns live data, not hardcoded fixtures.
- **Risk:** Medium — external API may have rate limits, terms of service, or availability issues.

### T-06: Implement compliance search audit events
- **Linked findings:** F-09
- **Severity:** Medium
- **Rationale:** No traceability of compliance decisions. Cannot demonstrate due diligence to auditors.
- **Implementation change:** Add `audit_events` insert in `compliance_search()` method recording query text, abstention reasons, and citations returned.
- **Files affected:** `backend/app/repositories/pilot_repository.py` (`compliance_search`)
- **Dependencies:** T-01
- **Effort:** S
- **Acceptance criteria:** Compliance search creates `audit_events` row with action=`compliance.searched`, entity_type=`compliance_query`, after_hash containing query and abstention reasons.
- **Risk:** Low.

### T-07: Add rate limiting middleware
- **Linked findings:** F-07
- **Severity:** Medium
- **Rationale:** No protection against abuse or connection pool exhaustion.
- **Implementation change:** Add rate limiting middleware (e.g., `slowapi` or custom middleware) with per-tenant limits based on `org_id` from JWT. Return 429 on threshold exceeded.
- **Files affected:** `backend/app/main.py` (new middleware), `backend/app/auth/dependencies.py` (org_id extraction)
- **Dependencies:** T-02 (org_id from JWT)
- **Effort:** M
- **Acceptance criteria:** Load test confirms 429 responses after threshold. No pool exhaustion under burst of 100 requests from same tenant.
- **Risk:** Low — middleware addition.

---

## P2 — Before real SME pilot

### T-08: Implement BIS compulsory certification data
- **Linked findings:** F-02
- **Severity:** Medium
- **Rationale:** SMEs need to know if their product requires BIS certification before entering India. 187 QCOs covering 769 products exist.
- **Implementation change:** Ingest BIS QCO list from `https://www.bis.gov.in/product-certification/products-under-compulsory-certification/`. Map HS codes to BIS requirements. Display in compliance search results.
- **Files affected:** `backend/app/services/ingestion/` (BIS adapter), `backend/app/repositories/pilot_repository.py`
- **Dependencies:** T-05 (data source abstraction), T-01
- **Effort:** M
- **Acceptance criteria:** Query for a regulated product returns BIS certification requirement with source citation.
- **Risk:** Medium — web scraping terms of service, page structure changes.

### T-09: Implement CEPA preferential tariff data
- **Linked findings:** F-02
- **Severity:** Medium
- **Rationale:** GTM simulator uses hardcoded duty rates. CEPA provides ~94% of goods at 0% tariff — critical for cost calculations.
- **Implementation change:** Ingest India-Japan CEPA tariff schedule. Map HS codes to preferential rates. Use in GTM calculations instead of hardcoded assumptions.
- **Files affected:** `backend/app/services/ingestion/` (CEPA adapter), `backend/app/domain/gtm.py`
- **Dependencies:** T-05, T-01
- **Effort:** M
- **Acceptance criteria:** GTM calculation for a CEPA-eligible HS code shows 0% duty with CEPA citation.
- **Risk:** Medium — tariff schedule complexity, product-specific rules.

### T-10: Add migration rollback procedures
- **Linked findings:** F-08
- **Severity:** Medium
- **Rationale:** Failed migration can leave database in inconsistent state. No recovery path.
- **Implementation change:** Add `schema_migrations` version tracking table. Wrap migrations in transactions. Provide rollback SQL for `002_pilot_foundation.sql`.
- **Files affected:** `backend/migrations/` (rollback SQL, version tracking)
- **Dependencies:** T-01
- **Effort:** M
- **Acceptance criteria:** Migration applies atomically. Rollback script restores pre-migration schema.
- **Risk:** Low.

### T-11: Customer discovery interviews
- **Linked findings:** Product readiness (business viability)
- **Severity:** Medium
- **Rationale:** Willingness to pay unknown. No customer validation.
- **Implementation change:** Conduct 5-10 structured interviews with Japanese SMEs considering India entry. Show current demo. Capture required data fields, decision criteria, and pricing expectations.
- **Files affected:** None (external activity)
- **Dependencies:** None
- **Effort:** M
- **Acceptance criteria:** Documented interview findings with at least 3 clear product requirements and pricing signals.
- **Risk:** Low.

---

## P3 — Later

### T-12: Implement LLM-powered Compliance Copilot
- **Linked findings:** F-03
- **Severity:** Low (optional)
- **Rationale:** Product is marketed as "AI-powered" but has no AI. Either remove claims or implement genuine LLM component.
- **Implementation change:** Add model provider abstraction (OpenAI/Anthropic/local). Implement RAG pipeline with embeddings, vector search, citation grounding, and prompt-injection safeguards. Add structured generation with schema validation.
- **Files affected:** `backend/app/services/compliance_service.py` (new), `backend/app/domain/compliance_search.py` (rewrite)
- **Dependencies:** T-05 (live data sources), LLM provider account
- **Effort:** XL
- **Acceptance criteria:** Citation grounding benchmark passes (all citations map to retrieved source IDs). Prompt injection test rejects malicious documents.
- **Risk:** High — LLM costs, hallucination, latency.

### T-13: Add encryption at rest and secrets management
- **Linked findings:** Product readiness (security/privacy)
- **Severity:** Low (optional for MVP)
- **Rationale:** Handling confidential business information requires encryption and proper secrets management.
- **Implementation change:** PostgreSQL TDE or pgcrypto column encryption. AWS Secrets Manager or HashiCorp Vault for OIDC keys. Environment variable validation at startup.
- **Files affected:** `backend/app/repositories/database.py`, deployment config
- **Dependencies:** Production deployment
- **Effort:** M
- **Acceptance criteria:** Sensitive fields encrypted at rest. Secrets not in source code or `.env` files committed to git.
- **Risk:** Low.

### T-14: Add frontend error recovery and loading states
- **Linked findings:** F-10
- **Severity:** Low
- **Rationale:** Poor UX on API failures.
- **Implementation change:** Add retry with exponential backoff, loading spinners, error boundaries. Display actionable error messages.
- **Files affected:** `frontend/components/*.tsx`
- **Dependencies:** T-03
- **Effort:** S
- **Acceptance criteria:** Component displays retry button on API failure. Recovers after backend returns.
- **Risk:** Low.

---

## Dependency order

```
T-01 (PostgreSQL) ──> T-04 (idempotency) ──> T-06 (compliance audit)
T-01 ──> T-02 (OIDC) ──> T-03 (frontend auth)
T-01 ──> T-05 (data source abstraction) ──> T-08 (BIS) ──> T-09 (CEPA)
T-05 ──> T-12 (LLM Copilot, P3)
```

**Suggested execution order:** T-01 → T-02 → T-03 → T-04 → T-06 → T-05 → T-07 → T-08 → T-09 → T-11 → (P3 items)