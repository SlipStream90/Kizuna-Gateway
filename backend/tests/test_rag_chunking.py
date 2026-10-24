from datetime import datetime, timezone

from app.rag.chunking import _segments, chunk_document, plausible_successor
from app.rag.citations import citation_index, clause_reference_ja, format_citation, to_badge
from app.rag.manifest import DocumentMeta
from app.rag.pdf_extract import PageText, clean_pages

RBI = DocumentMeta("rbi.pdf", "RBI-MD-FI", "RBI Master Direction — Foreign Investment in India",
                   "RBI Master Direction (FI)", "RBI", "paragraph", "https://www.rbi.org.in/md.pdf", None)
ACT = DocumentMeta("ca.pdf", "CA-2013", "Companies Act, 2013", "Companies Act 2013", "MCA", "section", "ca.pdf",
                   datetime(2026, 10, 1, tzinfo=timezone.utc))


def pages(*texts: str) -> list[PageText]:
    return [PageText(i + 1, t) for i, t in enumerate(texts)]


RBI_TEXT = (
    "These Directions consolidate the framework for foreign investment.\n"
    "CHAPTER II\n"
    "Reporting\n"
    "4. Reporting of foreign investment\n"
    "4.1 An Indian company issuing equity instruments to a person resident outside India shall report the issue.\n"
    "4.2 Form FC-GPR shall be filed within 30 days of the date of issue of equity instruments, and\n"
    "30 days is counted from the date of allotment.\n"
    "(i) the report shall include the valuation certificate;\n"
    "(ii) the report shall be filed on the FIRMS portal.\n"
)


def test_rbi_paragraphs_keep_exact_references_and_chapter_context():
    chunks = chunk_document(pages(RBI_TEXT), RBI)
    refs = [c.clause_reference for c in chunks]
    # "4. Reporting of foreign investment" is heading-only: folded into 4.1/4.2 as parent context.
    assert refs == ["Preamble", "Paragraph 4.1", "Paragraph 4.2"]
    para = chunks[2]
    assert para.hierarchy["parents"] == [{"number": "4", "heading": "Reporting of foreign investment"}]
    assert "Reporting of foreign investment" in para.embedding_text()
    assert para.citation_id == "RBI-MD-FI/Paragraph 4.2"
    assert para.hierarchy["chapter"] == "II" and para.hierarchy["chapter_title"] == "Reporting"
    # The wrapped "30 days …" line is prose inside 4.2, not a new paragraph 30.
    assert "30 days is counted" in para.content and "(ii) the report" in para.content
    assert para.embedding_text().startswith("RBI Master Direction — Foreign Investment in India — Paragraph 4.2")


def test_numbering_plausibility():
    assert plausible_successor("4.3", "4.2", False)
    assert plausible_successor("5", "4.2.3", False)
    assert plausible_successor("4.2.1", "4.2", False)
    assert plausible_successor("5.1", "4", False)
    assert not plausible_successor("30", "4.2", False)
    assert not plausible_successor("1", "4.2", False)
    assert plausible_successor("1", "4.2", True)  # numbering restarts after a Chapter/Schedule heading


SECTION_149 = (
    "149. Company to have Board of Directors.\n"
    "(1) Every company shall have a Board of Directors consisting of individuals as directors and shall have a minimum number of three directors.\n"
    "(3) Every company shall have at least one director who stays in India for a total period of not less than one hundred and eighty-two days.\n"
    "(a) in the case of a newly incorporated company the requirement shall apply proportionately at the end of the financial year concerned.\n"
    "(b) in any other case the requirement applies for the financial year in question and shall be reported in the annual return.\n"
)


def test_long_section_splits_at_nested_subclauses():
    chunks = chunk_document(pages(SECTION_149), ACT, max_chars=200)
    refs = [c.clause_reference for c in chunks]
    assert refs == ["Section 149(1)", "Section 149(3)", "Section 149(3)(a)", "Section 149(3)(b)"]
    assert chunks[0].content.startswith("149. Company to have Board")  # lead-in kept with the first group
    assert all(c.hierarchy["number"] == "149" for c in chunks)
    assert all(len(c.content) <= 200 for c in chunks)


