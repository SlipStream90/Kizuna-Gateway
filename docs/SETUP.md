# Setup

Use Python 3.10+ and Node 20.9+. From `backend`, install the pinned project dependencies and run `uvicorn app.main:app --reload`. From `frontend`, run `npm ci` and then `npm run dev`. Run the normal backend suite with `pytest` from `backend`.

For the full walkthrough — database, migrations, application role, environment variables, authentication and troubleshooting — see the repository `README.md`.

## Authentication in development

The API verifies bearer tokens on every `/api/v1` route. Locally there is no OIDC provider, so set `DEV_AUTH_ENABLED=1` in the backend environment; that exposes `POST /api/v1/dev/session`, which mints a short-lived HS256 token for the organisation named by `DEV_ORG_ID` (default `11111111-1111-1111-1111-111111111111`).

The web client calls it automatically (`NEXT_PUBLIC_DEV_AUTH=1`, the default) and retries once on `401`. The endpoint returns `404` when disabled and `503` when the verifier is configured for `RS256`/`ES256`. Do not enable it wherever real users authenticate.

## Disposable PostgreSQL integration check

Supply a privileged **maintenance database** URL through an environment variable (do not put a real URL in source control), then run from the repository root:

```powershell
$env:POSTGRES_MAINTENANCE_URL = '<maintenance database connection URL>'
pwsh -File backend/scripts/test-postgres-integration.ps1
```

The equivalent explicit parameter is `pwsh -File backend/scripts/test-postgres-integration.ps1 -MaintenanceDatabaseUrl '<maintenance database connection URL>'`. The wrapper generates a unique `kizuna_it_<GUID>` database, applies the migration, runs the durable round-trip test, and drops exactly that database in `finally` through the maintenance connection.

Exit code zero is valid only after a passing test and cleanup, or when PostgreSQL client tooling/service is unavailable. The permitted unavailable result is exactly `SKIPPED: PostgreSQL client tooling or service unavailable`; credentials, privileges, migration failures, and test failures are errors and return nonzero.
