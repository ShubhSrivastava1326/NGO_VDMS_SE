"""Write the API contract to ../docs/openapi.json (re-run whenever the API changes).

    python -m scripts.export_openapi

The frontend can generate typed clients from it, e.g.:
    npx openapi-typescript ../docs/openapi.json -o src/api/schema.d.ts
"""
import json
import os
from pathlib import Path

os.environ.setdefault("BACKGROUND_JOBS_ENABLED", "false")

from app.main import app  # noqa: E402


def main() -> None:
    out = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
