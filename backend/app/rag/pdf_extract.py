"""PDF text extraction that keeps page numbers and drops running headers/footers."""

import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PageText:
    number: int  # 1-based
    text: str


_PAGE_NUMBER = re.compile(r"^\s*(?:page\s*)?\d{1,4}(?:\s*(?:of|/)\s*\d{1,4})?\s*$", re.IGNORECASE)


def extract_pages(path: Path) -> list[PageText]:
    """Read every page's text with pypdf. Scanned (image-only) pages come back empty."""
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    return [PageText(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]


def _signature(line: str) -> str:
    # Digits vary across pages ("Page 3", "RBI/2024-25/7"), so compare shapes.
    return re.sub(r"\d+", "#", line.strip().lower())


def clean_pages(pages: list[PageText], edge_lines: int = 3, min_share: float = 0.6) -> list[PageText]:
    """Remove repeated header/footer lines and bare page numbers; rejoin hyphenated words.

    A line is a running header/footer when its digit-normalised shape appears
    in the first or last `edge_lines` lines of at least `min_share` of pages.
    """
    split = [p.text.splitlines() for p in pages]
    counts: Counter[str] = Counter()
    for lines in split:
        edges = {_signature(x) for x in lines[:edge_lines] + lines[-edge_lines:] if x.strip()}
        counts.update(edges)
    # Long documents often alternate header shapes on facing pages (each on ~50% of pages),
    # so relax the share; digit-normalised body lines rarely repeat that often.
    share = min(min_share, 0.3) if len(pages) >= 10 else min_share
    threshold = max(2, int(len(pages) * share))
    running = {sig for sig, n in counts.items() if n >= threshold} if len(pages) >= 3 else set()

    cleaned: list[PageText] = []
    for page, lines in zip(pages, split):
        kept = []
        for i, line in enumerate(lines):
            at_edge = i < edge_lines or i >= len(lines) - edge_lines
            if _PAGE_NUMBER.match(line) or (at_edge and _signature(line) in running):
                continue
            kept.append(line.rstrip())
        text = "\n".join(kept)
        # "regu-\nlation" -> "regulation"; keep real hyphens such as "FC-GPR".
        text = re.sub(r"(?<=[a-z])-\n(?=[a-z])", "", text)
        cleaned.append(PageText(page.number, text))
    return cleaned
