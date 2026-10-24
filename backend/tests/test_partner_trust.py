"""Deterministic Japan-Readiness & Trust Score: weights, gates, caps, rounding, reproducibility."""

import re
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.domain.partner_trust import BLOCKED_CAP, LITIGATION_CAP, SCORING_VERSION, audit, otd_trailing
from app.seed.partner_registry import PARTNERS

NOW = datetime(2026, 10, 24, tzinfo=timezone.utc)
BY_NAME = {p.partner_name.removesuffix(" (fictional)"): p for p in PARTNERS}


def with_(record, **changes):
    """Copy a frozen record with nested changes, revalidated."""
    data = record.model_dump()
    for key, value in changes.items():
        if isinstance(value, dict) and isinstance(data.get(key), dict):
            data[key] = {**data[key], **value}
        else:
            data[key] = value
    return type(record).model_validate(data)


def test_weights_sum_to_100_and_components_add_up():
    for p in PARTNERS:
        a = audit(p, NOW)
        assert sum(c.max_points for c in a.components) == 100
        assert a.uncapped_score == sum(c.points for c in a.components)
        assert all(Decimal(0) <= c.points <= c.max_points for c in a.components)
        assert isinstance(a.score, Decimal) and a.score == a.score.quantize(Decimal("0.1"))


def test_audit_is_reproducible():
    p = BY_NAME["Hikari Precision Components"]
    a, b = audit(p, NOW), audit(p, NOW)
    assert a == b and a.scoring_version == SCORING_VERSION
    assert a.inputs_hash == audit(with_(p), NOW).inputs_hash
    assert a.inputs_hash != audit(with_(p, financial_solvency_score=Decimal("85")), NOW).inputs_hash


@pytest.mark.parametrize("name, tier", [
    ("Hikari Precision Components", "japan_ready"),
    ("Kaveri Electro Assemblies", "japan_ready"),
    ("Godavari Robotics Integration", "high_friction"),
    ("Narmada Consumer Distribution", "conditional"),
    ("Tapti Fasteners", "not_recommended"),
])
def test_fixture_tiers(name, tier):
    assert audit(BY_NAME[name], NOW).tier == tier


def test_major_litigation_caps_score_despite_strong_operations():
    a = audit(BY_NAME["Yamuna FMCG Logistics"], NOW)
    assert a.uncapped_score > 80 and a.score == LITIGATION_CAP and a.tier == "not_recommended"
    assert a.flags[0].level == "block" and a.flags[0].code == "litigation_major"
    assert next(c for c in a.components if c.key == "litigation").points == 0


def test_cancelled_gst_blocks():
    a = audit(BY_NAME["Brahmaputra Components"], NOW)
    assert a.score == BLOCKED_CAP and a.tier == "blocked" and any(f.code == "gst_cancelled" for f in a.flags)


def test_struck_off_company_blocks():
    p = with_(BY_NAME["Hikari Precision Components"], mca_compliance={"status": "strike_off"})
    a = audit(p, NOW)
    assert a.tier == "blocked" and a.score <= BLOCKED_CAP


def test_high_credit_risk_never_earns_japan_ready():
    a = audit(BY_NAME["Mahanadi Industrial Automation"], NOW)
    assert a.score >= 80 and a.tier == "conditional"
    assert any(f.code == "credit_high_risk" for f in a.flags)


def test_better_otd_never_lowers_score():
    base = BY_NAME["Narmada Consumer Distribution"]
    better = with_(base, operations={"otd_monthly_pct": [Decimal("97.5")] * 12})
    assert audit(better, NOW).score > audit(base, NOW).score


def test_verified_iso_adds_exact_weight():
    base = BY_NAME["Godavari Robotics Integration"]  # ISO 9001 claimed (1.8 pts), no 14001
    certs = [{"standard": "ISO 9001", "status": "verified"}, {"standard": "ISO 14001", "status": "verified"}]
    iso = lambda r: next(c for c in audit(r, NOW).components if c.key == "iso").points
    assert iso(base) == Decimal("1.8") and iso(with_(base, iso_certifications=certs)) == Decimal("10.0")


def test_otd_mean_rounds_half_up():
    p = with_(BY_NAME["Hikari Precision Components"], operations={"otd_monthly_pct": [Decimal("90.04"), Decimal("90.06")]})
    assert otd_trailing(p) == Decimal("90.1")  # 90.05 → 90.1 (half-up), not banker's 90.0


def test_fixtures_are_unmistakably_simulated():
    for p in PARTNERS:
        assert p.record_source == "simulated_fixture" and p.partner_name.endswith("(fictional)")
        assert re.fullmatch(r"U\d{5}ZZ\d{4}PTC\d{6}", p.mca_registration_no)  # 'ZZ' is not an Indian state code
        assert p.gstin.startswith("00")  # GST state code 00 is never issued
        assert all(d.name.endswith("(fictional)") and d.din.startswith("SIM-") for d in p.director_history)
        a = audit(p, NOW)
        assert a.simulated and any(f.code == "simulated_record" for f in a.flags)
        assert all("simulated record" in e.note for e in a.evidence)


def test_inputs_hash_ignores_decimal_representation():
    p = BY_NAME["Hikari Precision Components"]
    assert audit(with_(p, financial_solvency_score=Decimal("86.00")), NOW).inputs_hash == audit(p, NOW).inputs_hash
