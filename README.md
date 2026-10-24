# Kizuna Gateway

Kizuna Gateway is a demo-safe market-entry decision-support platform for Japanese SMEs evaluating expansion into India. It brings together four connected engines:

- **Market Intelligence** — deterministic region scoring with explicit evidence coverage
- **Partner Trust Engine** — fictional, clearly-labelled partner scorecards
- **Compliance Copilot** — curated source passages requiring human review
- **GTM Simulator** — cost/scenario modelling with visible assumptions

All regions, partners and results are deterministic offline seeds. The platform does not claim live government integrations, legal advice, or verified partner trustworthiness.

---

## Contents

1. [Repository layout](#repository-layout)
2. [Prerequisites](#prerequisites)
3. [Backend setup](#backend-setup)
4. [Frontend setup](#frontend-setup)
5. [Running the stack](#running-the-stack)
6. [Verifying the API](#verifying-the-api)
7. [Tests and checks](#tests-and-checks)
8. [Environment variable reference](#environment-variable-reference)
9. [Troubleshooting](#troubleshooting)
10. [Known limitations](#known-limitations)

---

## Repository layout

```
backend/                 FastAPI service (Python 3.10+)
  app/
    api/                 Route modules (assessments, market, partners, compliance, gtm, reports)
    auth/                OIDC bearer verification and role checks
    domain/              Pure scoring / MCDA / GTM logic
    repositories/        PostgreSQL access, tenant-scoped transactions
    schemas/             Pydantic request/response models
    seed/                Deterministic region, partner, source data
    main.py              App factory, CORS, router wiring
  migrations/            SQL migrations, applied in order with psql
  scripts/               Operational scripts (Postgres integration check)
  tests/                 pytest suite
  requirements.lock      Pinned runtime + test dependencies
frontend/                Next.js 16 / React 19 web client
  app/                   App-router pages (dashboard + report)
  components/            UI controls and views
  lib/api.ts             Typed fetch wrapper around the API
  public/videos/         Background video assets (mp4 + webm + posters)
docs/                    PRD, implementation plan, setup notes, limitations
audit/                   Product and technology review reports
.github/workflows/       CI: backend pilot tests + frontend build
```

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Python | 3.10 – 3.13 | CI runs 3.13 |
| Node.js | ≥ 20.9 | CI runs 22; `npm` ships with Node |
| PostgreSQL | 16+ | CI runs `postgres:18`; RLS policies are required |
| `psql` | matching server | Used to apply migrations |
| Git | any recent | |

Optional: Docker, if you would rather not install PostgreSQL locally.

---

## Backend setup

All commands below assume you start from the repository root.

### 1. Start PostgreSQL

With Docker (recommended for a first run):

```bash
docker run --name kizuna-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kizuna \
  -p 5432:5432 \
  -d postgres:18
```

Or use an existing local server and create a database named `kizuna`.

### 2. Install Python dependencies

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
source .venv/bin/activate
```

Then install the pinned set:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.lock
```

### 3. Apply migrations

Migrations must run **as the database owner**, in order. The second migration enables row-level security and will refuse to run against legacy tables that already contain rows.

```bash
psql "postgresql://postgres:postgres@localhost:5432/kizuna" -f backend/migrations/001_initial.sql
psql "postgresql://postgres:postgres@localhost:5432/kizuna" -f backend/migrations/002_pilot_foundation.sql
```

On Windows without `psql` on `PATH`, use the full path, e.g. `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`.

### 4. Create the application role

The API must connect as a **non-owner, non-superuser, non-BYPASSRLS** role, otherwise row-level security is bypassed and tenant isolation cannot be trusted.

```bash
psql "postgresql://postgres:postgres@localhost:5432/kizuna" -c "CREATE ROLE kizuna_app LOGIN PASSWORD 'app-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; GRANT USAGE ON SCHEMA public TO kizuna_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO kizuna_app;"
```

The same command works in PowerShell if you replace the outer double quotes with single quotes.

### 5. Configure environment

```bash
cp backend/.env.example backend/.env
```

`backend/.env` holds local-only values and is git-ignored. Minimum for a local run:

```env
DATABASE_URL=postgresql://kizuna_app:app-password@localhost:5432/kizuna
CORS_ORIGINS=http://localhost:3000
OIDC_ISSUER=https://issuer.example.test
OIDC_AUDIENCE=kizuna-pilot
OIDC_SIGNING_KEY=01234567890123456789012345678901
OIDC_JWT_ALGORITHM=HS256
```

`OIDC_SIGNING_KEY` must be **at least 32 characters** when using HS256, or every request fails with `401 OIDC verifier is not configured`.

The backend does not load `.env` automatically — export the values in your shell or use your process manager. For example:

```powershell
# Windows PowerShell
Get-Content backend/.env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+)$') { Set-Item "Env:$($matches[1])" $matches[2] }
}
```

```bash
# macOS / Linux
set -a; source backend/.env; set +a
```

### 6. Seed a demo organisation

Every assessment belongs to an organisation, and organisations are protected by RLS, so create the first one **as the owner**:

```bash
psql "postgresql://postgres:postgres@localhost:5432/kizuna" -c "INSERT INTO organizations (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Org');"
```

### 7. Run the API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

- API root: <http://localhost:8000>
- OpenAPI docs: <http://localhost:8000/docs>

---

## Frontend setup

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

The app is served at <http://localhost:3000>. `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000/api/v1`, so no change is needed for local development.

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then production build |
| `npm test` | Vitest (jsdom) |
| `npm run test:coverage` | Vitest with coverage |

Node **20.9 or newer** is required by `package.json` engines; Node 22 matches CI.

---

## Running the stack

Two terminals:

1. `cd backend && uvicorn app.main:app --reload --port 8000`
2. `cd frontend && npm run dev`

Then open <http://localhost:3000>.

---

## Verifying the API

All `/api/v1` routes require a bearer JWT whose claims match the configured issuer/audience. Mint a local development token with the same signing key:

```python
# backend/mint_dev_token.py  (local only, do not commit)
import os, time, uuid
import jwt

print(jwt.encode({
    "iss": os.environ["OIDC_ISSUER"],
    "aud": os.environ["OIDC_AUDIENCE"],
    "sub": str(uuid.uuid4()),
    "org_id": "11111111-1111-1111-1111-111111111111",
    "roles": ["admin"],
    "exp": int(time.time()) + 3600,
}, os.environ["OIDC_SIGNING_KEY"], algorithm="HS256"))
```

Run it with the environment loaded (`python mint_dev_token.py`), then smoke-test:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/market-ranking?assessment_id=<id>"
```

Create an assessment (decimal values must be **strings**, never JSON numbers):

```bash
curl -X POST http://localhost:8000/api/v1/assessments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "product": "Sensor",
        "sector": "Industrial",
        "target_customer": "OEM",
        "budget": "1000.00",
        "horizon_months": 12,
        "preferred_modes": ["direct_export"],
        "weights": {"market": "0.4", "operations": "0.3", "readiness": "0.3"}
      }'
```

`PATCH /api/v1/assessments/{id}` additionally requires an `If-Match: <version>` header.

---

## Tests and checks

### Backend

The suite needs a live PostgreSQL database and OIDC settings:

```bash
cd backend
export DATABASE_URL="postgresql://kizuna_app:app-password@localhost:5432/kizuna_test"
export PILOT_TEST_DATABASE_URL="$DATABASE_URL"
export OIDC_ISSUER="https://issuer.example.test"
export OIDC_AUDIENCE="kizuna-pilot"
export OIDC_SIGNING_KEY="01234567890123456789012345678901"
python -m pytest -q
```

```powershell
# Windows PowerShell equivalent
$env:DATABASE_URL="postgresql://kizuna_app:app-password@localhost:5432/kizuna_test"
$env:PILOT_TEST_DATABASE_URL=$env:DATABASE_URL
$env:OIDC_ISSUER="https://issuer.example.test"
$env:OIDC_AUDIENCE="kizuna-pilot"
$env:OIDC_SIGNING_KEY="01234567890123456789012345678901"
python -m pytest -q
```

Use a separate test database (`kizuna_test`) with the same migrations and app role applied, as CI does.

### Disposable PostgreSQL integration check

The wrapper creates a uniquely named `kizuna_it_<GUID>` database, applies the migration, runs the durable round-trip test, and drops only that database in `finally`:

```powershell
$env:POSTGRES_MAINTENANCE_URL = "<maintenance database connection URL>"
pwsh -File backend/scripts/test-postgres-integration.ps1
```

Exit code zero means either the test passed and cleaned up, or the tooling was unavailable with exactly `SKIPPED: PostgreSQL client tooling or service unavailable`. Credential, privilege, migration and test failures return nonzero.

### Frontend

```bash
cd frontend
npm run typecheck
npm test
npm run build
```

### CI

`.github/workflows/pilot.yml` runs both jobs on every push and pull request:

- **backend-pilot** — PostgreSQL 18 service, migrations, non-owner app role, full `pytest`
- **frontend-build** — `npm ci` then `npm run build`

Reproduce that job locally before opening a PR.

---

## Environment variable reference

| Variable | Where | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | backend | yes | — | PostgreSQL connection string for the **app role** |
| `CORS_ORIGINS` | backend | no | `http://localhost:3000` | Comma-separated allowed origins |
| `OIDC_ISSUER` | backend | yes | — | Expected JWT `iss` |
| `OIDC_AUDIENCE` | backend | yes | — | Expected JWT `aud` |
| `OIDC_SIGNING_KEY` | backend | yes | — | Verification key (≥ 32 chars for HS256) |
| `OIDC_JWT_ALGORITHM` | backend | no | `HS256` | One of `HS256`, `RS256`, `ES256` |
| `PILOT_TEST_DATABASE_URL` | tests | for tests | — | Database used by pilot integration tests |
| `POSTGRES_MAINTENANCE_URL` | script | for script | — | Privileged URL used to create/drop the temp database |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | no | `http://localhost:8000/api/v1` | API origin used by the web client |

JWT claims required: `exp`, `iss`, `aud`, `sub` (user UUID), `org_id` (organisation UUID), optional `roles` (`member`, `advisor`, `reviewer`, `admin`).

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401 OIDC verifier is not configured` | Missing OIDC env vars, or key shorter than 32 chars for HS256 | Load all four OIDC variables |
| `401 Invalid bearer token` | `iss`/`aud`/`exp` mismatch, wrong signing key, or malformed claims | Re-mint the token with matching values |
| `KeyError: 'DATABASE_URL'` at startup | Environment not loaded into the uvicorn process | Export variables in the same shell |
| Queries return empty lists unexpectedly | Connected as table owner or superuser, so RLS is bypassed/misapplied — or `app.org_id` is unset | Connect as `kizuna_app`; keep `transaction_for_org` usage |
| `002_pilot_foundation requires empty legacy assessment/report tables` | Legacy rows from `001_initial.sql` | Recreate the database and re-apply migrations |
| `relation "organizations" does not exist` | Migrations not applied | Run both migration files in order |
| CORS error in the browser | Frontend origin not allowed | Add it to `CORS_ORIGINS` |
| `npm ci` engine warning / failure | Node older than 20.9 | Upgrade to Node 22 |
| `psql` not found on Windows | Not on `PATH` | Use the full path under `C:\Program Files\PostgreSQL\<ver>\bin` |
| Port 8000/3000 already in use | Another process | Pass `--port` to uvicorn or `PORT` to Next |

---

## Known limitations

- The web client (`frontend/lib/api.ts`) does **not** attach a bearer token yet, so UI calls against the authenticated API return `401`. Use the minted token with `curl` or `/docs` until auth wiring lands.
- All partner, compliance and market data is deterministic seed data. Partners are fictional and never verified; compliance passages require human review and do not establish legal, customs, tariff, origin, CEPA or classification outcomes.
- No live government integrations or external credentials are required or used.
- Background video files (~33 MB) are **not committed**; see `frontend/public/videos/README.md` to restore them. The UI renders a gradient fallback without them.
- `docs/SETUP.md` holds the shorter operational notes; this README is the full setup guide.