"""Annual fixed-configuration LP. All coefficient lookups refer to graph claim IDs."""

from ortools.linear_solver import pywraplp

TOL = 1e-7
STATUS = {
    0: "optimal",
    1: "incomplete",
    2: "infeasible",
    3: "unbounded",
    4: "numerical_failure",
    5: "invalid_model",
    6: "incomplete",
}


def quantity(value, unit, basis):
    return {
        "value": 0.0 if abs(value) <= TOL else float(value),
        "unit": unit,
        "basis": basis,
        "period": "one modeled year",
    }


def coefficients(number, stream):
    methane = (
        number(stream + "-dm") * number(stream + "-vs") * number(stream + "-yield")
    )
    raw = methane / number("ch4-frac")
    co2 = raw - methane
    gas_mass = (methane * number("ch4-density") + co2 * number("co2-density")) / 1000
    if not 0 <= gas_mass <= 1:
        raise ValueError("Raw gas mass exceeds wet feed")
    recovered = methane * number("recovery")
    internal = recovered * number("own-use")
    return {
        "raw": raw,
        "methane": methane,
        "recovered": recovered,
        "own": internal,
        "slip": methane - recovered,
        "co2": co2,
        "digestate": 1 - gas_mass,
        "energy": (recovered - internal) * number("lhv"),
    }


