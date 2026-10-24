# Technology Review — Kizuna Gateway

**Date of review:** 2026-10-24

## Current technology stack

| Layer | Technology | Version | Support Status |
|-------|-----------|---------|----------------|
| Backend language | Python | 3.15.1 | Current (CPython 3.15) |
| Backend framework | FastAPI | 0.161.1 | Active, maintained |
| ASGI server | uvicorn | 0.54.0 | Active, maintained |
| Data validation | Pydantic | 2.14.1 | Active (pinned from 2.12.5 due to no wheel for 3.15) |
| Database driver | psycopg[binary] | 3.3.6 | Active, maintained |
| Connection pool | psycopg-pool | 3.3.0 | Active, maintained |
| JWT | PyJWT[crypto] | 2.11.0 | Active, maintained |
| Testing | pytest | 9.1.1 | Active, maintained |
| HTTP client | httpx | 0.28.1 | Active, maintained |
| Frontend framework | Next.js | 16.4.3 | Active, maintained |
| React | React | 19.3.1 | Active, maintained |
| Styling | Tailwind CSS | 4.3.3 | Active, maintained |
| Animations | framer-motion | latest | Active, maintained |
| Testing | vitest | 4.1.12 | Active, maintained |

## Architecture review

**Current:** Modular monolith — FastAPI backend + Next.js frontend + PostgreSQL database. All API routes under `/api/v1` with OIDC bearer authentication. PostgreSQL RLS for tenant isolation.

**Appropriateness:** A modular monolith is the correct choice for an MVP with a single team. No microservices, no message queues, no complex orchestration needed. The workload (deterministic calculations, seeded data, low concurrency) does not justify distributed architecture.

**Alternatives considered:**
- Microservices: Rejected — unnecessary operational complexity for MVP workload.
- Serverless functions: Rejected — cold starts and connection management add complexity without benefit.
- Single-page frontend (Vite): Rejected — Next.js provides SSR/SSG which is appropriate for report rendering.

## Frontend technology review

**Current:** Next.js 16.4.3 with `webpackBuildWorker: false` to avoid `spawn EPERM` on Windows sandbox. Tailwind CSS v4. framer-motion for animations.

**Build issue resolved:** `next.config.ts` sets `webpackBuildWorker: false` with comment explaining Windows sandbox blocks child-process creation. Production build completes in ~6 seconds.

**Assessment:** Stack is current and appropriate. No changes needed.

## Backend technology review

**Current:** Python 3.15.1 with FastAPI 0.161.1, psycopg-binary 3.3.6.

**Issue:** `requirements.lock` originally specified `pydantic==2.12.5` which has no pre-built wheel for Python 3.15 on Windows. Build fails with Rust linker error. Fixed by pinning to `pydantic==2.14.1` which has a compatible wheel.

**Assessment:** All packages are actively maintained. No deprecated APIs found. The pydantic pin is a pragmatic fix; should be revisited when a 2.12.5 wheel for 3.15 becomes available.

## Data source research results

| Source | Official URL | Access Method | Status | License Terms |
|--------|-------------|---------------|--------|---------------|
| India Industrial Land Bank | https://www.indiaindustriallandbank.gov.in/ | Web portal, API docs (IIS_API_Doc_V2.3.5.pdf) | Documented; not implemented | Government data (ODGL-India likely applies) |
| DGFT IEC / ITC-HS | https://www.dgft.gov.in/ | Web portal | Documented; not implemented | Government data |
| Open Government Data Platform | https://data.gov.in/ | API catalog | Documented; not implemented | Government Open Data License - India |
| Bureau of Indian Standards | https://www.bis.gov.in/ | Web portal, QCO list | Documented; not implemented | Government data |
| India-Japan CEPA | https://www.mofa.go.jp/region/asia-paci/india/epa201102/index.html | Treaty text, tariff schedules | Documented; not implemented | Public treaty text |
| Japan Customs Tariff | https://www.customs.go.jp/english/tariff/ | Tariff schedule by HS chapter | Documented; not implemented | Government data |

**Key CEPA facts (verified via multiple sources):**
- India-Japan Comprehensive Economic Partnership Agreement in force since 1 August 2011
- ~94% of traded goods at 0% tariff as of 2021 (fully phased in)
- Rules of Origin: Change in Tariff Heading (CTH) + Regional Value Content ≥ 35% (typical)
- Certificate of Origin issued by EIA (Export Inspection Agency)

**Key BIS facts (verified):**
- 187 Quality Control Orders covering 769 products under compulsory certification (as of March 2025)
- Products include electronics, electrical appliances, toys, tyres, etc.
- Mandatory BIS/ISI mark required for manufacture, import, distribution, sale

## Security technology review

**Authentication:** OIDC bearer JWT with PyJWT. Algorithm restricted to HS256/RS256/ES256 (not header-selected). HS256 requires key ≥ 32 bytes. Claims require `exp`, `iss`, `aud`, `sub`, `org_id`.

**Assessment:** Sound implementation for the auth layer itself. However, OIDC environment variables are not configured (F-04), making the entire auth layer non-functional in practice.

**Authorization:** Tenant-scoped via `org_id` in JWT claims + PostgreSQL RLS policies. `PilotRepository` adds explicit `org_id` predicates to every query. Defense in depth.

**Assessment:** Authorization model is correct. Cannot be tested end-to-end without live DB (F-01) and OIDC config (F-04).

## Infrastructure technology review

**Containerization:** No Dockerfile, no docker-compose, no Kubernetes manifests found.

**CI:** `.github/workflows/pilot.yml` exists — PostgreSQL 18 service container, applies migrations, creates app role, runs pytest, frontend `npm ci` + `npm run build`.

**Assessment:** CI configuration exists but has not been exercised locally (no Docker). No production deployment configuration found.

## Final recommendations

| Technology | Recommendation | Reason |
|------------|---------------|--------|
| Python 3.15 | Keep | Current, all packages compatible |
| FastAPI | Keep | Actively maintained, appropriate for MVP |
| PostgreSQL 18 | Keep | Required for RLS + pgcrypto |
| psycopg-binary | Keep | Properly maintained, wheels available |
| Next.js 16 | Keep | Current, build works |
| Tailwind v4 | Keep | Current, appropriate |
| framer-motion | Keep | Active, appropriate for animations |
| Docker | Add | Needed for reproducible local DB and CI |
| LLM provider | Do not add yet | No product justification; remove "AI-powered" claims instead |
| Microservices | Do not add | No workload justification |