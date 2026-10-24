"""End-to-end PDF → pages → clean → clause chunks, using a generated text PDF."""

import pytest

pytest.importorskip("pypdf")

from app.rag.ingest import main as ingest_main
from app.rag.ingest import parse_document
from app.rag.manifest import DocumentMeta


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_pdf(pages: list[list[str]]) -> bytes:
    """Minimal valid PDF: one Helvetica text line per entry, top to bottom."""
    objects: list[bytes] = []
    n_pages = len(pages)
    page_ids = [4 + 2 * i for i in range(n_pages)]
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    for i, lines in enumerate(pages):
        stream = "".join(f"BT /F1 10 Tf 50 {780 - 16 * j} Td ({_escape(t)}) Tj ET\n" for j, t in enumerate(lines)).encode()
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> "
            f"/Contents {page_ids[i] + 1} 0 R >>".encode()
        )
        objects.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream")
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for num, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{num} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def _page(n: int, body: list[str]) -> list[str]:
    return [f"RBI/2024-25/{n} Master Direction - Foreign Investment", *body, f"Page {n} of 3"]


PAGES = [
    _page(1, [
        "CHAPTER II",
        "Reporting",
        "4. Reporting of foreign investment",
        "4.1 An Indian company shall report receipt of consideration for issue of equity.",
        "The report is made through the authorised dealer bank.",
    ]),
    _page(2, [
        "4.2 Form FC-GPR shall be filed within 30 days of the date of issue",
        "of equity instruments to the person resident outside India.",
        "(i) the filing shall include a valuation certificate;",
    ]),
    _page(3, [
        "(ii) the filing shall be made on the FIRMS portal of the Reserve Bank.",
        "4.3 Delayed reporting attracts a late submission fee.",
        "The fee is computed as provided in these Directions.",
    ]),
]

META = DocumentMeta("rbi.pdf", "RBI-MD-FI", "RBI Master Direction — Foreign Investment in India",
                    "RBI Master Direction (FI)", "RBI", "paragraph", "rbi.pdf", None)


def test_pdf_to_clause_chunks_with_page_ranges(tmp_path):
    pdf = tmp_path / "rbi.pdf"
    pdf.write_bytes(make_pdf(PAGES))
    chunks = parse_document(pdf, META, max_chars=2400)

    by_ref = {c.clause_reference: c for c in chunks}
    assert list(by_ref) == ["Paragraph 4.1", "Paragraph 4.2", "Paragraph 4.3"]  # heading-only "4." folded
    para = by_ref["Paragraph 4.2"]
    assert (para.page_start, para.page_end) == (2, 3)  # continues across the page break
    assert "(ii) the filing shall be made on the FIRMS portal" in para.content
    assert all("Master Direction" not in c.content and "Page " not in c.content for c in chunks)
    assert by_ref["Paragraph 4.1"].hierarchy["chapter_title"] == "Reporting"


def test_ingest_dry_run_reports_chunks(tmp_path, capsys):
    (tmp_path / "rbi.pdf").write_bytes(make_pdf(PAGES))
    assert ingest_main(["--dir", str(tmp_path), "--dry-run", "--show", "2"]) == 0
    out = capsys.readouterr().out
    assert "rbi.pdf -> RBI: 3 chunks" in out and "RBI/Clause 4.1" in out  # derived meta: code from file name


def test_scanned_pdf_without_text_is_rejected(tmp_path):
    pdf = tmp_path / "scan.pdf"
    pdf.write_bytes(make_pdf([[], []]))
    with pytest.raises(ValueError, match="no extractable text"):
        parse_document(pdf, META, max_chars=2400)
