"""POST /api/v1/compliance/search contract, with the repository and embedder stubbed."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api import compliance
from app.auth.dependencies import require_principal
from app.rag.embeddings import HashingEmbedder
from app.rag.repository import StatutoryHit
from app.schemas.pilot import Principal, Role


def _hit(ref: str, sim: float, verified: bool = False) -> StatutoryHit:
    return StatutoryHit(
        id=uuid4(), document_code="RBI-MD-FI", document_title="RBI Master Direction — Foreign Investment in India",
        document_short_title="RBI Master Direction (FI)", authority="RBI", clause_reference=ref,
        citation_id=f"RBI-MD-FI/{ref}", hierarchy={"chapter": "II", "number": ref.split()[-1]},
        content="Form FC-GPR shall be filed within 30 days of the date of issue.",
        source_url_or_file="https://www.rbi.org.in/md.pdf", page_start=2, page_end=3,
        last_verified_date=datetime(2026, 10, 1, tzinfo=timezone.utc) if verified else None, similarity=sim,
    )


class FakeRepository:
    def __init__(self):
        self.calls = []

    def search(self, vector, model, k, codes, min_similarity):
        self.calls.append({"dims": len(vector), "model": model, "k": k, "codes": codes, "min": min_similarity})
        return [_hit("Paragraph 4.2", 0.83127, verified=True), _hit("Paragraph 4.1", 0.61)][:k]


def make_client(authenticated: bool = True):
    app = FastAPI()
    app.include_router(compliance.router, prefix="/api/v1", dependencies=[Depends(require_principal)])
    repo = FakeRepository()
    app.dependency_overrides[compliance._statute_repository] = lambda: repo
    app.dependency_overrides[compliance._embedder] = lambda: HashingEmbedder()
    if authenticated:
        app.dependency_overrides[require_principal] = lambda: Principal(
            user_id=uuid4(), org_id=uuid4(), roles=frozenset({Role.MEMBER})
        )
    return TestClient(app), repo


def test_search_returns_clause_references_scores_and_citations():
    client, repo = make_client()
    res = client.post("/api/v1/compliance/search", json={
        "query": "FDI caps and FC-GPR filing timelines for auto components", "k": 2, "document_codes": ["RBI-MD-FI"],
    })
    assert res.status_code == 200
    body = res.json()
    assert repo.calls == [{"dims": 384, "model": "hashing-v1", "k": 2, "codes": ["RBI-MD-FI"], "min": None}]
    assert body["embedding_model"] == "hashing-v1" and body["semantic"] is False and body["review_required"] is True
    top = body["results"][0]
    assert top["clause_reference"] == "Paragraph 4.2"
    assert top["citation_id"] == "RBI-MD-FI/Paragraph 4.2"
    assert top["citation"] == "[RBI Master Direction (FI), Paragraph 4.2]"
    assert top["similarity"] == 0.8313 and top["page_start"] == 2
    assert top["badge"]["clause"] == {"en": "Paragraph 4.2", "ja": "パラグラフ4.2"}
    assert body["citation_index"][0].endswith("Paragraph 4.2 (verified 2026-10-01)")


def test_japanese_citation_formatting():
    client, _ = make_client()
    res = client.post("/api/v1/compliance/search", json={"query": "自動車部品の外資規制", "lang": "ja"})
    assert res.status_code == 200
    assert res.json()["results"][0]["citation"] == "［RBI Master Direction (FI)、パラグラフ4.2］"


def test_validation_errors():
    client, _ = make_client()
    for payload in ({"query": "   "}, {"query": "x", "k": 0}, {"query": "x", "k": 21},
                    {"query": "x", "document_codes": ["bad code;drop"]}, {"query": "x", "unexpected": 1}):
        assert client.post("/api/v1/compliance/search", json=payload).status_code == 422, payload


def test_requires_bearer_token():
    client, _ = make_client(authenticated=False)
    assert client.post("/api/v1/compliance/search", json={"query": "FC-GPR"}).status_code == 401


def test_model_unavailable_is_503(monkeypatch):
    client, _ = make_client()
    client.app.dependency_overrides.pop(compliance._embedder)

    def broken():
        raise RuntimeError("sentence-transformers is not installed")

    monkeypatch.setattr(compliance, "get_embedder", broken)
    res = client.post("/api/v1/compliance/search", json={"query": "FC-GPR"})
    assert res.status_code == 503 and "not installed" in res.json()["detail"]
