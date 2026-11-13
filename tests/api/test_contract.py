import pytest
from fastapi.testclient import TestClient

from symbio.api import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SYMBIO_WORK_PATH", str(tmp_path / "work.rl"))
    with TestClient(app, base_url="http://localhost") as c:
        yield c


def test_full_demo(client):
    api = "/api/v1"
    base = api + "/snapshots/kalundborg-pre-addition"
    assert client.get(base + "/network").json()["nodes"]
    cid = client.get(base + "/candidates").json()[0]["id"]
    assert client.get(api + "/candidates/" + cid).json()["paths"]
    body = {
        "assumption_set": "transferable",
        "candidate_ids": [cid],
        "capacity_fraction": 0.4,
    }
    r = client.post(api + "/evaluations", json=body)
    assert r.status_code == 200, r.text
    result = r.json()
    assert client.get(api + "/evaluations/" + result["id"]).json() == result
    plan = client.get(api + "/plans/" + result["plans"][-1]["id"]).json()
    assert plan["constraints"] and plan["manifest"]["snapshot_hash"]
    evidence = client.get(api + "/evidence/permit").json()
    assert evidence["dependent_rules"] and evidence["dependent_plans"]
    assert (
        client.post(api + "/evaluations", json={"capacity_fraction": 3}).status_code
        == 422
    )
    assert (
        client.post(
            api + "/evaluations", json={"candidate_ids": ["absent"]}
        ).status_code
        == 422
    )
    assert (
        client.post(
            api + "/evaluations", json={}, headers={"origin": "https://example.com"}
        ).status_code
        == 403
    )
    assert (
        client.get(base + "/network", headers={"host": "external.example"}).status_code
        == 400
    )
    assert client.get(api + "/plans/absent").status_code == 404
