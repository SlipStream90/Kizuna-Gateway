"""Per-document metadata for ingestion (`data/documents/manifest.json`)."""

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

REFERENCE_STYLES = {"section", "paragraph", "clause", "rule", "regulation", "article"}


@dataclass(frozen=True)
class DocumentMeta:
    file: str
    code: str  # e.g. "RBI-MD-FI"; prefix of every citation_id
    title: str  # e.g. "RBI Master Direction — Foreign Investment in India"
    short_title: str  # used in citation badges, e.g. "RBI Master Direction (FI)"
    authority: str
    reference_style: str  # how numbered units are cited: "Section 149", "Paragraph 4.2", ...
    source: str  # canonical URL, or the local file path when none is known
    last_verified_date: datetime | None


def _derive(file: Path) -> DocumentMeta:
    stem = file.stem
    code = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-").upper()[:64] or "DOC"
    title = re.sub(r"[_-]+", " ", stem).strip()
    return DocumentMeta(str(file.name), code, title, title, "Unknown", "clause", str(file), None)


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def load_manifest(directory: Path) -> dict[str, DocumentMeta]:
    """Map PDF file name → metadata. PDFs missing from the manifest get derived defaults."""
    entries: dict[str, DocumentMeta] = {}
    manifest = directory / "manifest.json"
    if manifest.exists():
        for raw in json.loads(manifest.read_text(encoding="utf-8")).get("documents", []):
            if not (directory / raw["file"]).exists():
                continue  # listed but not downloaded yet
            style = raw.get("reference_style", "clause").lower()
            if style not in REFERENCE_STYLES:
                raise ValueError(f"{raw.get('file')}: reference_style must be one of {sorted(REFERENCE_STYLES)}")
            code = raw["code"]
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", code):
                raise ValueError(f"{raw.get('file')}: invalid document code {code!r}")
            entries[raw["file"]] = DocumentMeta(
                file=raw["file"],
                code=code,
                title=raw["title"],
                short_title=raw.get("short_title", raw["title"]),
                authority=raw.get("authority", "Unknown"),
                reference_style=style,
                source=raw.get("source_url") or str(directory / raw["file"]),
                last_verified_date=_parse_date(raw.get("last_verified_date")),
            )
    for pdf in sorted(directory.glob("*.pdf")):
        entries.setdefault(pdf.name, _derive(pdf))
    return entries
