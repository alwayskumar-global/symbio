from symbio.data import ROOT, SNAPSHOT, digest, load


def rows(db, query, **params):
    return list(db.execute(query, params))


def node(db, label, uid, **props):
    # Labels and property names come exclusively from the internal schema.
    values = {"id": uid, **props}
    fields = ",".join(k + ":$" + k for k in values)
    db.execute(f"CREATE (:Entity:{label} {{{fields}}})", values)


def link(db, start, relation, end):
    db.execute(
        f"MATCH (a:Entity {{id:$a}}),(b:Entity {{id:$b}}) CREATE (a)-[:{relation}]->(b)",
        {"a": start, "b": end},
    )


def get(db, label, uid):
    result = rows(db, f"MATCH (n:{label} {{id:$id}}) RETURN properties(n) AS p", id=uid)
    if not result:
        raise KeyError(uid)
    return result[0]["p"]


def build(db):
    case, sources, claims = load()
    node(
        db,
        "Snapshot",
        SNAPSHOT,
        period="annual pre-addition reconstruction",
    )
    for uid, (name, date, url) in sorted(sources.items()):
        node(db, "Source", "source-" + uid, name=name, publication=date, url=url)
    for uid, claim in sorted(claims.items()):
        node(db, "Claim", uid, **{k: v for k, v in claim.items() if k != "id"})
        link(db, uid, "CITES", "source-" + claim["source"])
        if claim["collection"] == "model":
            link(db, SNAPSHOT, "USES_INPUT", uid)
    for unit in sorted({c["unit"] for c in claims.values()}):
        node(db, "Unit", "unit-" + unit, name=unit)
    for key, c in claims.items():
        link(db, key, "EXPRESSED_IN", "unit-" + c["unit"])
    for m in ("residue", "raw-biogas", "biomethane", "digestate"):
        node(db, "Material", m)
    for uid, label in [
        ("farm", "Agricultural receiving pool"),
        ("grid", "Grid offtake"),
    ]:
        node(db, "Destination", uid, name=label)
    for subject, keys in {
        "farm": ["baseline-agriculture", "farm-cap", "n-cap", "land"],
        "grid": ["gas-quality", "offtake", "gas-demand"],
        "residue": ["stream-basis"],
        "raw-biogas": ["digestion-pathway"],
        "biomethane": ["digestion-pathway"],
        "digestate": ["digestion-pathway", "land"],
    }.items():
        for key in keys:
            link(db, subject, "SUPPORTED_BY", key)
    link(db, "biomethane", "ACCEPTED_AT", "grid")
    link(db, "digestate", "ACCEPTED_AT", "farm")
    for stream in case["streams"]:
        sid = stream["id"]
        fid = "supplier-" + sid
        node(db, "Facility", fid, name=stream["facility"])
        node(
            db,
            "FacilityIdentity",
            "identity-" + sid,
            name=stream["facility"],
            period="pre-addition",
        )
        link(db, fid, "IDENTIFIED_AS", "identity-" + sid)
        link(db, fid, "SUPPORTED_BY", "stream-basis")
        node(db, "Stream", sid, name=stream["stream"])
        node(db, "Commitment", "agreement-" + sid, contingent_on_supplier=True)
        link(db, sid, "SUBJECT_TO", "agreement-" + sid)
        link(db, "agreement-" + sid, "DELIVER_TO", "farm")
        for terms in ("protected", "transferable"):
            link(db, "agreement-" + sid, "TERMS", terms)
        link(db, SNAPSHOT, "INCLUDES", fid)
        link(db, fid, "PRODUCES", sid)
        link(db, sid, "IS_MATERIAL", "residue")
        link(db, sid, "EXISTING_USE", "farm")
        link(db, sid, "JUSTIFIED_BY", "baseline-agriculture")
        for key in claims:
            if key.startswith(sid + "-"):
                link(db, sid, "MEASURED_BY", key)
    package = "ad-upgrade-handling-v1"
    node(
        db,
        "ProcessTemplate",
        package,
        name="Digestion, gas upgrading and digestate handling",
    )
    for stage, feed, product in [
        ("digestion", "residue", "raw-biogas"),
        ("upgrading", "raw-biogas", "biomethane"),
        ("residual-handling", "residue", "digestate"),
    ]:
        node(db, "Stage", stage)
        link(db, package, "INCLUDES_STAGE", stage)
        link(db, stage, "INPUT", feed)
        link(db, stage, "PRODUCT", product)
        link(db, stage, "SUPPORTED_BY", "digestion-pathway")
    for m in ("biomethane", "digestate"):
        link(db, package, "OUTPUT", m)
    link(db, package, "JUSTIFIED_BY", "digestion-pathway")
    for name, key, test, override in case["rules"]:
        rule = "rule-" + name + "-v1"
        node(
            db,
            "RuleVersion",
            rule,
            measurement=key,
            predicate=test,
            planning=override or "",
            version=1,
        )
        link(db, package, "REQUIRES", rule)
        for claim in (
            [key] if key in claims else [s["id"] + "-" + key for s in case["streams"]]
        ):
            link(db, rule, "USES", claim)
        if override:
            link(db, rule, "WHAT_IF", override)
        if name == "identity":
            link(db, "residue", "ACCEPTED_BY", rule)
            link(db, rule, "ENABLES", package)
    site = case["site"]
    node(db, "Site", site, hypothetical=True)
    link(db, site, "REQUIRES", "site-access")
    node(
        db,
        "Permission",
        "authorization-site-a",
        state=claims["permit"]["value"],
        issuer="unknown",
        material="residue",
        activity="digestion, upgrading and digestate handling",
        effective="unknown",
    )
    link(db, site, "AUTHORIZATION", "authorization-site-a")
    link(db, "authorization-site-a", "SUPPORTED_BY", "permit")
    for capacity in case["capacities"]:
        cid = site + "-" + capacity
        node(db, "Candidate", cid)
        link(db, package, "OPTION", cid)
        link(db, cid, "AT", site)
        link(db, cid, "CAPACITY", capacity)
    entities = rows(
        db,
        "MATCH (n:Entity) RETURN labels(n) AS labels,properties(n) AS properties ORDER BY n.id",
    )
    for entity in entities:
        entity["labels"].sort()
    edges = rows(
        db,
        "MATCH (a:Entity)-[r]->(b:Entity) RETURN a.id AS a,type(r) AS rel,b.id AS b ORDER BY a,rel,b",
    )
    db.execute(
        "MATCH (s:Snapshot {id:$id}) SET s.fingerprint=$fp",
        {"id": SNAPSHOT, "fp": digest([entities, edges])},
    )


