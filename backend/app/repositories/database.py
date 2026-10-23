"""PostgreSQL pool lifecycle and transaction-scoped tenant context."""

import os
from collections.abc import Iterator
from contextlib import asynccontextmanager, contextmanager
from uuid import UUID

from fastapi import FastAPI
from psycopg import Connection
from psycopg_pool import ConnectionPool


def create_pool() -> ConnectionPool:
    """Create the application's non-autocommit PostgreSQL connection pool."""
    database_url = os.environ["DATABASE_URL"]
    return ConnectionPool(conninfo=database_url, min_size=1, max_size=10, kwargs={"autocommit": False}, open=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Open one pool for application life and close it during shutdown."""
    pool = create_pool()
    pool.open(wait=True)
    app.state.db_pool = pool
    try:
        yield
    finally:
        pool.close()


@contextmanager
def transaction_for_org(conn: Connection, org_id: UUID) -> Iterator[Connection]:
    """Run work in one transaction with a non-leaking RLS tenant setting."""
    try:
        with conn.transaction():
            conn.execute("SELECT set_config('app.org_id', %s, true)", (str(org_id),))
            yield conn
    finally:
        # SET LOCAL should already expire on transaction end; reset defensively
        # for drivers/pool implementations that retain session state after errors.
        conn.execute("RESET app.org_id")
