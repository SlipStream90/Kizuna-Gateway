"""Structure-aware chunking of statutory text into clause-level citations.

Units follow the document's own numbering — `149.` in an Act, `4.2` in an RBI
Master Direction — inside any Chapter / Part / Schedule. A unit becomes one
chunk; an over-long unit is split at its sub-clause markers ((1), (a), (i), …)
so every chunk still carries an exact reference such as `Section 149(3)(a)`.
"""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from app.rag.manifest import DocumentMeta
from app.rag.pdf_extract import PageText

LABELS = {
    "section": "Section", "paragraph": "Paragraph", "clause": "Clause",
    "rule": "Rule", "regulation": "Regulation", "article": "Article",
}

_DASH = r"[-–—:.]"
# Indian statutes write both "CHAPTER III" and "CHAPTER-III" / "SCHEDULE–I".
_SEP = r"(?:\s+|\s*[-–—]\s*)"
_CHAPTER = re.compile(rf"^(?:CHAPTER|Chapter){_SEP}([IVXLCDM]+|\d{{1,3}})\b\.?\s*(?:{_DASH}\s*)?(.*)$")
_PART = re.compile(rf"^(?:PART|Part){_SEP}([IVXLCDM]+|[A-Z]|\d{{1,3}})\b\.?\s*(?:{_DASH}\s*)?(.*)$")
_SCHEDULE = re.compile(rf"^(?:THE\s+)?(?:SCHEDULE|Schedule)(?:{_SEP}([IVXLCDM]+|\d{{1,3}}|[A-Z]))?\b\.?\s*(?:{_DASH}\s*)?(.*)$")
# "149. Company to have …", "4.2 The investor …", "4.2.1. Where …"; at most 3 digits per component.
_NUMBERED = re.compile(r"^(\d{1,3}(?:\.\d{1,3}){0,3})(?:\.(?!\d))?\)?\s+(\S.*)$")
_SUBCLAUSE = re.compile(r"^\(([a-z]{1,2}|[ivxlc]{1,6}|\d{1,3}|[A-Z])\)\s+\S")
# A real unit heading starts like a sentence or a sub-clause, not mid-sentence ("30 days …").
_HEADING_START = re.compile(r"^[A-Z(\[\"'‘“぀-ヿ一-鿿]")
_ROMAN = re.compile(r"^[ivxlc]+$")
# Headings ("Plantation Sector") state nothing; clauses do ("'FPI' means ...", "... shall ...").
_OPERATIVE = re.compile(r"\b(?:means|shall|may|must|is|are|will|includes?)\b", re.IGNORECASE)
_DOT_LEADER = re.compile(r"(?:\.\s?){6,}|…{2,}")
# A unit's first line may already open sub-clause (1): "149. (1) Every ..." / "149. Title.—(1) Every ...".
_LEAD_SUBCLAUSE = re.compile(r"^\d{1,3}(?:\.\d{1,3})*\.?\s*(?:[^\n]*?[—:]\s*)?\((\d{1,3})\)\s")
# Some PDFs extract several numbered clauses onto one line ("... wherever 2.1.22 'FVCI' means ...").
_INLINE_NUMBER = re.compile(r"(?<=\S)\s+(?=\d{1,3}(?:\.\d{1,3}){1,3}\.?\s+[\"'‘“(A-Z])")
# Indian Acts separate a section's title from its text with an em dash: "149. Title.—(1) Every ...".
_TITLE_BODY_SEP = ("—", ".-", ":-")


@dataclass(frozen=True)
class StatutoryChunk:
    document_code: str
    document_title: str
    document_short_title: str
    authority: str
    reference_style: str
    clause_reference: str
    citation_id: str
    hierarchy: dict[str, Any]
    chunk_index: int
    content: str
    content_hash: str
    source_url_or_file: str
    page_start: int | None
    page_end: int | None
    last_verified_date: datetime | None

    def embedding_text(self) -> str:
        """Contextual header + content: embeds where the clause sits, not just its words."""
        context = [self.document_title, self.clause_reference]
        for key in ("schedule", "chapter_title"):
            if self.hierarchy.get(key):
                context.append(str(self.hierarchy[key]))
        context += [p["heading"] for p in self.hierarchy.get("parents", [])]
        if self.hierarchy.get("heading"):
            context.append(str(self.hierarchy["heading"]))
        return " — ".join(context) + "\n" + self.content


