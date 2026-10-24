# Quick Wins — Kizuna Gateway

Improvements completable in a few hours or less, with concrete code locations and verification steps.

---

## QW-01: Pin pydantic to compatible version in requirements.lock

**Location:** `backend/requirements.lock:4`
**Current:** `pydantic==2.12.5`
**Problem:** No pre-built wheel for pydantic-core 2.41.5 on Python 3.15 Windows. Build fails with Rust linker error.
**Fix:** Change to `pydantic==2.14.1` (has compatible wheel). Add comment explaining the pin.
**Verification:** `python -m pip install -r backend/requirements.lock` succeeds without build errors.
**Time:** 5 minutes.

---

## QW-02: Add OIDC environment variables to .env.example

**Location:** `backend/.env.example`
**Current:** Only `DATABASE_URL` and `CORS_ORIGINS`
**Problem:** `require_principal()` raises 401 "OIDC verifier is not configured" without `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_SIGNING_KEY`, `OIDC_JWT_ALGORITHM`.
**Fix:** Add the four OIDC variables with placeholder values and a comment that they are required for authentication.
**Verification:** `python -c "from app.auth.dependencies import _settings; print(_settings())"` returns tuple without empty strings when env vars set.
**Time:** 10 minutes.

---

## QW-03: Add role="region" to ReportView section

**Location:** `frontend/components/report-view.tsx:14`
**Current:** `<section className="glass-panel p-6 rounded-2xl space-y-6 print:text-black">`
**Problem:** Test `findByRole('region', { name: 'Consolidated market-entry report' })` cannot find the section because `aria-label` alone doesn't map to `region` role in jsdom accessibility tree.
**Fix:** Add `role="region"` attribute alongside existing `aria-label`.
**Verification:** `npm test` passes `test/report-view.test.tsx`.
**Time:** 2 minutes.

---

## QW-04: Add rate limiting comment/placeholder in main.py

**Location:** `backend/app/main.py`
**Current:** No rate limiting middleware
**Problem:** No protection against API abuse (F-07).
**Fix:** Add a TODO comment with a reference to implementing rate limiting middleware before production. Not a functional fix but documents the gap.
**Verification:** Code review confirms the gap is documented.
**Time:** 2 minutes.

---

## QW-05: Add migration version tracking table comment

**Location:** `backend/migrations/002_pilot_foundation.sql`
**Current:** No schema_migrations table
**Problem:** No migration version tracking (F-08).
**Fix:** Add commented SQL block showing where `schema_migrations` table should be created, with example INSERT statement.
**Verification:** Code review confirms migration tracking is documented.
**Time:** 5 minutes.

---

## QW-06: Remove "AI-powered" claims from README

**Location:** `README.md`
**Current:** Does not explicitly say "AI-powered" but PRD and product positioning imply AI capabilities
**Problem:** Product has zero AI/LLM components (F-03). Marketing claims misrepresent capabilities.
**Fix:** Review README.md and PRD.md for any "AI", "LLM", "intelligent", or "automated decision" language. Replace with "deterministic" or "rule-based" where applicable.
**Verification:** `grep -ri "ai\|llm\|intelligent\|automated" README.md docs/PRD.md` returns only intentional, accurate references.
**Time:** 15 minutes.

---

## QW-07: Add .env to .gitignore

**Location:** `.gitignore`
**Current:** Unknown contents
**Problem:** If `.env` is created with OIDC secrets, it must not be committed.
**Fix:** Ensure `.env` and `.env.*` (except `.env.example`) are in `.gitignore`.
**Verification:** `git check-ignore backend/.env` returns the path (not "no match").
**Time:** 5 minutes.