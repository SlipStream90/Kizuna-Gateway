"""Japan-Readiness & Trust Score (0–100) for Indian partners — deterministic and explainable.

Pure function of a PartnerRecord: no I/O, no clock in the score, Decimal arithmetic with
ROUND_HALF_UP per component, and the total is the sum of the rounded components so the
breakdown always adds up. Hard gates cap the total; good operational metrics can never
lift a partner over a blocking compliance finding.

Weights (sum 100):
  MCA compliance & filing 15 · GSTN regularity 15 · litigation 10 · ISO certification 10 ·
  creditworthiness 15 · on-time delivery & fulfilment 20 · cross-border record & satisfaction 15
"""

import hashlib
import json
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from app.schemas.partner_registry import (
    EvidenceLink, PartnerRecord, ScoreComponent, TrustAudit, TrustFlag,
)

SCORING_VERSION = "trust-v1"
D = Decimal
ZERO, ONE = D(0), D(1)
TENTH = D("0.1")

BLOCKED_CAP = D(25)
LITIGATION_CAP = D(49)
TIERS = [(D(80), "japan_ready"), (D(65), "conditional"), (D(50), "high_friction")]

DISCLOSURE = (
    "Advisory screening only. Simulated fixture data is not a registry verification; confirm MCA, "
    "GSTN, litigation and credit status against primary sources before any commitment."
)

# Public portals; a simulated record will not be found there, and the link says so.
MCA_PORTAL = "https://www.mca.gov.in/"
GST_PORTAL = "https://services.gst.gov.in/services/searchtp"


def _q(x: Decimal) -> Decimal:
    return x.quantize(TENTH, rounding=ROUND_HALF_UP)


def _scale(value: Decimal, floor: Decimal, ceiling: Decimal) -> Decimal:
    """Linear 0..1 between floor and ceiling, clamped."""
    if value <= floor:
        return ZERO
    if value >= ceiling:
        return ONE
    return (value - floor) / (ceiling - floor)


def otd_trailing(p: PartnerRecord) -> Decimal:
    months = p.operations.otd_monthly_pct
    return _q(sum(months, ZERO) / D(len(months)))


