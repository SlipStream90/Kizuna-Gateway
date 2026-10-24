# Statutory source documents

Put the official PDFs here, then copy `manifest.example.json` to `manifest.json`
and adjust it. PDFs are not committed: download them from the issuing authority
so the corpus is traceable to the official text.

| Field | Meaning |
| --- | --- |
| `file` | PDF file name in this folder |
| `code` | Stable document code; prefix of every `citation_id` (e.g. `RBI-MD-FI/Paragraph 4.2`) |
| `title` / `short_title` | Full title, and the label used in citation badges |
| `authority` | Issuing body (RBI, DPIIT, MCA, MHI, …) |
| `reference_style` | How numbered units are cited: `section` (Acts), `paragraph` (RBI Master Directions, FDI Policy), `rule`, `regulation`, `article`, `clause` |
| `source_url` | Canonical URL of the exact PDF (replace the site roots in the example) |
| `last_verified_date` | ISO date a person checked the PDF is the current version; `null` keeps badges marked unverified |

PDFs without a manifest entry are still ingested, with a code and title derived
from the file name and `clause` references.

```bash
pip install -r requirements-rag.txt
python -m app.rag.ingest --dry-run --show 10   # check clause detection first
python -m app.rag.ingest                       # embed + write to statutory_chunks
```

Scanned (image-only) PDFs have no text layer and are rejected; OCR them first.
