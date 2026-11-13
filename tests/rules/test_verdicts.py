from symbio.graph import discover
from symbio.optimization import solve


def test_permission_is_conditional_and_prohibition_is_absolute(db, model):
    claims, streams, c = model

    def verdict(candidate):
        return next(
            v
            for v in candidate["paths"][0]["verdicts"]
            if v["rule"] == "rule-authorization-v1"
        )

    assert verdict(c)["status"] == "unresolved"
    assert verdict(c)["planning_assumption"] == "assume-permit"
    db.execute("MATCH (c:Claim {id:'permit'}) SET c.value='prohibited'")
    c = discover(db)[c["id"]]
    assert verdict(c)["status"] == "failed"
    assert solve(claims, streams, c, "transferable", {})["status"] == "ineligible"


def test_missing_measurement_excludes_only_affected_input(db, model):
    claims, streams, c = model
    db.execute("MATCH (:Snapshot)-[r:USES_INPUT]->(:Claim {id:'gro-dm'}) DELETE r")
    c = discover(db)[c["id"]]
    del claims["gro-dm"]
    plan = solve(claims, streams, c, "transferable", {})
    flow = next(a for a in plan["allocations"] if a["exchange"] == "gro/feed")
    assert flow["value"] == 0
