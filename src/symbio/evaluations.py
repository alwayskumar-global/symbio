import json
from contextlib import contextmanager
from importlib.metadata import version
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from symbio.data import SNAPSHOT, digest
from symbio.graph import discover, get, inputs, link, node, rows
from symbio.optimization import TOL, solve


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    snapshot: str = SNAPSHOT
    candidate_ids: list[str] | None = None
    assumption_set: Literal["protected", "transferable"] = "protected"
    capacity_fraction: float = Field(default=0.5, ge=0, le=1)
    capacity_target: str | None = None
    remove_suppliers: list[str] | None = None


@contextmanager
def transaction(db):
    db.autocommit = False
    try:
        yield
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.autocommit = True


def payload(db, label, uid):
    return json.loads(get(db, label, uid)["payload"])


def delta(current, previous):
    if current["status"] != "optimal" or previous["status"] != "optimal":
        return None
    before = previous["objective"]["value"]
    change = current["objective"]["value"] - before
    old = {a["exchange"]: a["value"] for a in previous["allocations"]}
    return {
        "mwh": change,
        "percent": 100 * change / before if abs(before) > TOL else None,
        "changed_exchanges": [
            {**a, "delta": a["value"] - old[a["exchange"]]}
            for a in current["allocations"]
            if abs(a["value"] - old[a["exchange"]]) > TOL
        ],
    }


