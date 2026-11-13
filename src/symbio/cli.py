import argparse
import json
import os
import tempfile
from pathlib import Path

import relate

from symbio.data import SNAPSHOT, load
from symbio.evaluations import Request, evaluate, transaction
from symbio.graph import build, get
from symbio.storage import checksum, paths, working


def seed():
    target, _ = paths()
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as folder:
        staged = Path(folder) / "seed.rl"
        with relate.connect(str(staged)) as db:
            with transaction(db):
                db.execute("CREATE INDEX entity_id FOR (n:Entity) ON (n.id)")
                build(db)
            runs = [
                evaluate(db, Request(assumption_set=a))
                for a in ("protected", "transferable")
            ]
            logical = get(db, "Snapshot", SNAPSHOT)["fingerprint"]
        manifest = {
            "sha256": checksum(staged),
            "snapshot": logical,
            "evaluations": [r["id"] for r in runs],
        }
        staged.chmod(0o444)
        os.replace(staged, target)
        target.with_suffix(".manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n"
        )
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["seed", "demo", "validate-data", "serve"])
    parser.add_argument("--case", choices=["kalundborg"], default="kalundborg")
    args = parser.parse_args()
    if args.command == "validate-data":
        print(f"{len(load()[2])} claims validated")
    elif args.command == "seed":
        print(json.dumps(seed()))
    elif args.command == "demo":
        with working() as db:
            for agreement in ("protected", "transferable"):
                result = evaluate(db, Request(assumption_set=agreement))
                print(agreement, result["id"], "leaders", result["normal_leaders"])
                for p in result["plans"]:
                    print(p["scenario"], p["candidate"], p["status"], p["objective"])
    else:
        import uvicorn

        uvicorn.run(
            "symbio.api:app",
            host="127.0.0.1",
            port=int(os.getenv("SYMBIO_PORT", "8000")),
            workers=1,
        )


if __name__ == "__main__":
    main()