@dataclass
class _Unit:
    number: str | None
    heading: str
    chapter: str | None
    chapter_title: str | None
    part: str | None
    schedule: str | None
    lines: list[tuple[int, str]] = field(default_factory=list)
    parents: list[dict[str, str]] = field(default_factory=list)  # folded ancestor headings


def _ints(number: str) -> list[int]:
    return [int(x) for x in number.split(".")]


def plausible_successor(number: str, previous: str | None, after_heading: bool) -> bool:
    """Whether `number` can follow `previous` in the document's numbering.

    Accepts the first child (4 → 4.1), the next sibling at any depth optionally
    entering its first child (4.2 → 4.3, 4.2.3 → 5, 4 → 5.1), small gaps from
    unparseable pages (+2/+3), and restarts directly after a Chapter/Schedule heading.
    """
    if previous is None or after_heading:
        return True
    parts, prev = _ints(number), _ints(previous)
    if parts[:-1] == prev and parts[-1] == 1:
        return True
    for depth in range(len(prev)):
        if len(parts) > depth and parts[:depth] == prev[:depth] and 1 <= parts[depth] - prev[depth] <= 3:
            if all(x == 1 for x in parts[depth + 1:]):
                return True
    return False


def _marker_kind(label: str, last_alpha: str | None) -> str:
    if label.isdigit():
        return "num"
    if label.isupper():
        return "upper"
    # "i", "v", "x" … are letters when they continue an alphabetic run ((h) → (i)).
    if _ROMAN.match(label) and not (len(label) == 1 and last_alpha and ord(label) == ord(last_alpha) + 1):
        return "roman"
    return "alpha"


def _segments(lines: list[tuple[int, str]]) -> list[tuple[list[str], list[tuple[int, str]]]]:
    """Split a unit's lines at sub-clause markers; each segment carries its nested label path."""
    stack: list[tuple[str, str]] = []
    lead = _LEAD_SUBCLAUSE.match(lines[0][1]) if lines else None
    if lead:
        stack.append(("num", lead.group(1)))
    segments: list[tuple[list[str], list[tuple[int, str]]]] = [([lbl for _, lbl in stack], [])]
    last_alpha: str | None = None
    for page, text in lines:
        match = _SUBCLAUSE.match(text)
        if match:
            label = match.group(1)
            kind = _marker_kind(label, last_alpha)
            if kind == "alpha":
                last_alpha = label
            kinds = [k for k, _ in stack]
            if kind in kinds:
                del stack[kinds.index(kind):]
            stack.append((kind, label))
            segments.append(([lbl for _, lbl in stack], []))
        segments[-1][1].append((page, text))
    return [s for s in segments if s[1]]


def _fmt(path: list[str]) -> str:
    return "".join(f"({p})" for p in path)


def _range_ref(first: list[str], last: list[str]) -> str:
    if first == last:
        return _fmt(first)
    common = 0
    while common < min(len(first), len(last)) and first[common] == last[common]:
        common += 1
    return f"{_fmt(first)}–{_fmt(last[common:]) or _fmt(last)}"


def _sentences(text: str, limit: int) -> list[str]:
    parts = re.split(r"(?<=[.;:])\s+(?=[A-Z(])", text)
    out, buf = [], ""
    for part in parts:
        if buf and len(buf) + len(part) + 1 > limit:
            out.append(buf)
            buf = part
        else:
            buf = f"{buf} {part}".strip()
    if buf:
        out.append(buf)
    # A single sentence longer than the limit is hard-wrapped as a last resort.
    return [s[i:i + limit] for s in out for i in range(0, len(s), limit)]


