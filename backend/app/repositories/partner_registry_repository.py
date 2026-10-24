"""PostgreSQL access for the shared partner_registry directory (not tenant-scoped)."""

from typing import Sequence
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.schemas.partner_registry import PartnerRecord

_JSON_FIELDS = ("mca_compliance", "gst_compliance", "director_history", "litigation", "credit_rating",
                "iso_certifications", "operations", "cross_border")
_COLUMNS = ("id", "partner_name", "record_source", "sector", "state", "city", "partner_type", "mca_registration_no",
            "gstin", "registered_address", "incorporated_on", *_JSON_FIELDS, "financial_solvency_score", "data_as_of")


def _record(row: Sequence) -> PartnerRecord:
    return PartnerRecord.model_validate(dict(zip(_COLUMNS, row)))


class PartnerRegistryRepository:
    def __init__(self, pool: ConnectionPool):
        self._pool = pool

    def list(self, sector: str | None = None, state: str | None = None) -> list[PartnerRecord]:
        where, params = [], []
        if sector:
            where.append("sector = %s")
            params.append(sector)
        if state:
            where.append("lower(state) = lower(%s)")
            params.append(state)
        sql = f"SELECT {', '.join(_COLUMNS)} FROM partner_registry"
        if where:
            sql += " WHERE " + " AND ".join(where)
        with self._pool.connection() as conn, conn.transaction():
            conn.execute("SET TRANSACTION READ ONLY")
            return [_record(r) for r in conn.execute(sql + " ORDER BY partner_name", params).fetchall()]

    def get(self, partner_id: UUID) -> PartnerRecord | None:
        with self._pool.connection() as conn, conn.transaction():
            conn.execute("SET TRANSACTION READ ONLY")
            row = conn.execute(f"SELECT {', '.join(_COLUMNS)} FROM partner_registry WHERE id = %s", (partner_id,)).fetchone()
        return _record(row) if row else None


def upsert(conn: Connection, records: Sequence[PartnerRecord]) -> int:
    """Insert or replace directory rows by id (idempotent fixture loading)."""
    assignments = ", ".join(f"{c} = EXCLUDED.{c}" for c in _COLUMNS if c != "id")
    sql = (f"INSERT INTO partner_registry ({', '.join(_COLUMNS)}, litigation_flag, updated_at) "
           f"VALUES ({', '.join(['%s'] * (len(_COLUMNS) + 1))}, now()) "
           f"ON CONFLICT (id) DO UPDATE SET {assignments}, litigation_flag = EXCLUDED.litigation_flag, updated_at = now()")
    with conn.transaction(), conn.cursor() as cur:
        rows = []
        for r in records:
            data = r.model_dump(mode="json")  # Decimals → strings, dates → ISO: exact round trip
            rows.append(tuple(Jsonb(data[c]) if c in _JSON_FIELDS else data[c] for c in _COLUMNS) + (r.litigation_flag,))
        cur.executemany(sql, rows)
    return len(records)
