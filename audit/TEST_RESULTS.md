# Test Results — Kizuna Gateway

**Date:** 2026-10-24
**Environment:** Windows 11, Python 3.15.1, Node.js v24.22.1, npm 11.19.1
**Repository:** C:\Users\adity\Desktop\jetro

## Backend tests

**Command:** `python -m pytest -q` (in `backend/`)
**Result:** 5 passed, 4 skipped, 0 failed

| Test File | Result | Notes |
|-----------|--------|-------|
| tests/test_compliance.py | PASSED | Deterministic compliance search logic |
| tests/test_gtm.py | PASSED | Decimal GTM calculations (golden test) |
| tests/test_mcda.py | PASSED | MCDA ranking stability + invalid weights |
| tests/test_partners.py | PASSED | Fictional partner disclosure + separation |
| tests/test_api.py | SKIPPED | Legacy unauthenticated API contract retired |
| tests/test_e2e.py | SKIPPED | Legacy seeded workflow retired |
| tests/test_postgres_integration.py | SKIPPED | Legacy repositories retired |
| tests/test_pilot_isolation.py | SKIPPED | Requires `PILOT_TEST_DATABASE_URL` (no PostgreSQL available) |

**Warnings:** 20 PydanticDeprecatedSince20 warnings from `json_encoders` deprecation (non-blocking).

## Backend tests not runnable

**Command:** `python -m pytest backend/tests/test_pilot_isolation.py -v`
**Blocked:** No PostgreSQL 18 available on this machine. `Get-Command psql` returned nothing.
**Needed:** Docker PostgreSQL 18 or local PostgreSQL install, migrations applied, `DATABASE_URL` and `PILOT_TEST_DATABASE_URL` set.

## Frontend typecheck

**Command:** `npm run typecheck` (in `frontend/`)
**Result:** Clean, no errors

## Frontend production build

**Command:** `npm run build` (in `frontend/`)
**Result:** Success, ~6 seconds
**Routes:** `/` (static), `/_not-found` (static), `/report` (static)
**Note:** `webpackBuildWorker: false` set in `next.config.ts` to avoid `spawn EPERM` on Windows sandbox.

## Frontend unit tests

**Command:** `npm test` (in `frontend/`)
**Result:** 2 passed, 0 failed

| Test File | Result |
|-----------|--------|
| test/report-view.test.tsx | PASSED |
| test/workflow.e2e.test.tsx | PASSED |

## Dependency installation

**Backend:**
- `psycopg-binary==3.3.6` — installed (was missing from environment)
- `psycopg-pool==3.3.0` — installed
- `fastapi==0.161.1` — installed
- `pydantic==2.14.1` — installed (pinned from 2.12.5 due to no wheel for Python 3.15)
- `uvicorn==0.54.0` — installed
- `PyJWT[crypto]==2.11.0` — installed
- `pytest==9.1.1` — installed
- `httpx==0.28.1` — installed

**Frontend:**
- `next@16.4.3` — installed (182 packages)
- `framer-motion` — installed
- `lottie-react` — installed

## Reproduced defects

None found during test execution. All available tests pass. Defects F-01 through F-10 are architectural/infrastructure gaps confirmed by code inspection and environment checks, not by test failures.

## Untested areas

1. **PostgreSQL RLS and tenant isolation** — Cannot test without live PostgreSQL (F-01)
2. **OIDC authentication end-to-end** — Cannot test without OIDC provider and env vars (F-04)
3. **Frontend-to-backend authenticated calls** — Frontend sends no Authorization header (F-05)
4. **All external data source APIs** — None implemented (F-02)
5. **Rate limiting** — Not implemented (F-07)
6. **Migration rollback** — Not implemented (F-08)
7. **Audit events for compliance/report** — Not implemented (F-09)

## Benchmark findings

None performed. No performance benchmarks exist in the repository.