def _base_reference(unit: _Unit, label: str) -> str:
    if unit.number is None:
        if unit.schedule:
            return unit.schedule
        if unit.chapter:
            return f"Chapter {unit.chapter}"
        return "Preamble"
    ref = f"{label} {unit.number}"
    return f"{unit.schedule}, {ref}" if unit.schedule else ref


def _heading(pattern: re.Pattern[str], line: str) -> re.Match[str] | None:
    """Match a Chapter/Part/Schedule heading, rejecting prose such as "Schedule I of the Rules …"."""
    match = pattern.match(line)
    if match and match.group(2) and match.group(2)[0].islower():
        return None
    # A wrapped prose fragment ("... specified in" / "Schedule IV.") ends like a sentence; headings don't.
    if match and not match.group(2) and line.rstrip().endswith((".", ",", ";")):
        return None
    return match


def _parse_units(pages: list[PageText]) -> list[_Unit]:
    units: list[_Unit] = []
    chapter = chapter_title = part = schedule = None
    previous: str | None = None
    after_heading = False
    current = _Unit(None, "", None, None, None, None)

    def flush() -> None:
        if any(t.strip() for _, t in current.lines):
            units.append(current)

    for page in pages:
        for raw in (part for ln in page.text.splitlines() for part in _INLINE_NUMBER.split(ln)):
            line = re.sub(r"[ \t ]+", " ", raw).strip()
            if not line or _DOT_LEADER.search(line):
                continue  # blank, or a table-of-contents entry with dot leaders
            short = len(line) <= 120
            chapter_m = _heading(_CHAPTER, line) if short else None
            part_m = _heading(_PART, line) if short else None
            schedule_m = _heading(_SCHEDULE, line) if short else None
            numbered_m = _NUMBERED.match(line)

            if chapter_m or part_m or schedule_m:
                flush()
                if chapter_m:
                    chapter, chapter_title = chapter_m.group(1), (chapter_m.group(2) or None)
                    # Schedules close an Act; a Chapter after one (e.g. leaving the arrangement of
                    # sections) means we are back in the body.
                    schedule = None
                elif part_m:
                    part = part_m.group(1)
                else:
                    ident = schedule_m.group(1)
                    schedule = f"Schedule {ident}" if ident else "Schedule"
                after_heading = True
                current = _Unit(None, line, chapter, chapter_title, part, schedule)
                continue

            if (
                numbered_m
                and _HEADING_START.match(numbered_m.group(2))
                and plausible_successor(numbered_m.group(1), previous, after_heading)
            ):
                flush()
                previous, after_heading = numbered_m.group(1), False
                heading = numbered_m.group(2)
                current = _Unit(previous, heading[:120], chapter, chapter_title, part, schedule)
                current.lines.append((page.number, line))
                continue

            # Bare chapter titles often sit on the line after "CHAPTER III".
            if after_heading and chapter and not chapter_title and short and not current.lines:
                chapter_title = current.chapter_title = line
                continue
            current.lines.append((page.number, line))
    flush()
    return units


