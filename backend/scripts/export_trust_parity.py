"""Write the Python trust-score output for every fixture, for the TypeScript parity test.

    python scripts/export_trust_parity.py ../frontend/test/fixtures/partner-trust-parity.json
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.domain.partner_trust import audit  # noqa: E402
from app.seed.partner_registry import PARTNERS  # noqa: E402

NOW = datetime(2026, 10, 24, tzinfo=timezone.utc)

cases = []
for p in PARTNERS:
    a = audit(p, NOW).model_dump(mode="json", exclude={"record", "computed_at"})
    cases.append({"row": p.model_dump(mode="json"), "expected": a})

out = Path(sys.argv[1])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(cases, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {len(cases)} cases to {out}")
