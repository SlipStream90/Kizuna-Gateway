"""Load the simulated partner directory fixtures into partner_registry (idempotent).

    python -m app.seed.load_partner_registry

Uses PARTNER_SEED_DATABASE_URL (a role allowed to write) or, if unset, DATABASE_URL.
"""

import os

import psycopg

from app.repositories.partner_registry_repository import upsert
from app.seed.partner_registry import PARTNERS


def main() -> int:
    url = os.environ.get("PARTNER_SEED_DATABASE_URL") or os.environ["DATABASE_URL"]
    with psycopg.connect(url) as conn:
        written = upsert(conn, PARTNERS)
    print(f"partner_registry: upserted {written} simulated fixture partners")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
