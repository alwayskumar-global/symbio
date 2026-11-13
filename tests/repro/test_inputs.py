import csv
import shutil

import pytest

from symbio import data


@pytest.mark.parametrize(
    "key,field,value",
    [
        ("farm-cap", "value", "inf"),
        ("yeast-dm", "unit", "wet t/yr"),
        ("permit", "value", "verified"),
        ("offtake", "effective", "2025"),
        ("gro-supply", "id", "yeast-supply"),
        ("lhv", "locator", ""),
    ],
)
def test_corrupt_case_rejected(tmp_path, monkeypatch, key, field, value):
    shutil.copytree(data.ROOT / "data", tmp_path / "data")
    monkeypatch.setattr(data, "ROOT", tmp_path)
    path = tmp_path / "data/evidence/claims.csv"
    with path.open() as f:
        rows = list(csv.DictReader(f))
    next(c for c in rows if c["id"] == key)[field] = value
    with path.open("w") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0])
        writer.writeheader()
        writer.writerows(rows)
    with pytest.raises(ValueError):
        data.load()