def evaluate(db, req):
    snapshot = get(db, "Snapshot", req.snapshot)
    choices = discover(db)
    ids = sorted(set(req.candidate_ids if req.candidate_ids is not None else choices))
    streams = {
        r["s"]: r["f"]
        for r in rows(
            db,
            "MATCH (:Snapshot {id:$id})-[:INCLUDES]->(f:Facility)-[:PRODUCES]->(s:Stream) RETURN f.id AS f,s.id AS s",
            id=req.snapshot,
        )
    }
    suppliers = sorted(
        set(
            req.remove_suppliers
            if req.remove_suppliers is not None
            else streams.values()
        )
    )
    if (
        set(ids) - choices.keys()
        or set(suppliers) - set(streams.values())
        or (req.capacity_target and req.capacity_target not in ids)
    ):
        raise ValueError("Unknown or out-of-snapshot candidate, supplier or target")
    benchmark_routes = rows(
        db,
        "MATCH (s:Stream)-[:EXISTING_USE]->(d:Destination),"
        "(s)-[:SUBJECT_TO]->(c:Commitment)-[:DELIVER_TO]->(d),"
        "(c)-[:TERMS]->(:Claim {id:$agreement}) RETURN DISTINCT s.id AS id ORDER BY id",
        agreement=req.assumption_set,
    )
    if {r["id"] for r in benchmark_routes} != set(streams):
        raise ValueError("Incomplete baseline destination or commitment evidence")
    claims = inputs(db)
    manifest = {
        "snapshot": req.snapshot,
        "snapshot_hash": snapshot["fingerprint"],
        "assumption_hash": digest(claims),
        "model_version": "annual-3",
        "solver": "GLOP",
        "ortools": version("ortools"),
        "relate": version("relate-db"),
        "threads": 1,
        "tolerance": TOL,
        "rule_versions": sorted(
            {
                v["rule"]
                for cid in ids
                for p in choices[cid]["paths"]
                for v in p["verdicts"]
            }
        ),
        "input_units": {k: c["unit"] for k, c in claims.items()},
    }
    manifest["projection_hash"] = digest([streams, claims, choices, benchmark_routes])
    fingerprint = digest(
        [
            manifest,
            req.model_dump() | {"candidate_ids": ids, "remove_suppliers": suppliers},
        ]
    )
    eid = "eval-" + fingerprint[:24]
    existing = rows(db, "MATCH (e:Evaluation {id:$id}) RETURN e.payload AS p", id=eid)
    if existing:
        return json.loads(existing[0]["p"])
    plans = {}
    scenarios = {
        "normal": {},
        "capacity": {"fraction": req.capacity_fraction, "target": req.capacity_target},
        **{"remove-" + s: {"supplier": s} for s in suppliers},
    }
    summaries = []
    with transaction(db):
        node(db, "Evaluation", eid)
        link(db, eid, "ON_SNAPSHOT", req.snapshot)
        for scenario, shock in scenarios.items():
            scenario_id = eid + "/" + scenario
            node(
                db,
                "Scenario",
                scenario_id,
                parameters=json.dumps(shock),
                agreement=req.assumption_set,
            )
            link(db, eid, "TESTS", scenario_id)
            for cid in ["baseline", *ids]:
                applied = dict(shock)
                if scenario == "capacity" and not applied["target"]:
                    applied["target"] = cid if cid != "baseline" else None
                candidate = choices.get(cid)
                plan = solve(claims, streams, candidate, req.assumption_set, applied)
                pid = scenario_id + "/" + cid
                # Slash-free public IDs can travel as one URL path component.
                pid = "plan-" + digest(pid)[:24]
                plan.update(
                    id=pid,
                    evaluation=eid,
                    candidate=cid,
                    scenario=scenario,
                    disruption=applied,
                    assumption_set=req.assumption_set,
                    manifest=manifest,
                    conditional=bool(candidate),
                    eligibility="conditional planning"
                    if candidate
                    else "reconstructed existing use",
                )
                verdicts = [
                    v
                    for path in (candidate or {}).get("paths", [])
                    for v in path["verdicts"]
                ]
                plan["requirements"] = verdicts
                plan["facts"] = sorted(
                    set(plan["facts"])
                    | {v["measurement"] for v in verdicts if v["measurement"] in claims}
                    | {
                        v["planning_assumption"]
                        for v in verdicts
                        if v["planning_assumption"]
                    }
                )
                plan["vs_normal"] = delta(plan, plans.get(("normal", cid), plan))
                plan["vs_baseline"] = delta(
                    plan, plans.get((scenario, "baseline"), plan)
                )
                plans[scenario, cid] = plan
                node(db, "Plan", pid, payload=json.dumps(plan))
                link(db, scenario_id, "HAS_PLAN", pid)
                if candidate:
                    link(db, pid, "EVALUATES", cid)
                for key in plan["facts"]:
                    link(db, pid, "DEPENDS_ON", key)
                for v in verdicts:
                    vid = pid + "/" + v["stream"] + "/" + v["rule"]
                    node(db, "Verdict", vid, status=v["status"])
                    link(db, pid, "HAS_VERDICT", vid)
                    link(db, vid, "APPLIES", v["rule"])
                    link(db, vid, "ON_STREAM", v["stream"])
                    if v["measurement"] in claims:
                        link(db, vid, "USES", v["measurement"])
                for a in plan["allocations"]:
                    aid = pid + "/" + a["exchange"]
                    node(db, "Allocation", aid, **a)
                    link(db, pid, "ALLOCATES", aid)
                    link(db, aid, "FROM_STREAM", a["exchange"].split("/")[0])
                for c in plan.get("constraints", []):
                    key = pid + "/" + c["id"]
                    node(
                        db,
                        "ConstraintResult",
                        key,
                        active=c["active"],
                        slack=c["slack"]["value"],
                        unit=c["slack"]["unit"],
                    )
                    link(db, pid, "BOUNDED_BY", key)
                    for fact in c["facts"]:
                        link(db, key, "USES", fact)
                summaries.append(
                    {
                        key: plan.get(key)
                        for key in (
                            "id",
                            "status",
                            "objective",
                            "candidate",
                            "scenario",
                            "vs_normal",
                            "vs_baseline",
                        )
                    }
                )

        def best(values):
            valid = {
                k: p["objective"]["value"]
                for k, p in values
                if p["status"] == "optimal"
            }
            return sorted(k for k, x in valid.items() if max(valid.values()) - x <= TOL)

        leaders = best((cid, plans["normal", cid]) for cid in ["baseline", *ids])
        worst = {}
        for cid in ["baseline", *ids]:
            removed = [plans["remove-" + s, cid] for s in suppliers]
            failed = [p for p in removed if p["status"] != "optimal"]
            lowest = min(
                (p["objective"]["value"] for p in removed if p["status"] == "optimal"),
                default=None,
            )
            worst[cid] = [
                p["scenario"]
                for p in (failed or removed)
                if failed or abs(p["objective"]["value"] - lowest) <= TOL
            ]
        normal = [
            p
            for p in summaries
            if p["scenario"] == "normal" and p["status"] == "optimal"
        ]
        normal.sort(key=lambda p: -p["objective"]["value"])
        ranking = []
        rank = 0
        reference = None
        for pos, p in enumerate(normal, 1):
            score = p["objective"]["value"]
            if reference is None or reference - score > TOL:
                rank, reference = pos, score
            ranking.append(
                {"rank": rank, "candidate": p["candidate"], "objective": p["objective"]}
            )
        result = {
            "ranking": ranking,
            "id": eid,
            "manifest": manifest,
            "assumption_set": req.assumption_set,
            "plans": summaries,
            "normal_leaders": leaders,
            "recommendation": "baseline" if "baseline" in leaders else leaders,
            "worst_supplier_removals": worst,
            "worst_case_leaders": best(
                (cid, plans[w[0], cid]) for cid, w in worst.items() if w
            ),
        }
        db.execute(
            "MATCH (e:Evaluation {id:$id}) SET e.payload=$p",
            {"id": eid, "p": json.dumps(result)},
        )
    return result
