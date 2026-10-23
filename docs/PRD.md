# Kizuna Gateway MVP Product Requirements

## Purpose

Build a credible, demonstrable end-to-end market-entry assessment for a Japanese precision-component or industrial-sensor SME considering India. The product must be decision support, not legal, tax, customs, investment, or financial advice.

## Required product structure

The MVP connects four engines in a single workflow:

1. **Market Intelligence** ranks three seeded Indian industrial regions or clusters using configurable, transparent weighted MCDA.
2. **Trust Engine** searches and compares fictional demo partners, keeping operational fit separate from verification evidence and unknowns.
3. **Compliance Copilot** retrieves from a curated, stored set of official public sources and produces a cited checklist with applicability and human-review status.
4. **GTM Simulator** uses decimal-safe deterministic calculations to compare direct export and distributor-led export, with visible assumptions and sensitivity analysis.

## Core journey

Users create an assessment by entering product, sector, target customer, budget, target horizon, preferred entry modes, and optional HS code, unit value, and volume. Missing HS classification must be flagged rather than invented. The user reviews market rankings, partners, compliance items, and entry-mode economics; can adjust score weights and scenario inputs; and generates a consolidated, print-friendly report with source references, dates, assumptions, and formula versions.

## MVP safety and provenance requirements

- All displayable claims need stored source records or an explicit illustrative/assumption label.
- Demo partners must be clearly fictional; a numerical assessment never guarantees trustworthiness.
- Scorecards and financial totals must be deterministic, versioned, reproducible, and independently tested.
- Curated/cached data must never be represented as live verified.
- Compliance citations must point to stored source passages; insufficient retrieval must produce an uncertainty state instead of a definitive assertion.
- CEPA preference is never automatic: classification, schedule, origin eligibility, and verified inputs are necessary.
- The demo must work without external government services or an LLM API key.

## Technical direction

Use a modular monolith with a Next.js + TypeScript + Tailwind frontend and a FastAPI + Pydantic API. Use PostgreSQL for durable records, pgvector or a lightweight local equivalent for retrieval, and BM25 for exact terminology. Keep all model calls behind a provider-neutral structured-generation adapter with a deterministic fallback. Keep scoring, partner assessment, citation validation, and GTM calculations in independently tested domain functions.

## Functional acceptance highlights

- Persist and revisit validated assessments.
- Return three seeded regional recommendations with component scores, sources, coverage, warnings, and adjustable non-negative weights totaling one.
- Display fictional partner evidence, date, verification state, component scorecard, evidence coverage, missing checks, and separate fit.
- Generate a compliance checklist with official source URL, stored source passage/page where available, authority, applicability, last-checked/effective date, and review flag.
- Compare at least direct export and distributor-led export with line-item cost calculations, assumptions, timestamps, and sensitivity controls.
- Generate a responsive consolidated report containing all results, sources, assumptions, risks, and next steps.
- Provide a versioned `/api/v1` API, source registry, safe errors, audit metadata, seed scripts, tests, setup docs, limitations, and demo runbook.

## Explicit non-goals

No automated regulatory filing, production identity verification, credit underwriting, broad multi-sector coverage, claimed government/institutional integrations, fabricated official data or current tariff rates, or hidden dependencies on a live LLM/network.

## Source

This working Markdown specification is derived from the user-provided `Kizuna_Gateway_PRD_Codex.docx` and intentionally preserves its implementation constraints while serving as a repository-local build reference.
