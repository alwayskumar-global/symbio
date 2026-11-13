import pytest

from symbio.optimization import solve


def test_hand_calculable_joint_outputs_and_capacity(model):
    claims, streams, c = model
    for s in streams:
        for k, v in {"dm": 0.2, "vs": 0.5, "yield": 100, "supply": 10}.items():
            claims[s + "-" + k]["value"] = v
    for k, v in {
        "lhv": 0.01,
        "ch4-frac": 0.5,
        "recovery": 1,
        "own-use": 0,
        c["capacity_claim"]: 10,
    }.items():
        claims[k]["value"] = v
    plan = solve(claims, streams, c, "transferable", {})
    assert plan["objective"]["value"] == pytest.approx(1)

    def total(route):
        return sum(
            a["value"]
            for a in plan["allocations"]
            if a["exchange"].endswith("/" + route)
        )

    assert total("direct") == pytest.approx(10)
    assert total("raw-gas") == pytest.approx(200)
    assert total("digestate") == pytest.approx(10 - (100 * 0.716 + 100 * 1.977) / 1000)
    assert total("dry") == pytest.approx(2)
    claims["offtake"]["value"] = 0.25
    assert solve(claims, streams, c, "transferable", {})["objective"][
        "value"
    ] == pytest.approx(0.25)


def test_finite_land_and_no_free_sink(model):
    claims, streams, c = model
    claims["farm-cap"]["value"] = 0
    assert solve(claims, streams, c, "transferable", {})["status"] == "infeasible"


def test_idle_candidate_tie_and_fixed_burden(model):
    claims, streams, c = model
    baseline = solve(claims, streams, None, "protected", {})
    assert (
        solve(claims, streams, c, "protected", {})["objective"] == baseline["objective"]
    )
    assert (
        solve(claims, streams, c, "protected", {}, fixed_energy=10)["objective"][
            "value"
        ]
        == -10
    )


def test_impossible_wet_mass_is_unscored(model):
    claims, streams, c = model
    claims["gro-yield"]["value"] = 100000
    result = solve(claims, streams, c, "transferable", {})
    assert result["status"] == "unscored"
    assert "Raw gas mass exceeds wet feed" in result["reason"]
    assert "objective" not in result