def test_subclause_markers_resolve_letter_vs_roman():
    alpha = _segments([(1, "(g) x"), (1, "(h) y"), (1, "(i) z")])
    assert [p for p, _ in alpha] == [["g"], ["h"], ["i"]]
    roman = _segments([(1, "(a) x"), (1, "(i) y"), (1, "(ii) z")])
    assert [p for p, _ in roman] == [["a"], ["a", "i"], ["a", "ii"]]


def test_schedule_heading_vs_prose_mentioning_a_schedule():
    text = (
        "3. Permission for investment\n"
        "Schedule I of the Rules applies to such investment.\n"
        "SCHEDULE I\n"
        "1. Purchase by a person resident outside India\n"
        "A person resident outside India may purchase equity instruments of an Indian company.\n"
    )
    chunks = chunk_document(pages(text), RBI)
    assert [c.clause_reference for c in chunks] == ["Paragraph 3", "Schedule I, Paragraph 1"]
    assert "Schedule I of the Rules" in chunks[0].content
    assert chunks[1].hierarchy["schedule"] == "Schedule I"


def test_clean_pages_drops_running_headers_footers_and_rejoins_hyphens():
    words = ["alpha", "beta", "gamma", "delta"]
    raw = [
        PageText(n, "\n".join([
            f"RBI/2024-25/{n} Master Direction",  # running header (digits vary)
            f"Intro {w} sentence.", f"Another {w} sentence.",
            f"Note {w} on regu-", f"lation of FC-GPR filings by {w}.",
            f"Further {w} detail.", f"Closing {w} remark.", f"Final {w} line.",
            f"Page {n} of 4",  # footer
        ]))
        for n, w in zip(range(1, 5), words)
    ]
    cleaned = clean_pages(raw)
    for page, w in zip(cleaned, words):
        assert "Master Direction" not in page.text and "Page" not in page.text
        assert f"regulation of FC-GPR filings by {w}" in page.text
        assert f"Intro {w} sentence." in page.text  # varying body lines at the edges survive


def test_chunking_is_deterministic():
    a = chunk_document(pages(RBI_TEXT), RBI)
    b = chunk_document(pages(RBI_TEXT), RBI)
    assert [c.content_hash for c in a] == [c.content_hash for c in b]


def test_citation_formatting_en_ja_index_and_badge():
    assert format_citation("RBI Master Direction (FI)", "Paragraph 4.2") == "[RBI Master Direction (FI), Paragraph 4.2]"
    assert format_citation("Companies Act 2013", "Section 149(3)", "ja") == "［Companies Act 2013、第149条(3)］"
    assert clause_reference_ja("Schedule I, Section 149(3)(a) [part 2/3]") == "別表I、第149条(3)(a)（2/3）"
    assert clause_reference_ja("Paragraph 4.2(a)–(c)") == "パラグラフ4.2(a)–(c)"

    rbi = chunk_document(pages(RBI_TEXT), RBI)
    act = chunk_document(pages(SECTION_149), ACT, max_chars=200)
    lines = citation_index([rbi[2], rbi[2], act[1]])
    assert lines == [
        "[1] RBI — RBI Master Direction — Foreign Investment in India, Paragraph 4.2 (not yet verified)",
        "[2] MCA — Companies Act, 2013, Section 149(3) (verified 2026-10-01)",
    ]
    badge = to_badge(act[1], 0.81234)
    assert badge["url"] is None and badge["file"] == "ca.pdf" and badge["clauseVerified"] is True
    assert badge["label"]["ja"] == "［Companies Act 2013、第149条(3)］" and badge["similarity"] == 0.8123
    assert to_badge(rbi[2])["url"] == "https://www.rbi.org.in/md.pdf"