def chunk_document(pages: list[PageText], meta: DocumentMeta, max_chars: int = 2400) -> list[StatutoryChunk]:
    """Turn cleaned page text into clause-level chunks with exact references."""
    label = LABELS.get(meta.reference_style, "Clause")
    chunks: list[StatutoryChunk] = []
    seen: set[str] = set()

    def emit(unit: _Unit, reference: str, lines: list[tuple[int, str]], subclauses: list[str]) -> None:
        content = "\n".join(t for _, t in lines).strip()
        if not content:
            return
        digest = hashlib.sha256(f"{meta.code}\n{reference}\n{content}".encode()).hexdigest()
        if digest in seen:
            return
        seen.add(digest)
        pages_used = [p for p, _ in lines]
        hierarchy = {
            k: v for k, v in {
                "part": unit.part, "chapter": unit.chapter, "chapter_title": unit.chapter_title,
                "schedule": unit.schedule, "number": unit.number,
                "heading": unit.heading if unit.number else None, "parents": unit.parents or None,
                "subclauses": subclauses or None,
            }.items() if v
        }
        chunks.append(StatutoryChunk(
            document_code=meta.code, document_title=meta.title, document_short_title=meta.short_title,
            authority=meta.authority, reference_style=meta.reference_style, clause_reference=reference,
            citation_id=f"{meta.code}/{reference}", hierarchy=hierarchy, chunk_index=len(chunks),
            content=content, content_hash=digest, source_url_or_file=meta.source,
            page_start=min(pages_used), page_end=max(pages_used), last_verified_date=meta.last_verified_date,
        ))

    units = _parse_units(pages)
    # Heading-only units ("4. Reporting of foreign investment" followed by 4.1, 4.2 …) carry no
    # rule text of their own: fold them into their children as context instead of emitting
    # fragments that dilute retrieval.
    folded: dict[tuple[str | None, str], str] = {}
    skip: set[int] = set()
    for i, unit in enumerate(units):
        nxt = units[i + 1] if i + 1 < len(units) else None
        if (
            unit.number and len(unit.lines) == 1 and nxt and nxt.number
            and nxt.schedule == unit.schedule and nxt.number.startswith(unit.number + ".")
        ):
            folded[(unit.schedule, unit.number)] = unit.heading
            skip.add(i)
        elif unit.number is None and len(unit.lines) == 1:
            line = unit.lines[0][1].strip()
            if len(line) < 60 and not line.endswith((".", ":", ";")):
                skip.add(i)  # a bare title/banner line; the document title is already metadata
        elif unit.number and len(unit.lines) == 1:
            # A one-line unit with no rule text is a contents entry or bare heading: nothing to cite.
            # Acts write every section as "Title.—text", so a short line without the em dash is an
            # arrangement-of-sections entry; elsewhere a real clause is a sentence.
            line = unit.lines[0][1].strip()
            if meta.reference_style == "section":
                title_only = len(line) < 120 and not any(sep in line for sep in _TITLE_BODY_SEP)
            else:
                title_only = not line.endswith((".", ":", ";", "—")) and not _OPERATIVE.search(line)
            if title_only:
                skip.add(i)
        if unit.number:
            parts = unit.number.split(".")
            unit.parents = [
                {"number": n, "heading": folded[(unit.schedule, n)]}
                for n in (".".join(parts[:d]) for d in range(1, len(parts)))
                if (unit.schedule, n) in folded
            ]

    for i, unit in enumerate(units):
        if i in skip:
            continue
        base = _base_reference(unit, label)
        total = sum(len(t) + 1 for _, t in unit.lines)
        if total <= max_chars:
            emit(unit, base, unit.lines, [])
            continue

        # Group consecutive sub-clauses greedily; the lead-in joins the first group.
        groups: list[list[tuple[list[str], list[tuple[int, str]]]]] = [[]]
        size = 0
        for seg in _segments(unit.lines):
            seg_len = sum(len(t) + 1 for _, t in seg[1])
            if groups[-1] and size + seg_len > max_chars:
                groups.append([])
                size = 0
            groups[-1].append(seg)
            size += seg_len

        for group in groups:
            marked = [path for path, _ in group if path]
            ref = base + (_range_ref(marked[0], marked[-1]) if marked else "")
            lines = [ln for _, seg_lines in group for ln in seg_lines]
            text = "\n".join(t for _, t in lines)
            if len(text) <= max_chars:
                emit(unit, ref, lines, ["".join(f"({x})" for x in p) for p in marked])
                continue
            # One sub-clause alone exceeds the budget: fall back to sentence windows.
            pieces = _sentences(text.replace("\n", " "), max_chars)
            page = lines[0][0]
            for k, piece in enumerate(pieces, 1):
                emit(unit, f"{ref} [part {k}/{len(pieces)}]", [(page, piece)], [_fmt(p) for p in marked])
    return chunks
