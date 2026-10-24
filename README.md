# Kizuna Gateway

Kizuna Gateway is a demo-safe market-entry decision-support platform for Japanese SMEs evaluating expansion into India. It brings together four connected engines:

- **Market Intelligence** — deterministic region scoring with explicit evidence coverage
- **Partner Trust Engine** — fictional, clearly-labelled partner scorecards
- **Compliance Copilot** — curated source passages requiring human review
- **GTM Simulator** — cost/scenario modelling with visible assumptions

All regions, partners and results are deterministic offline seeds. The platform does not claim live government integrations, legal advice, or verified partner trustworthiness.

## Contents

1. [Repository layout](#repository-layout)
2. [AI features in use](#ai-features-in-use)
3. [Prerequisites](#prerequisites)
4. [Backend setup](#backend-setup)
5. [Frontend setup](#frontend-setup)
6. [Running the stack](#running-the-stack)
7. [Authentication](#authentication)
8. [AI/STS speech-to-speech endpoint](#ai-sts-speech-to-speech-endpoint)
9. [Verifying the API](#verifying-the-api)
10. [Tests and checks](#tests-and-checks)
11. [Environment variable reference](#environment-variable-reference)
12. [Deployment (DigitalOcean + Vercel)](#deployment-digitalocean--vercel)
13. [Troubleshooting](#troubleshooting)
14. [Known limitations](#known-limitations)

---

## Repository layout

```
backend/                 FastAPI service (Python 3.10+)
  app/
    api/                 Route modules (assessments, market, partners, compliance, gtm, reports, dev, translate, speech)
    auth/                OIDC bearer verification, key resolution, role checks
    domain/              Pure scoring / MCDA / GTM logic
    repositories/        PostgreSQL access, tenant-scoped transactions
    schemas/             Pydantic request/response models
    services/            Business services (speech_service: liquid-audio LFM2.5-Audio-JP)
    seed/                Deterministic region, partner, source data
    main.py              App factory, CORS, router wiring
  migrations/            SQL migrations, applied in order with psql
  scripts/               Operational scripts (Postgres integration check)
  tests/                 pytest suite
  requirements.lock      Pinned runtime + test dependencies
  Dockerfile             Backend container image
frontend/                Next.js 16 / React 19 web client
  app/
    api/auth/            Login, callback, logout and read-only session routes
    api/v1/[...]         BFF proxy that attaches the bearer token server-side
    page.tsx             App-router home page with translation and speech sections
  components/            UI controls and views (translation-controls, speech-controls)
  lib/api.ts             Typed fetch wrapper around the API
  auth.ts                PKCE, token exchange, session cookie sealing
  public/videos/         Background video assets (mp4 + webm + posters)
docs/                    PRD, implementation plan, setup notes, limitations
infra/keycloak/          Realm export imported by docker compose
audit/                   Product and technology review reports
.github/workflows/       CI: backend pilot tests + frontend build
compose.yaml             Local Docker Compose (Keycloak, Postgres, backend)
DEPLOY.md                Production deployment guide
```

---

## AI features in use

Kizuna Gateway includes two AI/STS capabilities behind bearer-protected endpoints. Both degrade to a clearly-labelled deterministic illustrative fallback when no model is available, so nothing is ever presented as verified business content.

### 1. Japanese ↔ English text translation

`POST /api/v1/translate`

Accepts `{ text, source_lang, target_lang }` (only `ja`/`en` pairs). The backend optionally lazy-loads Meta's **NLLB-200 distilled-600M** model via `transformers`. When the model or `torch` are unavailable, it returns a deterministic illustrative placeholder prefixed with `[ja->en::illustrative]`. Every response states the provider (`nllb-200` or `deterministic-fallback`) and whether fallback was used.

### 2. Japanese speech → English speech-to-speech (STS)

`POST /api/v1/speech/translate`

Accepts a base64-encoded audio blob captured from the browser microphone. Delegates to **LiquidAI's `LFM2.5-Audio-1.5B-JP`** run through the `liquid-audio` Python pipeline (`LFM2AudioModel`, `LFM2AudioProcessor`, `ChatState`, `generate_interleaved`). The model natively performs end-to-end speech-to-speech — Japanese audio in, interleaved English text and English audio out — with no separate ASR/TTS components.

The response includes `transcript`, `translated_text`, and `output_audio_base64` (WAV-encoded English audio) when the model is active. Falls back to an illustrative placeholder when `torch`, `liquid-audio`, or the model weights are not installed.

**Installing the optional model stack:**

```bash
# CPU
pip install liquid-audio soundfile torch

# CUDA (faster inference on NVIDIA GPUs)
pip install liquid-audio soundfile torch --index-url https://download.pytorch.org/whl/cu118
```

Set `LFM_MODEL_ID` in `backend/.env` to override the model ID. Nothing reaches the public internet by default; model loading requires an HF download on first run.

### How AI flows through auth

Both AI endpoints are behind the same bearer flow as the rest of the API:

1. User signs in via OIDC (Authorization Code + PKCE).
2. Tokens are sealed in an encrypted HttpOnly session cookie — **the access token never reaches the browser**.
3. The Next.js BFF proxy forwards `/api/v1/translate` and `/api/v1/speech/translate` with `Authorization: Bearer <token>` server-side.
4. FastAPI verifies the JWT (iss, aud, exp, sub, org_id) before the AI service runs.

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
Optional AI stack: `liquid-audio`, `soundfile`, `torch` (see [AI features in use](#ai-features-in-use)).

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
  -d pgvector/pgvector:pg18
```

`pgvector/pgvector:pg18` is the official `postgres:18` image plus the [pgvector](https://github.com/pgvector/pgvector) extension, which migration 003 (statutory search) needs. Or use an existing local server with pgvector installed and create a database named `kizuna`.

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
psql "postgresql://postgres:postgres@localhost:5432/kizuna" -f backend/migrations/003_statutory_chunks.sql
psql "postgresql://postgres:postgres@localhost:5432/kizuna" -f backend/migrations/004_partner_registry.sql
```

003 creates `statutory_chunks` (public statutory text with `vector(384)` embeddings). It is shared by all tenants, so it is deliberately not row-level-security scoped; the application role needs only `SELECT` on it. See [Statutory search (RAG)](#statutory-search-rag).

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
DEV_AUTH_ENABLED=1
DEV_ORG_ID=11111111-1111-1111-1111-111111111111
LFM_MODEL_ID=LiquidAI/LFM2.5-Audio-1.5B-JP
```

`OIDC_SIGNING_KEY` must be **at least 32 characters** when using HS256, or every request fails with `401 OIDC verifier is not configured`. `DEV_AUTH_ENABLED=1` lets the web client mint its own token; see [Authentication](#authentication).

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
| `npm run test:e2e` | Playwright end-to-end tests (requires dev server on port 3000) |

Node **20.9 or newer** is required by `package.json` engines; Node 22 matches CI.

---

## Running the stack

Two terminals:

1. `cd backend && uvicorn app.main:app --reload --port 8000`
2. `cd frontend && npm run dev`

Then open <http://localhost:3000>.

---

## Authentication

Every `/api/v1` route except `/api/v1/dev/session` requires a bearer JWT whose claims match the configured issuer and audience. There are two supported paths.

### Real login (Keycloak, or any OIDC issuer)

The product flow uses Authorization Code + PKCE, and the access token never touches the browser. The Next.js BFF proxy seals the tokens in an encrypted HttpOnly cookie and forwards each `/api/v1` request with `Authorization: Bearer <token>` server-side.

1. Start Keycloak (and Postgres if you have not installed it locally):

   ```bash
   docker compose up -d
   ```

   This imports the `kizuna` realm, the `kizuna-web` client and the demo user `demo / kizuna-demo-2026` from `infra/keycloak/realm-export.json`. The realm maps realm roles onto a flat `roles` claim, the tenant onto `org_id`, and the audience `kizuna-pilot` onto access tokens.

2. Point the two stacks at the issuer:

   | Layer      | Key                    | Example                                   |
   | ---------- | ---------------------- | ----------------------------------------- |
   | backend    | `OIDC_ISSUER`          | `http://localhost:8080/realms/kizuna`             |
   | backend    | `OIDC_AUDIENCE`        | `kizuna-pilot`                            |
   | backend    | `OIDC_JWT_ALGORITHM`   | `RS256`                                   |
   | backend    | `DEV_AUTH_ENABLED`     | `0` (or unset)                            |
   | backend    | `OIDC_ORG_CLAIM`       | `org_id` (the realm maps it)              |
   | backend    | `OIDC_ROLES_CLAIM`     | `roles` (the realm maps it)               |
   | frontend   | same issuer/audience   | same values in `frontend/.env.local`      |
   | frontend   | `OIDC_CLIENT_ID/SECRET`| `kizuna-web` / `kizuna-web-dev-secret`    |
   | frontend   | `AUTH_SESSION_SECRET`  | `openssl rand -base64 32` (not committed) |

   Copy `frontend/.env.example` to `frontend/.env.local` — the checked-in example already carries these values.

3. Sign in: open http://localhost:3000, click **Sign in**, log in as `demo / kizuna-demo-2026`. The nav shows the email and a **Sign out** link. Sessions expose only name/roles/expiry at `GET /api/auth/session`; tokens stay in the encrypted `kizuna_session` cookie.

Backend behaviour worth knowing:

- RS256/ES256 keys come from the issuer's JWKS endpoint (`OIDC_JWKS_URL`, or discovered at `<issuer>/.well-known/openid-configuration`). Unknown `kid`s refresh the cached key set automatically; unreachable providers surface as `503` (token refresh, not credential loss).
- `OIDC_ORG_CLAIM` supports dotted paths (`realm_access.kizuna-web.roles`) for IdPs that nest tenants. Unknown role strings are ignored rather than failing the session.
- `GET /api/v1/dev/session` only responds when `DEV_AUTH_ENABLED=1`, so it stays inert in real deployments.

### No provider locally

Set `DEV_AUTH_ENABLED=1` on the backend — that exposes `POST /api/v1/dev/session`, which mints a short-lived HS256 token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/dev/session | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
```

Guards built into the endpoint:

- returns `404` unless `DEV_AUTH_ENABLED` is truthy, so it does not advertise itself in deployed environments
- refuses to mint (`503`) when `OIDC_JWT_ALGORITHM` is `RS256`/`ES256`
- refuses to mint when the signing key is shorter than 32 characters
- token lifetime is capped at 24 hours; tokens default to `admin` on `DEV_ORG_ID`

The BFF proxy consumes it automatically when `DEV_AUTH_FALLBACK=1` in the Next.js environment: UI calls keep working without a login, because the proxy mints a dev token server-side. This is the pre-OIDC behaviour kept for quick demos, not a production mode. Never enable `DEV_AUTH_ENABLED` where real users authenticate.

---

## AI/STS speech-to-speech endpoint

The speech-to-speech endpoint accepts microphone audio captured by the frontend `SpeechControls` component:

1. User clicks **Record Japanese audio** in the browser.
2. `MediaRecorder` captures WebM audio; the blob is base64-encoded and POSTed to `/api/v1/speech/translate` through the BFF proxy (token stays server-side).
3. The backend calls `LiquidAI/LFM2.5-Audio-1.5B-JP` via `liquid-audio`'s interleaved generation.
4. The response returns English transcript, translated text, and base64-encoded WAV audio for playback.
5. If no local model is running and `torch`/`liquid-audio` are absent, the endpoint returns a deterministic illustrative placeholder.

### Local STS with tunnel (dev only)

If you want to run STS on your PC and have the Droplet backend call it:

```bash
# On your PC
cd backend
uvicorn app.main:app --port 8001

# Expose locally
ngrok http 8001
# or: cloudflared tunnel --url http://localhost:8001
```

Then set on the Droplet backend:
```env
LFM_ENDPOINT=https://<tunnel-url>
```

---

## Statutory search (RAG)

Clause-level semantic search over official statutory PDFs (RBI Master Directions, DPIIT FDI Policy, FEMA NDI Rules, Companies Act, PLI guidelines), returning exact clause references for Ringi-sho citations. Code lives in `backend/app/rag/`.

1. **Install** the optional dependencies: `pip install -r backend/requirements-rag.txt` (pypdf, sentence-transformers).
2. **Add documents**: put PDFs in `backend/data/documents/` and copy `manifest.example.json` to `manifest.json` (title, code, citation style, source URL, verification date). PDFs are git-ignored.
3. **Check parsing**: `python -m app.rag.ingest --dry-run --show 10` (from `backend/`) prints the detected clauses and page ranges, without a model or database.
4. **Ingest**: `python -m app.rag.ingest` embeds every chunk and atomically replaces that document's rows. Writes use `RAG_INGEST_DATABASE_URL` (a role with INSERT/DELETE), falling back to `DATABASE_URL`.
5. **Search**: `POST /api/v1/compliance/search` (bearer auth)

```json
{ "query": "FC-GPR filing timeline for auto components", "k": 5, "document_codes": ["RBI-MD-FI"], "lang": "en" }
```

Each result carries `clause_reference` (e.g. `Paragraph 4.2`), `citation_id` (`RBI-MD-FI/Paragraph 4.2`), the formatted `citation` (`[RBI Master Direction (FI), Paragraph 4.2]`; `lang: "ja"` gives `［…、パラグラフ4.2］`), cosine `similarity`, page range, and a `badge` payload for the JIG-OS citation component; `citation_index` is ready for the Ringi-sho. The existing `GET /api/v1/compliance/search` (assessment-scoped curated passages) is unchanged.

- **Embeddings** run locally with `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384-d), so Japanese questions retrieve English clauses and no text leaves the server. `RAG_EMBEDDING_BACKEND=hashing` swaps in a deterministic lexical embedder for tests/offline use; responses then report `"semantic": false`.
- **Chunking** follows the document's own numbering (Chapter / Part / Schedule, `149.` or `4.2`), splitting long units at sub-clause markers so references stay exact (`Section 149(3)(a)`). Scanned PDFs without a text layer are rejected; OCR them first.
- Search results are retrieval only: every response is `review_required` and nothing is presented as legal advice.

**Grounded answers (RAG generation)**: `POST /api/v1/compliance/answer` takes the same body and returns an answer written only from the retrieved clauses, used by JIG-OS's *Ask the Statutes* screen and the Ringi-sho's *Regulatory Analysis* section.

- Weak retrieval (top cosine similarity below `RAG_MIN_EVIDENCE_SIMILARITY`, default `0.35`) returns `insufficient_evidence` without calling the model.
- A Groq-hosted model (`RAG_GENERATION_MODEL`, default `openai/gpt-oss-120b`; strict JSON-schema output) receives only the retrieved clauses and must cite them per paragraph; the server drops paragraphs citing nothing retrieved and flags any figure not found in the cited text (`figures_verified: false`).
- Needs `GROQ_API_KEY` in the API's environment. Without it the endpoint still returns the retrieved clauses with `status: "generation_unavailable"`; refusals, timeouts and malformed output likewise never produce an answer. Keep the key in `backend/.env` (git-ignored) and export it before starting uvicorn.

## Partner Trust & Verification

A screened directory of Indian distributors, suppliers and JV partners with a deterministic **Japan-Readiness & Trust Score** (0–100), shown in JIG-OS screen 05 (`/jig-os?screen=partners`). Code: `backend/app/domain/partner_trust.py` (scoring), `backend/app/seed/partner_registry.py` (fixtures), migration `004_partner_registry.sql`.

- **Load fixtures:** `python -m app.seed.load_partner_registry` (from `backend/`, idempotent).
- **`GET /api/v1/partners`**: the directory, filterable by `sector`, `state`, `min_otd` and `min_trust_score`. With `assessment_id` it keeps its previous behaviour (partners shortlisted for that assessment, tenant-scoped).
- **`POST /api/v1/partners/{id}/audit-score`**: component breakdown, flags, evidence links, the source record, `scoring_version` and an `inputs_hash` (same hash → same score).
- **Weights:** MCA compliance & filing 15 · GSTN regularity 15 · litigation 10 · ISO 9001/14001 10 · creditworthiness 15 · on-time delivery & fulfilment 20 · cross-border record & principal satisfaction 15. Decimal arithmetic, half-up rounding per component.
- **Hard gates:** a struck-off/liquidating company or cancelled GST registration is `blocked` (score capped at 25); pending major tax/corporate litigation is `not_recommended` (capped at 49); a high credit-risk rating can never be labelled `japan_ready`. Strong operational metrics never lift a partner over a gate.
- **Data:** every shipped record is a **simulated fixture** (`record_source = simulated_fixture`), with identifiers no real entity can hold (CIN state code `ZZ`, GSTIN state code `00`, names marked "(fictional)"). No MCA or GSTN registry is integrated; evidence links point to the public portals and say the record will not be found there.

## Verifying the API

Beyond the dev session above, you can mint a token manually with the same signing key:

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

Create an assessment (decimal values must be **strings**, never JSON numbers, and `modes` accepts `direct` or `distributor`):

```bash
curl -X POST http://localhost:8000/api/v1/assessments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "product": "Sensor",
        "sector": "Industrial",
        "buyer": "OEM",
        "budget": "1000.00",
        "horizon_months": 12,
        "modes": ["direct"]
      }'
```

`PATCH /api/v1/assessments/{id}` additionally requires an `If-Match: <version>` header.

### Translate smoke test

```bash
curl -X POST http://localhost:8000/api/v1/translate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは","source_lang":"ja","target_lang":"en"}'
```

### Speech smoke test

POST a base64-encoded WAV blob to `/api/v1/speech/translate` with the same bearer header.

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
| `DEV_AUTH_ENABLED` | backend | for local UI | unset (`404`) | Enables `POST /api/v1/dev/session` |
| `DEV_ORG_ID` | backend | no | `11111111-1111-1111-1111-111111111111` | Organisation the dev token is scoped to |
| `DEV_TOKEN_TTL_SECONDS` | backend | no | `3600` | Dev token lifetime, clamped to 60–86400 |
| `OIDC_JWKS_URL` | backend | no | discovered | Public keys endpoint for `RS256`/`ES256` |
| `OIDC_ORG_CLAIM` | backend | no | `org_id` | Org claim; supports dotted paths |
| `OIDC_ROLES_CLAIM` | backend | no | `roles` | Roles claim; supports dotted paths |
| `OIDC_LEEWAY_SECONDS` | backend | no | `60` | Clock-skew tolerance for `exp` |
| `LFM_MODEL_ID` | backend | no | `LiquidAI/LFM2.5-Audio-1.5B-JP` | Liquid AI speech model ID |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | no | `/api/v1` | Same-origin BFF proxy, or an absolute origin to call the API directly |
| `OIDC_ISSUER` | frontend | for login | `http://localhost:8080/realms/kizuna` | Issuer for redirect and refresh calls |
| `OIDC_CLIENT_ID` | frontend | for login | `kizuna-web` | Client used by the BFF redirect |
| `OIDC_CLIENT_SECRET` | frontend | for login | — | BFF only; never sent to the browser |
| `APP_URL` | frontend | for login | `http://localhost:3000` | Origin for redirect and callback URLs |
| `AUTH_SESSION_SECRET` | frontend | for login | — | ≥32 chars; seals the session cookie |
| `API_ORIGIN` | frontend | no | `http://localhost:8000` | Where the BFF proxy forwards requests |
| `DEV_AUTH_FALLBACK` | frontend | no | `0` | `1` lets the proxy mint a dev token when no session exists |
| `COOKIE_SECURE` | frontend | no | `0` | Set `1` when terminating TLS locally |

JWT claims required: `exp`, `iss`, `aud`, `sub` (user UUID), the org claim (`org_id` by default), optional `roles` (`member`, `advisor`, `reviewer`, `admin`). The realm maps those claims for you.

---

## Deployment (DigitalOcean + Vercel)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com), sign in with GitHub.
2. Add New → Project → import `SlipStream90/Kizuna-Gateway`.
3. Framework preset: **Next.js**. Build command: `npm run build`. Root directory: `.`.
4. Add environment variables from `frontend/.env.local` (`NEXT_PUBLIC_API_BASE_URL`, `APP_URL`, `OIDC_*`, `AUTH_SESSION_SECRET`, `API_ORIGIN`, `DEV_AUTH_FALLBACK`, `COOKIE_SECURE`).
5. Deploy. Note the URL (e.g. `https://kizuna-gateway.vercel.app`).

### Backend → DigitalOcean Droplet

1. Create a Droplet (Ubuntu 22.04, s-2vcpu-4gb or larger, your region) with your SSH key.
2. SSH in: `ssh root@<droplet-ip>`.
3. Install Docker: `curl -fsSL https://get.docker.com | sh && usermod -aG docker $USER && newgrp docker`.
4. Clone the repo: `git clone https://github.com/SlipStream90/Kizuna-Gateway.git && cd Kizuna-Gateway`.
5. Create `backend/.env` on the Droplet (see [Environment variable reference](#environment-variable-reference)); set `CORS_ORIGINS` to your Vercel URL.
6. Run `docker compose up -d` (Keycloak, Postgres, Backend).
7. Apply migrations and create the `kizuna_app` role (see [Backend setup](#backend-setup), steps 3–6).
8. Set `NEXT_PUBLIC_API_BASE_URL` on Vercel to `https://<droplet-ip>:8000/api/v1` and redeploy.

### STS on the Droplet (recommended)

Add a `sts` service to `compose.yaml` running `liquid-audio` with a persistent HF cache volume, or run STS on your PC and expose it via Cloudflare Tunnel / ngrok, setting `LFM_ENDPOINT` on the Droplet backend.

See `DEPLOY.md` for the full deployment guide.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401 OIDC verifier is not configured` | Missing OIDC env vars, or key shorter than 32 chars for HS256 | Load all four OIDC variables |
| `401 Invalid bearer token` | `iss`/`aud`/`exp` mismatch, wrong signing key, or malformed claims | Re-mint the token with matching values |
| UI shows `401` while `curl` works | `DEV_AUTH_ENABLED` unset, so `/dev/session` returns `404`, or `NEXT_PUBLIC_DEV_AUTH=0` | Enable dev sessions and restart uvicorn |
| UI shows `401` after signing in | `API_ORIGIN` points at the wrong API, or `DEV_AUTH_FALLBACK=0` with no session | Set `API_ORIGIN=http://localhost:8000` |
| `503 Signing keys unavailable` | Keycloak is not running, or discovery returned no `jwks_uri` | `docker compose up -d`, or set `OIDC_JWKS_URL` |
| Callback redirects to `/` with `State mismatch` | Login was started on a different `APP_URL`, or cookies were dropped | Keep `APP_URL` identical in the browser and the callback |
| Backend returns `401 Invalid bearer token` right after login | Issuer, audience, or algorithm differs between frontend and backend | Mirror the `OIDC_*` values on both sides |
| `401 Invalid bearer token` only for the UI | Access token audience is missing the API audience | Confirm the realm emits `kizuna-pilot` (the `kizuna` scope) |
| Refresh loops / repeated logins | Refresh token rejected or expired | Sign out and in again; check the realm `offline_access` scope is off |
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

- Login is Authorization Code + PKCE, with tokens held only in an encrypted server-side session cookie — access tokens never reach the browser.
- The assessment form still posts the legacy payload shape, so creating an assessment from the UI may fail until it is updated to `product / sector / buyer / budget / horizon_months / modes`.
- `GET /api/auth/session` publishes only name, roles and expiry; it never returns tokens.
- All partner, compliance and market data is deterministic seed data. Partners are fictional and never verified; compliance passages require human review and do not establish legal, customs, tariff, origin, CEPA or classification outcomes.
- No live government integrations or external credentials are required or used.
- Background video files (~33 MB) are **not committed**; see `frontend/public/videos/README.md` to restore them. The UI renders a gradient fallback without them.
- `docs/SETUP.md` holds the shorter operational notes; this README is the full setup guide.
- AI translation and speech-to-speech are illustrative unless the respective models are installed and reachable; fallbacks are clearly marked and not verified content.
