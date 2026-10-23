# Setup

Use Python 3.10+ and Node 20.9+. From `backend`, install the pinned project dependencies and run `uvicorn app.main:app --reload`. From `frontend`, run `npm ci` and then `npm run dev`. Run the normal backend suite with `pytest` from `backend`.

## Disposable PostgreSQL integration check

Supply a privileged **maintenance database** URL through an environment variable (do not put a real URL in source control), then run from the repository root:

```powershell
$env:POSTGRES_MAINTENANCE_URL = '<maintenance database connection URL>'
pwsh -File backend/scripts/test-postgres-integration.ps1
```

The equivalent explicit parameter is `pwsh -File backend/scripts/test-postgres-integration.ps1 -MaintenanceDatabaseUrl '<maintenance database connection URL>'`. The wrapper generates a unique `kizuna_it_<GUID>` database, applies the migration, runs the durable round-trip test, and drops exactly that database in `finally` through the maintenance connection.

Exit code zero is valid only after a passing test and cleanup, or when PostgreSQL client tooling/service is unavailable. The permitted unavailable result is exactly `SKIPPED: PostgreSQL client tooling or service unavailable`; credentials, privileges, migration failures, and test failures are errors and return nonzero.
