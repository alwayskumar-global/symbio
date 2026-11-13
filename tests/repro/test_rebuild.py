import json
import subprocess
import sys

import pytest
import relate

from symbio import evaluations
from symbio.data import ROOT
from symbio.storage import checksum, working


def test_rollback_mid_evaluation(db, monkeypatch):
    old = evaluations.solve

    def fail(*args, **kwargs):
        if args[2]:
            raise RuntimeError("interrupted")
        return old(*args, **kwargs)

    monkeypatch.setattr(evaluations, "solve", fail)
    with pytest.raises(RuntimeError):
        evaluations.evaluate(db, evaluations.Request())
    assert not list(db.execute("MATCH (e:Evaluation) RETURN e.id"))
    assert not list(db.execute("MATCH (p:Plan) RETURN p.id"))


def test_clean_rebuild_and_restart(tmp_path, monkeypatch):
    target = tmp_path / "seed.rl"
    monkeypatch.setenv("SYMBIO_SEED_PATH", str(target))
    monkeypatch.setenv("SYMBIO_WORK_PATH", str(tmp_path / "work.rl"))
    subprocess.run([sys.executable, "-m", "symbio.cli", "seed"], check=True)
    generated = json.loads(target.with_suffix(".manifest.json").read_text())
    shipped = json.loads((ROOT / "dist/kalundborg-seed.manifest.json").read_text())
    assert generated["snapshot"] == shipped["snapshot"]
    assert generated["evaluations"] == shipped["evaluations"]
    with (
        relate.connect(
            str(ROOT / "dist/kalundborg-seed.rl"), read_only=True
        ) as shipped_db,
        working() as db,
    ):
        for eid in shipped["evaluations"]:
            assert evaluations.payload(db, "Evaluation", eid) == evaluations.payload(
                shipped_db, "Evaluation", eid
            )
    subprocess.run(
        [sys.executable, "-m", "symbio.cli", "demo"], check=True, capture_output=True
    )
    assert checksum(target) == generated["sha256"]
