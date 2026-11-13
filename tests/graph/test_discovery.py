import pytest

from symbio.graph import discover, link, network


@pytest.mark.parametrize(
    "change",
    [
        "MATCH (:RuleVersion)-[r:ENABLES]->() DELETE r",
        "MATCH (:Stage {id:'upgrading'})-[r:PRODUCT]->() DELETE r",
        "MATCH (:Material {id:'digestate'})-[r:ACCEPTED_AT]->() DELETE r",
        "MATCH (s:Site),(p:ProcessTemplate) CREATE (s)-[:HOSTS]->(p)",
    ],
)
def test_discovery_depends_on_graph(db, change):
    assert len(discover(db)) == 3
    db.execute(change)
    assert discover(db) == {}


def test_duplicate_path_and_outcome_isolation(db):
    link(db, "residue", "ACCEPTED_BY", "rule-identity-v1")
    assert all(len(c["paths"]) == 2 for c in discover(db).values())
    assert len(network(db)["edges"]) > 8
    assert not list(
        db.execute(
            "MATCH (:Snapshot)-[:USES_INPUT]->(c:Claim {collection:'outcome'}) RETURN c.id"
        )
    )


def test_material_cycle_rejected(db):
    link(db, "upgrading", "PRODUCT", "residue")
    with pytest.raises(ValueError, match="Cyclic"):
        discover(db)
