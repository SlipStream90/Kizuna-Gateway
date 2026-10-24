# Deployment Guide

## Quick start (Docker Compose)

```bash
# 1. Generate a session secret (32+ bytes, base64)
openssl rand -base64 32

# 2. Copy env files and fill in secrets
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Start the stack
docker compose up -d

# 4. Open http://localhost:3000 and sign in as demo/kizuna-demo-2026
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| Keycloak | 8080 | OIDC identity provider |
| PostgreSQL | 5432 | Tenant-isolated database |
| Backend (FastAPI) | 8000 | API with bearer OIDC verification |
| Frontend (Next.js) | 3000 | Web client with BFF proxy |

## Speech-to-speech (LFM2.5-Audio-JP)

The backend uses Liquid AI's `liquid-audio` pipeline with `LiquidAI/LFM2.5-Audio-1.5B-JP` for Japanese speech-to-speech translation. Install the optional dependencies:

```bash
# CPU
pip install liquid-audio soundfile torch

# CUDA (faster inference)
pip install liquid-audio soundfile torch --index-url https://download.pytorch.org/whl/cu118
```

Set `LFM_MODEL_ID` in `backend/.env` to override the model. When the model or torch are unavailable, the endpoint returns a deterministic illustrative fallback so the site stays functional offline.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `OIDC_ISSUER` | yes | Expected JWT issuer |
| `OIDC_AUDIENCE` | yes | Expected JWT audience |
| `OIDC_JWT_ALGORITHM` | no | `HS256`, `RS256`, or `ES256` (default `HS256`) |
| `OIDC_JWKS_URL` | no | Public keys endpoint (auto-discovered if unset) |
| `OIDC_ORG_CLAIM` | no | Org claim path (default `org_id`) |
| `OIDC_ROLES_CLAIM` | no | Roles claim path (default `roles`) |
| `DEV_AUTH_ENABLED` | no | Enable dev token minting (`1` for local only) |
| `LFM_MODEL_ID` | no | Liquid AI model ID (default `LiquidAI/LFM2.5-Audio-1.5B-JP`) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SESSION_SECRET` | yes | 32+ char secret for session cookie sealing |
| `OIDC_CLIENT_ID` | no | OIDC client ID (default `kizuna-web`) |
| `OIDC_CLIENT_SECRET` | no | OIDC client secret |
| `API_ORIGIN` | no | Backend origin for BFF proxy (default `http://localhost:8000`) |
| `DEV_AUTH_FALLBACK` | no | Allow backend dev token fallback (`1` for local only) |
| `COOKIE_SECURE` | no | Set `1` when terminating TLS |

## Database setup

Apply migrations before first use:

```bash
psql "$DATABASE_URL" -f backend/migrations/001_initial.sql
psql "$DATABASE_URL" -f backend/migrations/002_pilot_foundation.sql
psql "$DATABASE_URL" -c "CREATE ROLE kizuna_app LOGIN PASSWORD 'app-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;"
psql "$DATABASE_URL" -c "GRANT USAGE ON SCHEMA public TO kizuna_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO kizuna_app;"
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Org');"
```

## Tests

```bash
# Backend
cd backend
python -m pytest -q

# Frontend
cd frontend
npm run typecheck
npm test
npm run test:e2e    # requires the dev server running on localhost:3000
```

## Production notes

- Never enable `DEV_AUTH_ENABLED` where real users authenticate.
- Set `COOKIE_SECURE=1` when terminating TLS.
- Use a real OIDC provider (not Keycloak dev mode) in production.
- All partner/compliance data is deterministic seed data — not verified for business decisions.
