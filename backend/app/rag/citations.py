"""Formal statutory citations for the Ringi-sho generator and JIG-OS citation badges.

    format_citation(...)        -> "[RBI Master Direction (FI), Paragraph 4.2(a)]"
    format_citation(..., "ja")  -> "［RBI Master Direction (FI)、パラグラフ4.2(a)］"
    citation_index(results)     -> numbered "Regulatory Citation Index" lines
    to_badge(result)            -> payload matching the JIG-OS CitationBadge source shape
"""

import re
from datetime import datetime
from typing import Literal, Protocol, Sequence

Lang = Literal["en", "ja"]

# Japanese renderings of how Indian instruments number their units.
_JA_UNIT = {
    "Section": "第{n}条", "Article": "第{n}条", "Paragraph": "パラグラフ{n}",
    "Clause": "第{n}項", "Rule": "規則{n}", "Regulation": "規程{n}",
}
_UNIT = re.compile(r"\b(Section|Article|Paragraph|Clause|Rule|Regulation) (\d+(?:\.\d+)*)")


class CitableChunk(Protocol):
    document_short_title: str
    document_title: str
    authority: str
    clause_reference: str
    citation_id: str
    content: str
    source_url_or_file: str
    last_verified_date: datetime | None


def clause_reference_ja(reference: str) -> str:
    """'Schedule I, Section 149(3)(a) [part 2/3]' -> '別表I、第149条(3)(a)（2/3）'."""
    ja = _UNIT.sub(lambda m: _JA_UNIT[m.group(1)].format(n=m.group(2)), reference)
    ja = re.sub(r"\bSchedule\b ?", "別表", ja)
    ja = re.sub(r"\bChapter (\w+)", r"第\1章", ja)
    ja = ja.replace("Preamble", "前文").replace(", ", "、")
    return re.sub(r" \[part (\d+)/(\d+)\]", r"（\1/\2）", ja)


def format_citation(short_title: str, clause_reference: str, lang: Lang = "en") -> str:
    if lang == "ja":
        return f"［{short_title}、{clause_reference_ja(clause_reference)}］"
    return f"[{short_title}, {clause_reference}]"


def citation_index(chunks: Sequence[CitableChunk], lang: Lang = "en") -> list[str]:
    """Numbered lines for the Ringi-sho's Regulatory Citation Index, one per distinct clause."""
    lines: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        if chunk.citation_id in seen:
            continue
        seen.add(chunk.citation_id)
        ref = clause_reference_ja(chunk.clause_reference) if lang == "ja" else chunk.clause_reference
        if chunk.last_verified_date:
            day = chunk.last_verified_date.date().isoformat()
            verified = f"（{day} 確認）" if lang == "ja" else f" (verified {day})"
        else:
            verified = "（未確認）" if lang == "ja" else " (not yet verified)"
        sep = "、" if lang == "ja" else ", "
        lines.append(f"[{len(lines) + 1}] {chunk.authority} — {chunk.document_title}{sep}{ref}{verified}")
    return lines


def excerpt(text: str, limit: int = 280) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[: limit - 1].rsplit(" ", 1)[0] + "…"


def to_badge(chunk: CitableChunk, similarity: float | None = None) -> dict:
    """Shape consumed by the JIG-OS CitationBadge (bilingual title/clause, url, summary)."""
    url = chunk.source_url_or_file if chunk.source_url_or_file.startswith(("http://", "https://")) else None
    return {
        "id": chunk.citation_id,
        "authority": chunk.authority,
        "title": {"en": chunk.document_title, "ja": chunk.document_title},
        "clause": {"en": chunk.clause_reference, "ja": clause_reference_ja(chunk.clause_reference)},
        # Retrieved from the ingested source text itself, so the locator is exact;
        # "verified" additionally requires a human verification date on the document.
        "clauseVerified": chunk.last_verified_date is not None,
        "label": {
            "en": format_citation(chunk.document_short_title, chunk.clause_reference, "en"),
            "ja": format_citation(chunk.document_short_title, chunk.clause_reference, "ja"),
        },
        "url": url,
        "file": None if url else chunk.source_url_or_file,
        "summary": {"en": excerpt(chunk.content), "ja": excerpt(chunk.content)},
        "similarity": None if similarity is None else round(similarity, 4),
    }