def solve(claims, streams, candidate, agreement, disruption, fixed_energy=0):
    used = set()

    def num(key):
        used.add(key)
        return float(claims[key]["value"])

    solver = pywraplp.Solver.CreateSolver("GLOP")
    solver.SetNumThreads(1)
    ids = sorted(streams)
    allowed = set()
    if candidate:
        for path in candidate["paths"]:
            if path["eligible_under_assumptions"]:
                allowed.add(path["stream"])
        if not allowed:
            return {
                "status": "ineligible",
                "allocations": [],
                "facts": [],
                "reason": "No eligible modeled feed path",
            }
    capacity = num(candidate["capacity_claim"]) if candidate else 0
    if candidate and disruption.get("target") == candidate["id"]:
        capacity *= disruption.get("fraction", 1)
    feed, direct, unused, supply, coef, nitrogen = {}, {}, {}, {}, {}, {}
    constraints = []

    def upper(name, expr, cap, unit, facts):
        solver.Add(expr <= cap, name)
        constraints.append((name, expr, cap, unit, facts))

    for s in ids:
        supply[s] = num(s + "-supply")
        if disruption.get("supplier") == streams[s]:
            supply[s] = 0
        coef[s] = dict.fromkeys(
            (
                "raw",
                "methane",
                "recovered",
                "own",
                "slip",
                "co2",
                "digestate",
                "energy",
            ),
            0.0,
        )
        if s in allowed:
            try:
                coef[s] = coefficients(num, s)
            except ValueError as err:
                return {
                    "status": "unscored",
                    "allocations": [],
                    "facts": sorted(used),
                    "reason": f"{s}: {err}",
                }
        nitrogen[s] = num(s + "-nitrogen")
        feed[s] = solver.NumVar(0, supply[s] if s in allowed else 0, "feed-" + s)
        direct[s] = solver.NumVar(0, supply[s], "direct-" + s)
        unused[s] = solver.NumVar(0, supply[s], "unused-" + s)
        solver.Add(feed[s] + direct[s] + unused[s] == supply[s])
        if agreement == "protected":
            solver.Add(direct[s] >= num("protected") * supply[s])
        else:
            solver.Add(
                (feed[s] + direct[s]) * nitrogen[s]
                >= num("transferable") * supply[s] * nitrogen[s]
            )

    def output(key):
        return sum(feed[s] * coef[s][key] for s in ids)

    energy = output("energy")
    digestate = output("digestate")
    upper(
        "intake",
        sum(feed.values()),
        capacity,
        "wet t",
        [candidate["capacity_claim"]] if candidate else [],
    )
    upper(
        "upgrading",
        output("raw"),
        num("upgrade-cap"),
        "Nm3 dry raw gas",
        ["upgrade-cap"],
    )
    upper("handling", digestate, num("digest-cap"), "wet t", ["digest-cap"])
    upper("gas-offtake", energy, num("offtake"), "MWh LHV", ["offtake"])
    upper("gas-demand", energy, num("gas-demand"), "MWh LHV", ["gas-demand"])
    upper(
        "farm-mass",
        sum(direct.values()) + digestate,
        num("farm-cap"),
        "wet t",
        ["farm-cap"],
    )
    upper(
        "farm-nitrogen",
        sum((direct[s] + feed[s]) * nitrogen[s] for s in ids),
        num("n-cap"),
        "t N",
        ["n-cap"],
    )
    freight = (
        sum(direct.values()) * num("direct-km")
        + sum(feed.values()) * num("feed-km")
        + digestate * num("digest-km")
    )
    objectives = [(energy, True), (sum(unused.values()), False), (freight, False)]
    objectives.extend((feed[s], False) for s in ids)
    objectives.extend((direct[s], False) for s in ids[:-1])
    tie_bounds = []
    for i, (expr, maximize) in enumerate(objectives):
        if maximize:
            solver.Maximize(expr)
        else:
            solver.Minimize(expr)
        status = STATUS.get(solver.Solve(), "incomplete")
        if status != "optimal":
            reason = status
            if status == "infeasible":
                minimum_n = sum(supply[s] * nitrogen[s] for s in ids) * num(agreement)
                minimum_wet = sum(
                    supply[s]
                    * num(agreement)
                    * (
                        coef[s]["digestate"]
                        if s in allowed and agreement == "transferable"
                        else 1
                    )
                    for s in ids
                    if nitrogen[s] > 0 or agreement == "protected"
                )
                if minimum_n > num("n-cap") + TOL:
                    reason = f"Committed nitrogen requires at least {minimum_n:g} t N/year, above farm acceptance {num('n-cap'):g}."
                elif minimum_wet > num("farm-cap") + TOL:
                    reason = f"Committed deliveries require at least {minimum_wet:g} wet tonnes/year, above farm acceptance {num('farm-cap'):g}."
                else:
                    reason = "Hard commitments and finite receiving bounds are jointly infeasible; no individual conflict isolated."
            return {
                "status": status,
                "allocations": [],
                "facts": sorted(used),
                "reason": reason,
            }
        if i + 1 < len(objectives):
            optimum = expr.solution_value()
            bound = solver.Add(expr == optimum)
            if i >= 2:
                tie_bounds.append(bound)
    if not solver.VerifySolution(TOL, False):
        return {"status": "numerical_failure", "allocations": [], "facts": sorted(used)}
    for s in ids:
        f = feed[s].solution_value()
        residual = abs(
            f + direct[s].solution_value() + unused[s].solution_value() - supply[s]
        )
        if (
            residual > TOL
            or f > 0
            and abs(
                f
                * (
                    coef[s]["digestate"]
                    + (
                        coef[s]["methane"] * num("ch4-density")
                        + coef[s]["co2"] * num("co2-density")
                    )
                    / 1000
                )
                - f
            )
            > TOL
        ):
            return {
                "status": "numerical_failure",
                "allocations": [],
                "facts": sorted(used),
            }
    allocations = []
    for s in ids:
        f = feed[s].solution_value()
        c = coef[s]
        for route, val, unit, basis in [
            ("direct", direct[s].solution_value(), "t", "wet residue to agriculture"),
            ("feed", f, "t", "wet processor intake"),
            ("unallocated", unused[s].solution_value(), "t", "wet unallocated"),
            (
                "dry",
                f * (num(s + "-dm") if s in allowed else 0),
                "t",
                "feed dry matter",
            ),
            (
                "volatile",
                f
                * (num(s + "-dm") if s in allowed else 0)
                * (num(s + "-vs") if s in allowed else 0),
                "t",
                "volatile solids",
            ),
            ("raw-gas", f * c["raw"], "Nm3", "dry raw gas at 0 C, 1 atm"),
            ("co2", f * c["co2"], "Nm3", "separated CO2 at normal conditions"),
            ("slip", f * c["slip"], "Nm3", "unrecovered CH4"),
            ("own-use", f * c["own"], "Nm3", "internally consumed methane"),
            ("digestate", f * c["digestate"], "t", "wet digestate to agriculture"),
            ("gas-delivery", f * c["energy"], "MWh", "accepted biomethane LHV"),
        ]:
            allocations.append(
                {"exchange": s + "/" + route, **quantity(val, unit, basis)}
            )
    constraints_out = [
        {
            "id": name,
            "slack": quantity(
                bound - expr.solution_value(), unit, "remaining capacity"
            ),
            "active": abs(bound - expr.solution_value()) <= TOL,
            "facts": facts,
        }
        for name, expr, bound, unit, facts in constraints
    ]
    delivered = energy.solution_value()
    result = {
        "status": "optimal",
        "objective": quantity(
            delivered - fixed_energy,
            "MWh",
            "delivered biomethane LHV"
            if not fixed_energy
            else "net after fixture fixed burden",
        ),
        "unallocated": quantity(
            sum(x.solution_value() for x in unused.values()), "t", "wet"
        ),
        "unmet_offtake": quantity(
            num("offtake") - delivered, "MWh", "unused potential offtake"
        ),
        "unmet_demand": quantity(
            num("gas-demand") - delivered,
            "MWh",
            "soft biomethane energy requirement LHV",
        ),
        "freight": quantity(freight.solution_value(), "t km", "wet material freight"),
        "allocations": allocations,
        "constraints": constraints_out,
        "facts": sorted(used),
    }
    # Retain objective and unallocated service levels, free the freight and ID tie-breaks.
    # Each auxiliary maximum is an independent alternative, so these are not additive.
    result["route_headroom"] = []
    if disruption and candidate:
        assigned = {s: feed[s].solution_value() for s in ids}
        for bound in tie_bounds:
            bound.SetBounds(-solver.infinity(), solver.infinity())
        for s in sorted(allowed):
            solver.Maximize(feed[s])
            if solver.Solve() == solver.OPTIMAL and solver.VerifySolution(TOL, False):
                extra = max(0.0, feed[s].solution_value() - assigned[s])
                result["route_headroom"].append(
                    {
                        "exchange": s + "/feed",
                        "additional": quantity(
                            extra,
                            "t",
                            "wet feed, energy and allocated supply held fixed",
                        ),
                    }
                )
    return result
