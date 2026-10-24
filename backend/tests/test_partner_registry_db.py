"""partner_registry against real PostgreSQL (migration 004). Runs when RAG_TEST_DATABASE_URL is set
(an owner role that can create a throwaway schema), as in CI."""

import os
from pathlib import Path
from uuid import uuid4

import pytest

URL = os.environ.get("RAG_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="RAG_TEST_DATABASE_URL not set")
MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "004_partner_registry.sql"


@pytest.fixture
def schema():
    psycopg = pytest.importorskip("psycopg")
    name = f"partner_test_{uuid4().hex[:12]}"
    with psycopg.connect(URL, autocommit=True) as admin:
        admin.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public")
        admin.execute(f"CREATE SCHEMA {name}")
    try:
        with psycopg.connect(URL, options=f"-c search_path={name},public") as conn:
            conn.execute(MIGRATION.read_text(encoding="utf-8"))
        yield name
    finally:
        with psycopg.connect(URL, autocommit=True) as admin:
            admin.execute(f"DROP SCHEMA {name} CASCADE")


def test_upsert_round_trip_and_filters(schema):
    import psycopg
    from psycopg_pool import ConnectionPool

    from app.domain.partner_trust import audit
    from app.repositories.partner_registry_repository import PartnerRegistryRepository, upsert
    from app.seed.partner_registry import PARTNERS

    options = f"-c search_path={schema},public"
    with psycopg.connect(URL, options=options) as conn:
        assert upsert(conn, PARTNERS) == len(PARTNERS)
        assert upsert(conn, PARTNERS) == len(PARTNERS)  # idempotent
        assert conn.execute("SELECT count(*) FROM partner_registry").fetchone()[0] == len(PARTNERS)
        flagged = {r[0] for r in conn.execute("SELECT partner_name FROM partner_registry WHERE litigation_flag")}
        assert flagged == {p.partner_name for p in PARTNERS if p.litigation_flag}

    with ConnectionPool(URL, kwargs={"options": options}, min_size=1, max_size=2) as pool:
        repo = PartnerRegistryRepository(pool)
        for original in PARTNERS:
            loaded = repo.get(original.id)
            assert loaded == original  # exact, including Decimal percentages
            assert audit(loaded).inputs_hash == audit(original).inputs_hash
        assert {p.state for p in repo.list(state="gujarat")} == {"Gujarat"}
        assert {p.sector for p in repo.list(sector="robotics")} == {"robotics"}
        assert repo.get(uuid4()) is None
