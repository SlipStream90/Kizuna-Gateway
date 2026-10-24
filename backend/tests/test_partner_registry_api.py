"""GET /api/v1/partners (directory) and POST /api/v1/partners/{id}/audit-score contracts."""

from decimal import Decimal
from uuid import uuid4

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api import assessments, partners
from app.auth.dependencies import require_principal
from app.schemas.partners import PartnerList
from app.schemas.pilot import Principal, Role
from app.seed.partner_registry import PARTNERS


class FakeRegistry:
    def list(self, sector=None, state=None):
        return [p for p in PARTNERS if (not sector or p.sector == sector) and (not state or p.state.lower() == state.lower())]

    def get(self, partner_id):
        return next((p for p in PARTNERS if p.id == partner_id), None)


class FakePilot:
    def __init__(self):
        self.calls = []

    def list_partners(self, assessment_id, org_id, region_id, q):
        self.calls.append(assessment_id)
        return PartnerList(partners=[])


def client(authenticated=True):
    app = FastAPI()
    app.include_router(partners.router, prefix="/api/v1", dependencies=[Depends(require_principal)])
    pilot = FakePilot()
    app.dependency_overrides[partners._registry] = FakeRegistry
    app.dependency_overrides[assessments._repository] = lambda: pilot
    if authenticated:
        app.dependency_overrides[require_principal] = lambda: Principal(user_id=uuid4(), org_id=uuid4(), roles=frozenset({Role.MEMBER}))
    return TestClient(app), pilot


def test_directory_is_scored_and_sorted():
    c, _ = client()
    body = c.get("/api/v1/partners").json()
    scores = [Decimal(p["score"]) for p in body["partners"]]
    assert body["total"] == len(PARTNERS) and scores == sorted(scores, reverse=True)
    assert body["scoring_version"] == "trust-v1" and "Advisory screening only" in body["disclosure"]
    assert all(p["simulated"] and p["record_source"] == "simulated_fixture" for p in body["partners"])


def test_directory_filters():
    c, _ = client()
    auto = c.get("/api/v1/partners", params={"sector": "auto"}).json()["partners"]
    assert auto and {p["sector"] for p in auto} == {"auto"}
    guj = c.get("/api/v1/partners", params={"state": "gujarat"}).json()["partners"]
    assert {p["state"] for p in guj} == {"Gujarat"}
    otd = c.get("/api/v1/partners", params={"min_otd": "95"}).json()["partners"]
    assert otd and all(Decimal(p["otd_trailing_pct"]) >= 95 for p in otd)
    strong = c.get("/api/v1/partners", params={"min_trust_score": "80"}).json()["partners"]
    assert strong and all(Decimal(p["score"]) >= 80 for p in strong)
    assert not any(p["tier"] == "blocked" for p in strong)


def test_validation():
    c, _ = client()
    for params in ({"min_otd": "101"}, {"min_trust_score": "-1"}, {"sector": "aerospace"}):
        assert c.get("/api/v1/partners", params=params).status_code == 422, params


def test_assessment_scoped_listing_is_unchanged():
    c, pilot = client()
    aid = uuid4()
    res = c.get("/api/v1/partners", params={"assessment_id": str(aid)})
    assert res.status_code == 200 and res.json() == {"partners": []} and pilot.calls == [aid]


def test_audit_score_breakdown():
    c, _ = client()
    p = next(x for x in PARTNERS if x.partner_name.startswith("Yamuna"))
    body = c.post(f"/api/v1/partners/{p.id}/audit-score").json()
    assert body["tier"] == "not_recommended" and Decimal(body["score"]) == 49
    assert [x["key"] for x in body["components"]] == ["mca", "gst", "litigation", "iso", "credit", "delivery", "cross_border"]
    assert body["flags"][0]["code"] == "litigation_major"
    assert {e["url"] for e in body["evidence"]} == {"https://www.mca.gov.in/", "https://services.gst.gov.in/services/searchtp"}
    assert len(body["inputs_hash"]) == 64


def test_audit_unknown_partner_404_and_auth_required():
    c, _ = client()
    assert c.post(f"/api/v1/partners/{uuid4()}/audit-score").status_code == 404
    unauth, _ = client(authenticated=False)
    assert unauth.get("/api/v1/partners").status_code == 401
    assert unauth.post(f"/api/v1/partners/{PARTNERS[0].id}/audit-score").status_code == 401
