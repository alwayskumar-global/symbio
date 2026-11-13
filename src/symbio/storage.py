import fcntl
import hashlib
import json
import os
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path

import relate

from symbio.data import ROOT, SNAPSHOT
from symbio.graph import get


def paths():
    seed = (
        ROOT / os.environ.get("SYMBIO_SEED_PATH", "dist/kalundborg-seed.rl")
    ).resolve()
    work = (ROOT / os.environ.get("SYMBIO_WORK_PATH", "var/kalundborg.rl")).resolve()
    if seed == work or seed.exists() and work.exists() and seed.samefile(work):
        raise ValueError("Working store must be independent of seed")
    return seed, work


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


@contextmanager
def working():
    seed, work = paths()
    work.parent.mkdir(parents=True, exist_ok=True)
    with work.with_suffix(".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        manifest = json.loads(seed.with_suffix(".manifest.json").read_text())
        if not work.exists():
            with tempfile.NamedTemporaryFile(dir=work.parent) as tmp:
                shutil.copyfile(seed, tmp.name)
                if checksum(Path(tmp.name)) != manifest["sha256"]:
                    raise ValueError("Seed checksum differs from manifest")
                os.link(tmp.name, work)
        with relate.connect(str(work)) as db:
            if get(db, "Snapshot", SNAPSHOT)["fingerprint"] != manifest["snapshot"]:
                raise ValueError(
                    "Working store belongs to another snapshot. Select a fresh SYMBIO_WORK_PATH to use this seed."
                )
            yield db
