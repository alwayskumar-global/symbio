import pytest

from symbio.evaluations import Request, evaluate, payload


def test_disruption_reallocates_and_keeps_commitments(db):
    cid = "site-a-intake-500"
    r = evaluate(db, Request(assumption_set="transferable", candidate_ids=[cid]))
    plans = {
        p["scenario"]: payload(db, "Plan", p["id"])
        for p in r["plans"]
        if p["candidate"] == cid
    }
    assert plans["capacity"]["vs_normal"]["percent"] == pytest.approx(-50)
    gone = plans["remove-supplier-yeast"]
    assert gone["vs_baseline"]["percent"] is None
    assert r["worst_supplier_removals"][cid] == ["remove-supplier-yeast"]
    flows = {a["exchange"]: a["value"] for a in gone["allocations"]}
    assert flows["gro/feed"] == pytest.approx(500)
    assert flows["gro/direct"] == pytest.approx(500)
    assert flows["yeast/feed"] == 0
    assert r == evaluate(
        db, Request(assumption_set="transferable", candidate_ids=[cid])
    )


def test_actual_additional_headroom_uses_shared_service_level(model):
    from symbio.optimization import solve

    claims, streams, c = model
    for k in ("dm", "vs", "yield"):
        claims["gro-" + k]["value"] = claims["yeast-" + k]["value"]
    claims[c["capacity_claim"]]["value"] = 500
    plan = solve(
        claims, streams, c, "transferable", {"target": c["id"], "fraction": 0.5}
    )
    maxima = [r["additional"]["value"] for r in plan["route_headroom"]]
    assert sorted(maxima) == pytest.approx([0, 250])
    assert sum(
        a["value"] for a in plan["allocations"] if a["exchange"].endswith("/feed")
    ) == pytest.approx(250)
