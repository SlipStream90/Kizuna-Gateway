"""Copy ingested statute chunks from a local Postgres into Supabase.

    DATABASE_URL=postgresql://... SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_... \
        python -m app.seed.push_statutes_to_supabase

Reads `statutory_chunks` (embeddings included, so nothing is re-embedded) and upserts it
through the Supabase Data API with the server-only secret key, in batches. Idempotent:
rows are matched on (document_code, chunk_index).
"""

import json
import os
import sys

import httpx
import psycopg

BATCH = 100
COLUMNS = (
    "document_code, document_title, document_short_title, authority, reference_style, clause_reference, "
    "citation_id, hierarchy, chunk_index, content, content_hash, embedding::text, embedding_model, "
    "source_url_or_file, page_start, page_end, last_verified_date, ingested_at"
)
NAMES = [c.split("::")[0].strip() for c in COLUMNS.split(",")]


def _rows(database_url: str):
    with psycopg.connect(database_url) as conn:
        cur = conn.execute(f"SELECT {COLUMNS} FROM statutory_chunks ORDER BY document_code, chunk_index")
        for row in cur:
            yield {
                name: (value.isoformat() if hasattr(value, "isoformat") else value)
                for name, value in zip(NAMES, row)
            }


def main() -> int:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ.get("SUPABASE_SECRET_KEY", "")
    if not key.startswith("sb_secret_"):
        print("SUPABASE_SECRET_KEY must be the project's secret key (sb_secret_...).", file=sys.stderr)
        return 2
    endpoint = f"{url}/rest/v1/statutory_chunks?on_conflict=document_code,chunk_index"
    headers = {
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    batch, total = [], 0
    with httpx.Client(timeout=60) as client:
        def flush():
            nonlocal total
            res = client.post(endpoint, headers=headers, content=json.dumps(batch))
            if res.status_code >= 300:
                raise SystemExit(f"Supabase rejected batch at row {total}: {res.status_code} {res.text[:300]}")
            total += len(batch)
            batch.clear()
            print(f"  pushed {total}")

        for row in _rows(os.environ["DATABASE_URL"]):
            batch.append(row)
            if len(batch) == BATCH:
                flush()
        if batch:
            flush()
    print(f"statutory_chunks: upserted {total} rows into Supabase")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
