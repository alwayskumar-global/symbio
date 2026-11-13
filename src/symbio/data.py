import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = "kalundborg-pre-addition"


def digest(obj):
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def load():
    data = ROOT / "data"
    case = json.loads((data / "case/kalundborg.json").read_text())
    sources = json.loads((data / "evidence/sources.json").read_text())
    with (data / "evidence/claims.csv").open() as f:
        rows = list(csv.DictReader(f))
    claims = {r["id"]: r for r in rows}
    if len(claims) != len(rows):
        raise ValueError("Duplicate claim")
    for claim in rows:
        if not all(claim.values()) or claim["source"] not in sources:
            raise ValueError(f"Incomplete provenance: {claim['id']}")
        if claim["classification"] not in {"sourced", "assumed", "inferred"}:
            raise ValueError("Unknown classification")
        if claim["collection"] == "model" and claim["effective"] not in {
            "before spring 2018",
            "2015 study baseline",
            "pre-addition illustrative year",
            "generic pre-addition technology",
        }:
            raise ValueError("Post-addition input")
        if claim["unit"] not in {"category", "statement"}:
            if claim["value"] == "unknown" and claim["id"].endswith(
                ("-dm", "-vs", "-yield")
            ):
                continue
            value = float(claim["value"])
            if (
                not math.isfinite(value)
                or value < 0
                or (claim["unit"] == "fraction" and value > 1)
            ):
                raise ValueError(f"Invalid physical input: {claim['id']}")
    streams = [s["id"] for s in case["streams"]]
    if (
        len(set(streams)) != len(streams)
        or len({s["facility"] for s in case["streams"]}) != 2
    ):
        raise ValueError("Require distinct local supplies")
    expected = {
        "gas-demand": "MWh/yr",
        "offtake": "MWh/yr",
        "farm-cap": "wet t/yr",
        "n-cap": "t N/yr",
        "upgrade-cap": "Nm3/yr",
        "digest-cap": "wet t/yr",
        "recovery": "fraction",
        "own-use": "fraction",
        "lhv": "MWh/Nm3",
        "ch4-frac": "fraction",
        "ch4-density": "kg/Nm3",
        "co2-density": "kg/Nm3",
        **dict.fromkeys(case["capacities"], "wet t/yr"),
    }
    expected.update(
        {
            "direct-km": "km",
            "feed-km": "km",
            "digest-km": "km",
            "protected": "fraction",
            "transferable": "fraction",
        }
    )
    for s in streams:
        expected.update(
            {
                s + "-" + k: u
                for k, u in {
                    "supply": "wet t/yr",
                    "dm": "fraction",
                    "vs": "fraction",
                    "yield": "Nm3/t VS",
                    "nitrogen": "t N/wet t",
                }.items()
            }
        )
    for k, unit in expected.items():
        if claims[k]["unit"] != unit or claims[k]["collection"] != "model":
            raise ValueError(f"Incompatible model input: {k}")
    if (
        claims["permit"]["value"] == "verified"
        and claims["permit"]["classification"] != "sourced"
    ):
        raise ValueError("Verification requires scoped source evidence")
    if float(claims["ch4-frac"]["value"]) <= 0:
        raise ValueError("Raw gas methane fraction must be positive")
    return case, sources, claims
