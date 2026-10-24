# Executive Audit — Kizuna Gateway

**Verdict:** The product is technically functional as a deterministic demo MVP but is **not ready** for a competition judging session, SME pilot, or production deployment. It is a skeleton vertical slice with working authentication, tenant scoping, and deterministic calculation engines, but lacks any integration with real data sources, has no live backend database, contains no AI/LLM components despite being described as "AI-powered," and the frontend tests were recently repaired to match component changes.

**Current readiness level:** Local engineering demo only.

**Five most serious findings:**

| ID | Severity | Finding |
|----|----------|---------|
| F-01 | Critical | No live PostgreSQL database available; backend cannot run end-to-end without `PILOT_TEST_DATABASE_URL` and `DATABASE_URL` pointing to a real PostgreSQL 18 instance. All data persistence is untested locally. |
| F-02 | High | No real data source integrations exist. India Industrial Land Bank, DGFT IEC, data.gov.in, and BIS are identified but none are implemented. All market/partner/compliance data is hardcoded seeded fixtures. |
| F-03 | High | Product is marketed as "AI-powered" but contains zero AI/LLM components. No embeddings, no RAG, no retrieval pipeline, no model provider abstraction. Compliance Copilot is a deterministic keyword search over stub data. |
| F-04 | High | Authentication depends on OIDC environment variables (`OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_SIGNING_KEY`) that are not configured in `.env.example` or any deployment config. The app will fail to start in production without them. |
| F-05 | Medium | Frontend has no API authentication handling. The `api()` helper in `lib/api.ts` sends no Authorization header, so all frontend-to-backend calls will receive 401 responses once OIDC is enforced. |

**What is working well (evidence-backed):**
- Backend: 5 domain tests pass (compliance, GTM decimal calculations, MCDA ranking, partner disclosure). 4 legacy tests skip by design.
- Frontend: typecheck clean, production build succeeds (webpackBuildWorker: false resolves spawn EPERM), 2 vitest test files pass.
- Security architecture: all 7 API routers require `require_principal` (OIDC bearer JWT with `org_id` claim). `PilotRepository` enforces org-scoped SQL predicates + PostgreSQL RLS policies.
- Assessment creation schema matches migration `002_pilot_foundation.sql` (`org_id`, `created_by`, `payload jsonb`).
- Dependencies locked: `requirements.lock` pins all backend packages including `psycopg-binary==3.3.6`.

**What should be removed, simplified, or deferred:**
- Remove "AI-powered" marketing language from README/PRD until an actual LLM component exists.
- Defer multi-region market ranking data population until IILB or data.gov.in API access is validated.
- Defer partner trust scoring until real verification data sources are integrated.

**Readiness assessment:**
- Local engineering demo: YES
- Competition judging session: NO (no live DB, no real data, no AI)
- SME pilot: NO (no authentication configured, no data integrations, no audit trail for decisions)
- Production deployment: NO (missing OIDC config, no database, no monitoring, no backups)

**Confidence level:** High — all findings verified against actual source code, test output, and running builds.

**Audit limitations:** PostgreSQL not available locally; integration tests skip by design. OIDC provider not configured; end-to-end auth flow not tested. No external data source APIs were actually called (only documentation reviewed).