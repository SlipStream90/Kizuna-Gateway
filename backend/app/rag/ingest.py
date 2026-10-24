"""Ingest statutory PDFs into `statutory_chunks`.

    python -m app.rag.ingest                       # every PDF in data/documents/
    python -m app.rag.ingest --only rbi-md-fi.pdf  # one document
    python -m app.rag.ingest --dry-run --show 8    # parse + chunk only; no model, no database

Writes with RAG_INGEST_DATABASE_URL (a role allowed to INSERT/DELETE) or, if unset,
DATABASE_URL. Re-ingesting a document atomically replaces its previous chunks.
"""

import argparse
import os
import sys
from pathlib import Path

from app.rag.chunking import StatutoryChunk, chunk_document
from app.rag.config import rag_settings
from app.rag.manifest import DocumentMeta, load_manifest
from app.rag.pdf_extract import clean_pages, extract_pages


def parse_document(path: Path, meta: DocumentMeta, max_chars: int) -> list[StatutoryChunk]:
    pages = clean_pages(extract_pages(path))
    if not any(p.text.strip() for p in pages):
        raise ValueError(f"{path.name}: no extractable text (scanned PDF?); OCR it before ingesting")
    return chunk_document(pages, meta, max_chars=max_chars)


def _preview(chunks: list[StatutoryChunk], show: int) -> None:
    for c in chunks[:show]:
        pages = f"p.{c.page_start}" + (f"-{c.page_end}" if c.page_end != c.page_start else "")
        body = " ".join(c.content.split())
        print(f"    [{c.chunk_index:>3}] {c.citation_id}  ({pages}, {len(c.content)} chars)")
        print(f"          {body[:140]}{'...' if len(body) > 140 else ''}")


def main(argv: list[str] | None = None) -> int:
    # Statute text contains characters (₹, —, kanji) that legacy consoles can't encode.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    settings = rag_settings()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", type=Path, default=settings.documents_dir)
    parser.add_argument("--only", nargs="*", help="PDF file names to ingest (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="parse and chunk without embedding or writing")
    parser.add_argument("--show", type=int, default=0, help="print the first N chunks of each document")
    parser.add_argument("--max-chars", type=int, default=settings.max_chunk_chars)
    args = parser.parse_args(argv)

    manifest = load_manifest(args.dir)
    targets = {k: v for k, v in manifest.items() if not args.only or k in args.only}
    missing = set(args.only or []) - set(targets)
    if missing:
        print(f"error: not found in {args.dir}: {', '.join(sorted(missing))}", file=sys.stderr)
        return 2
    if not targets:
        print(f"No PDFs found in {args.dir}. See data/documents/README.md.", file=sys.stderr)
        return 1

    parsed: list[tuple[DocumentMeta, list[StatutoryChunk]]] = []
    failures = 0
    for name, meta in sorted(targets.items()):
        try:
            chunks = parse_document(args.dir / name, meta, args.max_chars)
        except Exception as exc:  # report and continue with the other documents
            failures += 1
            print(f"FAIL {name}: {exc}", file=sys.stderr)
            continue
        print(f"ok   {name} -> {meta.code}: {len(chunks)} chunks")
        _preview(chunks, args.show)
        parsed.append((meta, chunks))

    if args.dry_run or not parsed:
        return 1 if failures else 0

    import psycopg

    from app.rag.embeddings import get_embedder
    from app.rag.repository import replace_document

    embedder = get_embedder()
    url = os.environ.get("RAG_INGEST_DATABASE_URL") or os.environ["DATABASE_URL"]
    with psycopg.connect(url) as conn:
        for meta, chunks in parsed:
            vectors = embedder.embed_documents([c.embedding_text() for c in chunks])
            written = replace_document(conn, chunks, vectors, embedder.model_name)
            print(f"     {meta.code}: wrote {written} chunks with {embedder.model_name}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
