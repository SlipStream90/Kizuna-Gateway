"""Simulated partner directory fixtures (record_source = 'simulated_fixture').

Every identifier is deliberately impossible so no record can be mistaken for, or collide with,
a real entity: CINs use state code 'ZZ', GSTINs use state code '00', DINs are 'SIM-…', and every
company and person name carries '(fictional)'. Metrics are illustrative.
"""

from datetime import date
from decimal import Decimal as D
from uuid import NAMESPACE_URL, uuid5

from app.schemas.partner_registry import PartnerRecord

AS_OF = date(2026, 9, 30)


def _otd(*values: str) -> list[D]:
    return [D(v) for v in values]


def _partner(n: int, name: str, sector: str, state: str, city: str, ptype: str, *, year: int,
             mca: dict, gst: dict, directors: list[tuple[str, str, date, date | None]],
             litigation: list[dict], solvency: str | None, credit: str, iso: list[dict],
             otd: list[D], accuracy: str, retention: str, satisfaction: str, sla: str,
             cross: tuple[int, int, int]) -> PartnerRecord:
    code = f"{n:04d}"
    return PartnerRecord(
        id=uuid5(NAMESPACE_URL, f"kizuna-gateway/partner-registry/{code}"),
        partner_name=f"{name} (fictional)",
        record_source="simulated_fixture",
        sector=sector, state=state, city=city, partner_type=ptype,
        mca_registration_no=f"U{29300 + n}ZZ{year}PTC00{code}",
        gstin=f"00ZZZCF{code}A1Z{n % 10}",
        registered_address=f"Plot {n * 7}, Industrial Area, {city}, {state} (fictional address)",
        incorporated_on=date(year, 4, 1),
        mca_compliance=mca, gst_compliance=gst,
        director_history=[
            {"name": f"{d} (fictional)", "din": f"SIM-{code}-{i + 1}", "role": role, "appointed_on": start, "ceased_on": end}
            for i, (d, role, start, end) in enumerate(directors)
        ],
        litigation=litigation,
        financial_solvency_score=D(solvency) if solvency is not None else None,
        credit_rating={"agency": "D&B-equivalent rating (simulated)", "band": credit, "as_of": AS_OF},
        iso_certifications=iso,
        operations={
            "otd_monthly_pct": otd, "fulfillment_accuracy_pct": D(accuracy), "client_retention_pct": D(retention),
            "foreign_principal_satisfaction_pct": D(satisfaction), "sla_compliance_pct": D(sla),
        },
        cross_border={"contracts_total": cross[0], "contracts_fulfilled": cross[1], "japanese_principals": cross[2]},
        data_as_of=AS_OF,
    )


def _iso(standard: str, status: str, n: int, valid: date | None = date(2028, 3, 31)) -> dict:
    return {"standard": standard, "status": status, "certificate_no": f"SIM-{standard[4:]}-{n:04d}",
            "certification_body": "Accredited certification body (simulated)", "valid_until": valid}


ACTIVE_MCA = {"status": "active", "annual_filings_on_time_last3": 3, "last_annual_return_fy": "2025-26"}
ACTIVE_GST = {"status": "active", "returns_on_time_last12": 12, "last_return_period": "2026-09"}

