from symbio.graph import rows


def verdicts(db, path, claims):
    rules = rows(
        db,
        "MATCH (:ProcessTemplate {id:$p})-[:REQUIRES]->(r:RuleVersion) RETURN properties(r) AS r ORDER BY r.id",
        p=path["process"],
    )
    dependencies = rows(
        db,
        "MATCH (:ProcessTemplate {id:$p})-[:REQUIRES]->(r:RuleVersion)-[e]->(c:Claim) RETURN r.id AS rule,type(e) AS role,c.id AS fact",
        p=path["process"],
    )
    links = {(d["rule"], d["role"], d["fact"]) for d in dependencies}
    result = []
    for row in rules:
        rule = row["r"]
        key = rule["measurement"]
        if key in {"dm", "vs", "yield"}:
            key = path["stream"] + "-" + key
        claim = claims.get(key, {}) if (rule["id"], "USES", key) in links else {}
        value = claim.get("value")
        test = rule["predicate"]
        if value in (None, "unknown", "unverified"):
            status = "unresolved"
        elif test == "present":
            status = "passed"
        elif test == "positive":
            status = "passed" if float(value) > 0 else "failed"
        else:
            status = "passed" if value == test else "failed"
        assumption = (
            claims.get(rule["planning"], {})
            if (rule["id"], "WHAT_IF", rule["planning"]) in links
            else {}
        )
        result.append(
            {
                "rule": rule["id"],
                "stream": path["stream"],
                "process": path["process"],
                "measurement": key,
                "unit": claim.get("unit"),
                "value": value,
                "status": status,
                "evidence": claim.get("source"),
                "planning_assumption": assumption.get("id")
                if status == "unresolved" and assumption.get("value") == test
                else None,
            }
        )
    return result