def inputs(db):
    return {
        r["p"]["id"]: r["p"]
        for r in rows(
            db,
            "MATCH (:Snapshot {id:$s})-[:USES_INPUT]->(c:Claim) RETURN properties(c) AS p",
            s=SNAPSHOT,
        )
    }


def network(db):
    nodes = rows(
        db,
        "MATCH (n:Entity) WHERE n:Snapshot OR n:Facility OR n:Stream OR n:Material OR n:Site OR n:Destination OR n:ProcessTemplate OR n:Commitment OR n:Stage RETURN properties(n) AS properties, labels(n) AS labels ORDER BY n.id",
    )
    ids = {n["properties"]["id"] for n in nodes}
    edges = rows(
        db,
        "MATCH (a:Entity)-[r]->(b:Entity) WHERE a.id IN $ids AND b.id IN $ids RETURN a.id AS source,type(r) AS relation,b.id AS target ORDER BY source,relation,target",
        ids=sorted(ids),
    )
    evidence = rows(
        db,
        "MATCH (n:Entity)-[]->(c:Claim) WHERE n.id IN $ids RETURN DISTINCT n.id AS subject,c.id AS claim ORDER BY subject,claim",
        ids=sorted(ids),
    )
    by_subject = {}
    for record in evidence:
        by_subject.setdefault(record["subject"], []).append(record["claim"])
    for n in nodes:
        n["evidence_ids"] = by_subject.get(n["properties"]["id"], [])
    for e in edges:
        e["evidence_ids"] = sorted(
            set(by_subject.get(e["source"], [])) | set(by_subject.get(e["target"], []))
        )
    return {
        "snapshot": SNAPSHOT,
        "nodes": nodes,
        "edges": edges,
        "opportunities": list(discover(db)),
    }


def discover(db):
    from symbio.rules import verdicts

    query = (ROOT / "queries/discover.cypher").read_text()
    installed = {
        (r["site"], r["process"])
        for r in rows(
            db,
            "MATCH (s:Site)-[:HOSTS]->(p:ProcessTemplate) RETURN s.id AS site,p.id AS process",
        )
    }
    # Compile only acyclic material transformations. An added back-edge is a model error.
    from graphlib import CycleError, TopologicalSorter

    transformations = rows(
        db,
        "MATCH (p:ProcessTemplate)-[:INCLUDES_STAGE]->(s:Stage)-[:INPUT]->(a:Material),"
        "(s)-[:PRODUCT]->(b:Material) RETURN p.id AS package,a.id AS feed,b.id AS product",
    )
    graphs = {}
    for t in transformations:
        graphs.setdefault(t["package"], TopologicalSorter()).add(
            t["product"], t["feed"]
        )
    for package, graph in graphs.items():
        try:
            tuple(graph.static_order())
        except CycleError as exc:
            raise ValueError(f"Cyclic material transformation in {package}") from exc
    candidates = {}
    claims = inputs(db)
    for path in rows(db, query, snapshot=SNAPSHOT):
        if (path["site"], path["process"]) in installed:
            continue
        cid = path["id"]
        if cid not in candidates:
            cap = rows(
                db,
                "MATCH (:Candidate {id:$c})-[:CAPACITY]->(v:Claim) RETURN v.id AS id",
                c=cid,
            )[0]["id"]
            candidates[cid] = {
                "id": cid,
                "site": path["site"],
                "process": path["process"],
                "capacity_claim": cap,
                "capacity": float(claims[cap]["value"]),
                "fixed_intake": {
                    "value": float(claims[cap]["value"]),
                    "unit": "t",
                    "basis": "wet intake",
                    "period": "one modeled year",
                },
                "hypothetical_site": True,
                "paths": [],
            }
        path["verdicts"] = verdicts(db, path, claims)
        candidates[cid]["paths"].append(path)
    for candidate in candidates.values():
        for path in candidate["paths"]:
            conditions = path["verdicts"]
            path["reachable"] = True
            path["eligible_under_assumptions"] = all(
                v["status"] == "passed" or bool(v["planning_assumption"])
                for v in conditions
            )
            path["operationally_verified"] = all(
                v["status"] == "passed"
                and claims[v["measurement"]]["classification"] == "sourced"
                for v in conditions
            )
    return candidates
