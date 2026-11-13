import json
import os
import shutil
import subprocess
from pathlib import Path

import relate
from ortools.linear_solver import pywraplp


def test_persistent_discovery_solve_explanation(tmp_path):
    cli = shutil.which("relate") or str(Path(".tools/relate").resolve())
    path = str(tmp_path / "proof.rl")
    env = dict(os.environ, DO_NOT_TRACK="1")

    def inspect(query, *flags):
        return subprocess.run(
            [cli, *flags, "--json", "-d", path, "-c", query],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
            env=env,
        )

    with relate.connect(path) as db:
        db.execute(
            "CREATE (:Stream {id:$s})-[:ACCEPTED_BY]->(:Process {id:'digestion'})"
            "-[:JUSTIFIED_BY]->(:Claim {id:'fixture',capacity:3})",
            {"s": "feed"},
        )
        projection = list(
            db.execute(
                "MATCH (:Stream {id:$s})-[:ACCEPTED_BY]->(p:Process)"
                "-[:JUSTIFIED_BY]->(c:Claim) RETURN p.id AS id,c.capacity AS cap",
                {"s": "feed"},
            )
        )
        assert not list(db.execute("MATCH (:Site)-[:HOSTS]->(p:Process) RETURN p.id"))
        solver = pywraplp.Solver.CreateSolver("GLOP")
        flow = solver.NumVar(0, projection[0]["cap"], "feed")
        solver.Maximize(2 * flow)
        assert solver.Solve() == solver.OPTIMAL
        db.execute(
            "MATCH (p:Process {id:$p}) CREATE (:Plan {energy:$e})-[:USES]->(p)",
            {"p": projection[0]["id"], "e": solver.Objective().Value()},
        )
        db.commit()
        locked = inspect("CREATE (:Unexpected)")
        assert locked.returncode == 5, (locked.stdout, locked.stderr)
    result = inspect(
        "MATCH (p:Plan)-[:USES]->(:Process)-[:JUSTIFIED_BY]->(c) RETURN p.energy AS e,c.id AS fact",
        "--read-only",
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["data"] == [{"e": 6, "fact": "fixture"}]
