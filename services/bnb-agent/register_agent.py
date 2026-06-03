from __future__ import annotations

import argparse
import json
import os
from manifest import build_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Register or dry-run the TriStack Alpha Agent manifest.")
    parser.add_argument("--dry-run", action="store_true", help="Print manifest and do not touch chain state.")
    args = parser.parse_args()

    manifest = build_manifest()
    if args.dry_run or not os.getenv("PRIVATE_KEY"):
        print(json.dumps({"dryRun": True, "manifest": manifest, "note": "No registration transaction was signed or broadcast."}, indent=2))
        return 0

    try:
        import bnbagent  # type: ignore
    except Exception as exc:
        print(json.dumps({"dryRun": False, "error": "bnbagent package is not installed", "detail": str(exc), "manifest": manifest}, indent=2))
        return 2

    print(json.dumps({"dryRun": False, "status": "manual-registration-required", "sdk": str(bnbagent), "manifest": manifest}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
