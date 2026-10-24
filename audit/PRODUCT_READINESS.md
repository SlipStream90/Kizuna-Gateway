# Product Readiness — Kizuna Gateway

## User journey assessment

### Step 1: Describe a product and intended customer
- **Frontend:** Assessment form collects product, sector, target customer, budget, horizon, HS code, unit value, volume, weights. Working.
- **Backend:** `create_assessment` persists to PostgreSQL with tenant scoping. Working (untested without DB).
- **Gap:** No validation that product/sector combinations are realistic for India market.

### Step 2: Identify suitable Indian states and industrial clusters
- **Frontend:** Market ranking with weight sliders, region ranking display. Working UI.
- **Backend:** `rank_regions()` deterministic MCDA over hardcoded `REGIONS` seed data in `backend/app/seed/regions.py`.
- **Gap:** Region data is hardcoded fixtures, not from India Industrial Land Bank or any official source. No cluster-level granularity.

### Step 3: Find plausible Indian distributors or partners
- **Frontend:** Partner search with fictional partner cards, scorecard drill-down. Working UI.
- **Backend:** `list_partners()` queries `assessment_partners` table seeded with fictional data.
- **Gap:** All partners are marked `fictional=true`. No real partner data, no verification pipeline, no IEC validation.

### Step 4: Assess partner evidence and remaining risks
- **Frontend:** Partner scorecard shows fictional status, evidence coverage, verification state, missing checks. Working UI.
- **Backend:** `partner()` returns scorecard from seeded data.
- **Gap:** Verification states are hardcoded (`unverified`, `unreviewed`). No actual verification process.

### Step 5: Identify potentially applicable regulatory requirements
- **Frontend:** Compliance search with keyword query, abstention reasons. Working UI.
- **Backend:** `compliance_search()` does deterministic keyword matching over `source_passages` table.
- **Gap:** `source_passages` table is empty (no ingestion pipeline). All searches abstain with `NO_APPROVED_CORPUS` or `INSUFFICIENT_COVERAGE`. No BIS QCO data, no CEPA rules.

### Step 6: Compare market-entry strategies and landed costs
- **Frontend:** GTM direct vs distributor comparison with line items, sensitivity. Working UI.
- **Backend:** `calculate_gtm()` pure Python decimal arithmetic. Working (5 domain tests pass).
- **Gap:** Duty rates, CEPA preferences, freight rates are hardcoded assumptions, not from India Customs tariff schedule.

### Step 7: Produce a defensible, actionable market-entry report
- **Frontend:** Report view with all sections, print styles. Working UI.
- **Backend:** `create_report()` generates immutable snapshot with payload envelope.
- **Gap:** Report contains seeded/illustrative data only. Citations point to non-existent sources.

## Data availability and evidence quality

| Data Type | Source | Status | Quality | Usable for decisions? |
|-----------|--------|--------|---------|----------------------|
| Indian regions/clusters | Hardcoded `REGIONS` seed | Implemented (hardcoded) | Illustrative only | No |
| Indian partners | Hardcoded `assessment_partners` seed | Implemented (hardcoded) | All fictional | No |
| Regulatory sources | `source_passages` table | Empty | No data | No |
| Tariff/duty rates | Hardcoded in GTM calculations | Implemented (hardcoded) | Illustrative | No |
| BIS certification | Not integrated | Not implemented | N/A | No |
| CEPA preferential rates | Not integrated | Not implemented | N/A | No |

## Integration status

| Integration | Status | Evidence |
|-------------|--------|----------|
| PostgreSQL database | Not available locally | F-01 |
| OIDC authentication | Not configured | F-04 |
| IILB API | Not implemented | F-02 |
| DGFT IEC/HS | Not implemented | F-02 |
| data.gov.in API | Not implemented | F-02 |
| BIS QCO data | Not implemented | F-02 |
| CEPA tariff schedule | Not implemented | F-02 |

## AI reliability

**No AI components exist.** Product is marketed as "AI-powered" but is entirely deterministic. Compliance Copilot is keyword matching. No embeddings, no RAG, no LLM, no reranking. This is not a defect per se (deterministic is more reliable for financial calculations), but it contradicts product marketing.

## Security/privacy

- Authentication architecture is sound but unconfigured (F-04).
- Tenant isolation via RLS is designed correctly but untested (F-01).
- No rate limiting (F-07).
- No encryption at rest configuration found.
- No secrets management (OIDC signing key would need to be in env vars or secret store).

## UX/accessibility

- Japanese-themed design with glassmorphism, sakura animations, background video. Modern aesthetic.
- Focus visible styles implemented.
- Print styles for reports.
- No ARIA labels on all interactive elements (some divs use role="button" for test compatibility).
- No keyboard navigation testing.
- No color contrast audit.

## Business viability

**Target customer:** Japanese SMEs evaluating India market entry.
**Problem:** High information asymmetry, regulatory complexity, partner trust issues.
**Current solution:** Deterministic demo with seeded data. Illustrative only.
**Willingness to pay:** Unknown — no customer interviews conducted.
**Competition:** Existing trade consultants, JETRO, India Investment Centre, DGFT portals.
**Differentiation:** None established — all data is illustrative, no real integrations.

## Readiness matrix

| Readiness Level | Ready? | Blockers |
|-----------------|--------|----------|
| Local engineering demo | Yes | None |
| Competition judging session | No | F-01 (no DB), F-02 (no real data), F-03 (no AI), F-04 (no OIDC) |
| SME pilot | No | F-01 through F-07, no customer validation |
| Handling confidential business info | No | No encryption, no access audit, no data processing agreement |
| Paid commercial launch | No | All of the above + no pricing, no terms of service, no support model |

**Smallest experiment to test demand:** Structured interview with 5-10 Japanese SMEs considering India entry, showing the current demo and asking what data they would actually need to make a go/no-go decision.