PARTNERS: list[PartnerRecord] = [
    _partner(1, "Hikari Precision Components", "auto", "Gujarat", "Becharaji", "supplier", year=2008,
             mca=ACTIVE_MCA, gst=ACTIVE_GST,
             directors=[("A. Desai", "Managing Director", date(2008, 4, 1), None), ("K. Shah", "Director", date(2012, 6, 1), None)],
             litigation=[], solvency="86", credit="low",
             iso=[_iso("ISO 9001", "verified", 1), _iso("ISO 14001", "verified", 1)],
             otd=_otd("96.1", "97.0", "96.4", "97.2", "96.8", "97.5", "96.9", "97.1", "97.6", "96.7", "97.3", "97.8"),
             accuracy="99.2", retention="93", satisfaction="92", sla="97", cross=(19, 18, 3)),
    _partner(2, "Sindhu Auto Systems", "auto", "Rajasthan", "Neemrana", "jv_partner", year=2011,
             mca=ACTIVE_MCA, gst={**ACTIVE_GST, "returns_on_time_last12": 11},
             directors=[("R. Agarwal", "Managing Director", date(2011, 7, 1), None), ("S. Rathore", "Director", date(2015, 1, 1), date(2023, 3, 31)),
                        ("M. Jain", "Director", date(2023, 4, 1), None)],
             litigation=[], solvency="71", credit="moderate",
             iso=[_iso("ISO 9001", "verified", 2), _iso("ISO 14001", "claimed_unverified", 2)],
             otd=_otd("92.0", "93.4", "91.8", "93.0", "94.1", "92.6", "93.8", "94.0", "92.9", "93.5", "94.4", "93.9"),
             accuracy="98.1", retention="88", satisfaction="85", sla="93", cross=(9, 8, 2)),
    _partner(3, "Kaveri Electro Assemblies", "electronics", "Tamil Nadu", "Sriperumbudur", "contract_manufacturer", year=2006,
             mca=ACTIVE_MCA, gst=ACTIVE_GST,
             directors=[("V. Raman", "Managing Director", date(2006, 9, 1), None), ("L. Iyer", "Director", date(2010, 2, 1), None)],
             litigation=[{"forum": "Civil Court (simulated)", "case_type": "commercial", "status": "disposed", "severity": "minor",
                          "summary": "Payment dispute with a logistics vendor, settled", "reference": "SIM-CS-2021-0003"}],
             solvency="82", credit="low",
             iso=[_iso("ISO 9001", "verified", 3), _iso("ISO 14001", "verified", 3)],
             otd=_otd("94.0", "95.2", "95.8", "94.9", "95.5", "96.1", "95.0", "95.7", "96.3", "95.4", "96.0", "96.2"),
             accuracy="98.9", retention="91", satisfaction="89", sla="95", cross=(14, 13, 1)),
    _partner(4, "Godavari Robotics Integration", "robotics", "Andhra Pradesh", "Sri City", "distributor", year=2022,
             mca={**ACTIVE_MCA, "annual_filings_on_time_last3": 2}, gst={**ACTIVE_GST, "returns_on_time_last12": 11},
             directors=[("P. Reddy", "Managing Director", date(2022, 4, 1), None)],
             litigation=[], solvency="58", credit="unrated",
             iso=[_iso("ISO 9001", "claimed_unverified", 4)],
             otd=_otd("89.0", "90.5", "91.2", "92.0", "91.6", "92.8", "93.0", "92.4", "93.5", "93.1", "94.0", "93.6"),
             accuracy="97.0", retention="80", satisfaction="82", sla="91", cross=(2, 2, 1)),
    _partner(5, "Narmada Consumer Distribution", "fmcg", "Maharashtra", "Pune", "distributor", year=2009,
             mca=ACTIVE_MCA, gst={**ACTIVE_GST, "returns_on_time_last12": 10},
             directors=[("N. Kulkarni", "Managing Director", date(2009, 5, 1), None), ("D. Patil", "Director", date(2016, 8, 1), None)],
             litigation=[{"forum": "Commercial Court (simulated)", "case_type": "commercial", "status": "pending", "severity": "minor",
                          "summary": "Claim over a terminated sub-distributor agreement", "reference": "SIM-CC-2025-0017"}],
             solvency="64", credit="moderate",
             iso=[_iso("ISO 9001", "expired", 5, date(2025, 12, 31))],
             otd=_otd("87.5", "88.9", "86.2", "89.4", "88.0", "87.1", "88.8", "89.9", "87.6", "88.4", "89.1", "88.3"),
             accuracy="96.4", retention="84", satisfaction="78", sla="88", cross=(6, 5, 0)),
    _partner(6, "Yamuna FMCG Logistics", "fmcg", "Haryana", "Gurugram", "distributor", year=2004,
             mca=ACTIVE_MCA, gst=ACTIVE_GST,
             directors=[("H. Malhotra", "Managing Director", date(2004, 1, 1), None), ("T. Arora", "Director", date(2019, 10, 1), None)],
             litigation=[{"forum": "Income Tax Appellate Tribunal (simulated)", "case_type": "tax", "status": "pending", "severity": "major",
                          "summary": "Disputed transfer-pricing demand under appeal", "reference": "SIM-ITA-2024-0412"}],
             solvency="79", credit="low",
             iso=[_iso("ISO 9001", "verified", 6), _iso("ISO 14001", "verified", 6)],
             otd=_otd("95.0", "96.2", "95.8", "96.4", "95.9", "96.8", "96.1", "96.5", "97.0", "96.2", "96.7", "96.9"),
             accuracy="98.8", retention="90", satisfaction="88", sla="96", cross=(11, 11, 2)),
    _partner(7, "Deccan Polymer Chemicals", "chemicals", "Gujarat", "Dahej", "supplier", year=2013,
             mca=ACTIVE_MCA, gst={**ACTIVE_GST, "returns_on_time_last12": 11},
             directors=[("B. Mehta", "Managing Director", date(2013, 3, 1), None), ("C. Vora", "Director", date(2013, 3, 1), None)],
             litigation=[], solvency="74", credit="moderate",
             iso=[_iso("ISO 9001", "verified", 7), _iso("ISO 14001", "verified", 7)],
             otd=_otd("90.2", "91.5", "90.8", "92.0", "91.1", "92.4", "91.9", "92.6", "91.7", "92.2", "92.9", "92.5"),
             accuracy="97.8", retention="86", satisfaction="83", sla="92", cross=(7, 6, 1)),
    _partner(8, "Tapti Fasteners", "auto", "Maharashtra", "Chakan", "supplier", year=2010,
             mca={"status": "active_non_compliant", "annual_filings_on_time_last3": 1, "last_annual_return_fy": "2023-24"},
             gst={**ACTIVE_GST, "returns_on_time_last12": 7, "last_return_period": "2026-07"},
             directors=[("G. Joshi", "Managing Director", date(2010, 6, 1), None), ("U. Pawar", "Director", date(2014, 6, 1), date(2024, 12, 31))],
             litigation=[], solvency="49", credit="high",
             iso=[_iso("ISO 9001", "verified", 8)],
             otd=_otd("84.0", "86.5", "83.2", "85.9", "84.7", "86.0", "82.8", "85.1", "84.4", "86.2", "83.9", "85.6"),
             accuracy="95.1", retention="74", satisfaction="70", sla="84", cross=(4, 3, 0)),
    _partner(9, "Brahmaputra Components", "electronics", "Uttar Pradesh", "Noida", "supplier", year=2015,
             mca=ACTIVE_MCA, gst={"status": "cancelled", "returns_on_time_last12": 0, "last_return_period": "2025-11"},
             directors=[("J. Saikia", "Managing Director", date(2015, 2, 1), None)],
             litigation=[], solvency="52", credit="moderate",
             iso=[_iso("ISO 9001", "verified", 9)],
             otd=_otd("93.0", "94.2", "93.6", "94.8", "93.9", "94.4", "95.0", "94.1", "94.7", "93.8", "94.5", "94.9"),
             accuracy="97.6", retention="85", satisfaction="84", sla="92", cross=(8, 7, 1)),
    _partner(10, "Mahanadi Industrial Automation", "robotics", "Karnataka", "Bengaluru", "jv_partner", year=2012,
             mca=ACTIVE_MCA, gst=ACTIVE_GST,
             directors=[("K. Gowda", "Managing Director", date(2012, 8, 1), None), ("A. Nair", "Director", date(2018, 5, 1), None)],
             litigation=[], solvency="55", credit="high",
             iso=[_iso("ISO 9001", "verified", 10), _iso("ISO 14001", "verified", 10)],
             otd=_otd("92.8", "93.6", "94.0", "93.2", "94.5", "93.9", "94.8", "94.2", "95.1", "94.6", "95.0", "94.7"),
             accuracy="98.4", retention="87", satisfaction="86", sla="94", cross=(10, 9, 2)),
]