def test_hyphenated_chapter_and_schedule_headings():
    text = (
        "CHAPTER-III\n"
        "Pricing Guidelines\n"
        "5. Issue price of equity instruments\n"
        "The price shall not be less than the fair value.\n"
        "SCHEDULE–II\n"
        "1. Investment by a Foreign Portfolio Investor\n"
        "An FPI may purchase equity instruments on a recognised stock exchange.\n"
    )
    chunks = chunk_document(pages(text), RBI)
    assert [c.clause_reference for c in chunks] == ["Paragraph 5", "Schedule II, Paragraph 1"]
    assert chunks[0].hierarchy["chapter"] == "III" and chunks[0].hierarchy["chapter_title"] == "Pricing Guidelines"


def test_bare_title_lines_are_dropped_but_sentences_kept():
    text = (
        "THE COMPANIES ACT, 2013\n"
        "149. Company to have Board of Directors.\n"
        "(1) Every company shall have a Board.\n"
    )
    assert [c.clause_reference for c in chunk_document(pages(text), ACT)] == ["Section 149"]
    # A one-line preamble that is a sentence is real content and stays.
    kept = chunk_document(pages("These Directions apply to all Indian companies.\n4.1 The company shall report."), RBI)
    assert [c.clause_reference for c in kept] == ["Preamble", "Paragraph 4.1"]


def test_contents_entries_are_dropped_but_one_line_clauses_kept():
    # Paragraph style: a one-line clause is a sentence; a contents entry is not (or has dot leaders).
    toc = "5.2.1 Agriculture & Animal Husbandry ........................ 51\n5.2.2 Plantation Sector ..................... 52\n"
    body = "CHAPTER 5\n5.2 Manufacturing\n5.2.1 FDI up to 100 percent is permitted under the automatic route.\n5.2.2 Plantation Sector\n"
    # 5.2 is folded into 5.2.1 as context; the trailing bare heading 5.2.2 has nothing to cite.
    assert [c.clause_reference for c in chunk_document(pages(toc + body), RBI)] == ["Paragraph 5.2.1"]
    # Section style: an arrangement-of-sections line lacks the "Title.—text" em dash.
    act = ("149. Company to have Board of Directors.\n150. Manner of selection of independent directors.\n"
           "CHAPTER XI\n149. Company to have Board of Directors.—(1) Every company shall have a Board.\n")
    assert [c.clause_reference for c in chunk_document(pages(act), ACT)] == ["Section 149"]


def test_leading_subclause_on_first_line_seeds_nesting():
    text = ("149. (1) Every company shall have a Board of Directors and shall have—\n"
            "(a) a minimum number of three directors in the case of a public company;\n"
            "(b) a maximum of fifteen directors.\n"
            "(7) Every independent director shall give a declaration of independence.\n")
    refs = [c.clause_reference for c in chunk_document(pages(text), ACT, max_chars=140)]
    assert refs[0].startswith("Section 149(1)") and "Section 149(7)" in refs
    assert not any("(b)(7)" in r for r in refs)


def test_inline_numbered_definitions_are_split():
    text = "2.1.21 'FPI' means Foreign Portfolio Investor wherever 2.1.22 ‘FVCI’ means a Foreign Venture Capital Investor.\n"
    refs = [c.clause_reference for c in chunk_document(pages(text), RBI)]
    assert refs == ["Paragraph 2.1.21", "Paragraph 2.1.22"]


def test_wrapped_schedule_reference_is_not_a_heading():
    text = ("149. Company to have Board of Directors.—(8) The company and independent directors shall abide by the provisions specified in\n"
            "Schedule IV.\n"
            "150. Manner of selection of independent directors.—(1) An independent director may be selected from a data bank.\n")
    chunks = chunk_document(pages(text), ACT)
    assert [c.clause_reference for c in chunks] == ["Section 149", "Section 150"]
    assert all("schedule" not in c.hierarchy for c in chunks)