def _canonical(value):
    """Numerically equal Decimals hash the same (86 == 86.00 from a numeric(5,2) column)."""
    if isinstance(value, Decimal):
        text = format(value.normalize(), "f")
        return text if text != "-0" else "0"
    if isinstance(value, dict):
        return {k: _canonical(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_canonical(v) for v in value]
    return value


def inputs_hash(p: PartnerRecord) -> str:
    data = _canonical(p.model_dump(mode="python"))
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(f"{SCORING_VERSION}\n{canonical}".encode()).hexdigest()


def _mca(p: PartnerRecord, flags: list[TrustFlag]) -> ScoreComponent:
    m = p.mca_compliance
    base = {"active": D(9), "active_non_compliant": D(3)}.get(m.status, ZERO)
    reasons = [f"MCA status: {m.status.replace('_', ' ')} ({base} pts)"]
    if m.status in ("strike_off", "under_liquidation"):
        flags.append(TrustFlag(level="block", code="mca_not_active", message=f"Company is {m.status.replace('_', ' ')} on MCA records."))
    elif m.status == "dormant":
        flags.append(TrustFlag(level="warn", code="mca_dormant", message="Company is marked dormant on MCA records."))
    elif m.status == "active_non_compliant":
        flags.append(TrustFlag(level="warn", code="mca_non_compliant", message="Active but non-compliant with MCA annual filings."))
    filings = D(2) * m.annual_filings_on_time_last3
    reasons.append(f"Annual filings on time in {m.annual_filings_on_time_last3}/3 recent years ({filings} pts)")
    return ScoreComponent(key="mca", label="MCA compliance & filing status", points=_q(base + filings), max_points=D(15), reasons=reasons)


def _gst(p: PartnerRecord, flags: list[TrustFlag]) -> ScoreComponent:
    g = p.gst_compliance
    base = D(5) if g.status == "active" else ZERO
    if g.status == "cancelled":
        flags.append(TrustFlag(level="block", code="gst_cancelled", message="GST registration is cancelled."))
    elif g.status == "suspended":
        flags.append(TrustFlag(level="warn", code="gst_suspended", message="GST registration is suspended."))
    regular = D(10) * D(g.returns_on_time_last12) / D(12)
    if g.returns_on_time_last12 < 10:
        flags.append(TrustFlag(level="warn", code="gst_irregular", message=f"Only {g.returns_on_time_last12}/12 GST returns filed on time."))
    return ScoreComponent(
        key="gst", label="GSTN filing regularity", points=_q(base + regular), max_points=D(15),
        reasons=[f"GST registration {g.status} ({base} pts)", f"{g.returns_on_time_last12}/12 returns on time ({_q(regular)} pts)"],
    )


def _litigation(p: PartnerRecord, flags: list[TrustFlag]) -> ScoreComponent:
    pending = [c for c in p.litigation if c.status == "pending"]
    major = [c for c in pending if c.severity == "major" and c.case_type in ("tax", "corporate")]
    if major:
        for c in major:
            flags.append(TrustFlag(level="block", code="litigation_major", message=f"Pending major {c.case_type} matter: {c.summary} ({c.reference})."))
        return ScoreComponent(key="litigation", label="Litigation exposure", points=ZERO, max_points=D(10),
                              reasons=[f"{len(major)} pending major tax/corporate matter(s) (0 pts)"])
    deduction = min(D(2) * len(pending), D(6))
    if pending:
        flags.append(TrustFlag(level="warn", code="litigation_pending", message=f"{len(pending)} pending minor/commercial matter(s)."))
    reasons = ["No pending litigation (10 pts)"] if not pending else [f"{len(pending)} pending minor matter(s) (−{deduction} pts)"]
    return ScoreComponent(key="litigation", label="Litigation exposure", points=_q(D(10) - deduction), max_points=D(10), reasons=reasons)


def _iso(p: PartnerRecord, flags: list[TrustFlag]) -> ScoreComponent:
    weights = {"ISO 9001": D(6), "ISO 14001": D(4)}
    status_factor = {"verified": ONE, "claimed_unverified": D("0.3"), "expired": D("0.15")}
    points, reasons = ZERO, []
    for standard, weight in weights.items():
        cert = next((c for c in p.iso_certifications if c.standard == standard), None)
        if cert is None:
            reasons.append(f"{standard}: none (0 pts)")
            continue
        earned = weight * status_factor[cert.status]
        points += earned
        reasons.append(f"{standard}: {cert.status.replace('_', ' ')} ({_q(earned)} pts)")
        if cert.status != "verified":
            flags.append(TrustFlag(level="info", code=f"iso_{standard[4:]}_{cert.status}", message=f"{standard} is {cert.status.replace('_', ' ')}."))
    return ScoreComponent(key="iso", label="ISO quality & environmental certification", points=_q(points), max_points=D(10), reasons=reasons)


def _credit(p: PartnerRecord, flags: list[TrustFlag]) -> ScoreComponent:
    band = p.credit_rating.band
    band_pts = {"low": D(10), "moderate": D(5)}.get(band, ZERO)
    if band == "high":
        flags.append(TrustFlag(level="warn", code="credit_high_risk", message=f"{p.credit_rating.agency}: high credit risk."))
    elif band == "unrated":
        flags.append(TrustFlag(level="warn", code="credit_unrated", message="No credit rating available."))
    solvency = p.financial_solvency_score
    solv_pts = D(5) * solvency / D(100) if solvency is not None else ZERO
    reasons = [f"Credit risk {band} ({band_pts} pts)",
               f"Financial solvency {solvency if solvency is not None else 'unknown'}/100 ({_q(solv_pts)} pts)"]
    return ScoreComponent(key="credit", label="Creditworthiness", points=_q(band_pts + solv_pts), max_points=D(15), reasons=reasons)


def _delivery(p: PartnerRecord, flags: list[TrustFlag]) -> ScoreComponent:
    otd = otd_trailing(p)
    otd_pts = D(14) * _scale(otd, D(80), D(98))
    acc = p.operations.fulfillment_accuracy_pct
    acc_pts = D(6) * _scale(acc, D(90), D("99.5"))
    if otd < D(90):
        flags.append(TrustFlag(level="warn", code="otd_low", message=f"Trailing 12-month on-time delivery {otd}% (< 90%)."))
    return ScoreComponent(
        key="delivery", label="On-time delivery & fulfilment", points=_q(otd_pts + acc_pts), max_points=D(20),
        reasons=[f"OTD trailing 12 months {otd}% ({_q(otd_pts)} pts; full marks at 98%)",
                 f"Order fulfilment accuracy {acc}% ({_q(acc_pts)} pts; full marks at 99.5%)"],
    )


def _cross_border(p: PartnerRecord, flags: list[TrustFlag]) -> ScoreComponent:
    cb, ops = p.cross_border, p.operations
    if cb.contracts_total:
        rate = D(min(cb.contracts_fulfilled, cb.contracts_total)) / D(cb.contracts_total)
        sample = min(ONE, D(cb.contracts_total) / D(5))  # fewer than 5 contracts is thin evidence
    else:
        rate, sample = ZERO, ZERO
        flags.append(TrustFlag(level="info", code="no_cross_border", message="No verified cross-border contract history."))
    contract_pts = D(6) * rate * sample + (ONE if cb.japanese_principals else ZERO)
    retention_pts = D(3) * _scale(ops.client_retention_pct, D(60), D(95))
    satisfaction_pts = D(3) * _scale(ops.foreign_principal_satisfaction_pct, D(60), D(95))
    sla_pts = D(2) * _scale(ops.sla_compliance_pct, D(80), D(98))
    return ScoreComponent(
        key="cross_border", label="Cross-border record & principal satisfaction",
        points=_q(contract_pts + retention_pts + satisfaction_pts + sla_pts), max_points=D(15),
        reasons=[
            f"{cb.contracts_fulfilled}/{cb.contracts_total} foreign contracts fulfilled, {cb.japanese_principals} Japanese principal(s) ({_q(contract_pts)} pts)",
            f"Client retention {ops.client_retention_pct}% ({_q(retention_pts)} pts)",
            f"Foreign principal satisfaction {ops.foreign_principal_satisfaction_pct}% ({_q(satisfaction_pts)} pts)",
            f"Communication SLA compliance {ops.sla_compliance_pct}% ({_q(sla_pts)} pts)",
        ],
    )


def _tier(score: Decimal, flags: list[TrustFlag]) -> str:
    if any(f.code in ("mca_not_active", "gst_cancelled") for f in flags):
        return "blocked"
    if any(f.code == "litigation_major" for f in flags):
        return "not_recommended"
    tier = next((name for floor, name in TIERS if score >= floor), "not_recommended")
    # A high credit-risk rating keeps the score but never earns the top label.
    if tier == "japan_ready" and any(f.code == "credit_high_risk" for f in flags):
        return "conditional"
    return tier


def audit(p: PartnerRecord, now: datetime | None = None) -> TrustAudit:
    flags: list[TrustFlag] = []
    components = [f(p, flags) for f in (_mca, _gst, _litigation, _iso, _credit, _delivery, _cross_border)]
    uncapped = sum((c.points for c in components), ZERO)
    score = uncapped
    if any(f.code in ("mca_not_active", "gst_cancelled") for f in flags):
        score = _q(min(score, BLOCKED_CAP))
    elif any(f.code == "litigation_major" for f in flags):
        score = _q(min(score, LITIGATION_CAP))
    simulated = p.record_source != "registry_verified"
    if simulated:
        flags.append(TrustFlag(level="info", code="simulated_record",
                               message="Simulated fixture: identifiers and metrics are illustrative, not registry data."))
    note = " (simulated record — it will not be found on the portal)" if simulated else ""
    evidence = [
        EvidenceLink(label=f"MCA company master data · CIN {p.mca_registration_no}", url=MCA_PORTAL, note=f"Search by CIN{note}"),
        EvidenceLink(label=f"GST taxpayer search · GSTIN {p.gstin}", url=GST_PORTAL, note=f"Search by GSTIN{note}"),
    ]
    return TrustAudit(
        partner_id=p.id, partner_name=p.partner_name, record_source=p.record_source, simulated=simulated,
        score=score, uncapped_score=uncapped, tier=_tier(score, flags), components=components,
        flags=sorted(flags, key=lambda f: {"block": 0, "warn": 1, "info": 2}[f.level]),
        otd_trailing_pct=otd_trailing(p), evidence=evidence, scoring_version=SCORING_VERSION,
        inputs_hash=inputs_hash(p), computed_at=now or datetime.now(timezone.utc), disclosure=DISCLOSURE,
        record=p,
    )
