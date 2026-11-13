# Symbio functional design handoff

Original handoff. The founder supplied the five HTML designs on 13 November 2026. See the implementation and verification record in frontend.md.

Audience: an industrial-cluster planner assessing a hypothetical processing addition and a judge inspecting the evidence. The five views can share navigation and selection state. Their layout, styling, typography, chart treatments and responsive composition belong to the supplied designs.

## Required views and interactions

| View | Actions | Information and service contract |
|---|---|---|
| Network explorer | Explore, filter by entity/relationship, select stream or destination, follow supporting evidence, open a discovered option. Provide keyboard-equivalent list navigation and visible selection. | `GET /api/v1/snapshots/kalundborg-pre-addition/network`. Nodes carry IDs, labels, properties and evidence IDs. Edges carry source, target, relationship and related evidence IDs. Distinguish historical direct agricultural use from a hypothetical template and solved allocations. All plan volumes are annual. |
| Opportunity detail | Select an option, inspect each supplier path and its joint outlets, expand passed/failed/unresolved conditions, open a claim. | List via `/snapshots/{id}/candidates`; detail via `/candidates/{id}`, under `/api/v1`. Show fixed intake, hypothetical site, required digestion/upgrading/handling package, agricultural destination, grid outlet and conditional eligibility. Show the observed value beside any what-if assumption. |
| Baseline and candidate comparison | Select protected or transferable agreement, choose options, evaluate, inspect rank and ties, open a plan. | `POST /evaluations` always includes baseline. Read or revisit `/evaluations/{id}` and `/plans/{id}`. Show delivered MWh LHV, rank, unallocated wet tonnes, unmet gas requirement, freight, and unresolved requirements. Where the baseline ties, show retain baseline. Use actual backend ranking and tie groups. |
| Disruption analysis | Choose capacity fraction and target, select supplier removals, submit a fresh evaluation, compare to normal and stressed baseline. | Show remaining capacity, each independent supplier loss, changed exchanges with units, allocated replacements, worst removals and independently available route headroom. A 0.4 fraction retains 40% of nameplate. If a target is omitted, each option undergoes its own derating. Headroom alternatives cannot be added together. |
| Evidence detail | Follow a measurement, assumption or constraint to its claim and source. Return to the referring plan without losing the selected scenario. | `GET /evidence/{id}`. Show classification, value, physical and time basis, applicability period, publication/access dates, source locator and dependent rules/plans. A source URL can be a link to local project documentation. Printing “unknown” is appropriate when the input is unknown. |

## Representative data

[Live API excerpts](view-model-examples.json) were captured by exercising all five operations. The file contains verbatim portions of responses, with arrays shortened as named. The full schemas are available at `/openapi.json` in the running service. Recreate the example evaluation with `{"assumption_set":"transferable","capacity_fraction":0.4,"capacity_target":"site-a-intake-2000"}`. Fresh work copies already include the 0.5 preset for both agreement sets.

- Protected agreement. All three sizes and the baseline deliver 0 MWh. Direct conveyance to agriculture absorbs the committed supply. The comparison recommends retaining the baseline.
- Transferable agreement. The 500, 1,000 and 2,000 wet t/year options deliver approximately 233.01, 466.03 and 772.91 MWh/year. These values use assumed local quantities, yields and acceptance. “Delivered energy” is the metric.
- Remove the yeast supplier for the 500 t/year option. The remaining NovoGro stream sends 500 wet tonnes to processing and 500 directly to agriculture. Delivered energy falls to 153.44 MWh/year. The changed allocation is a solved substitute route.
- The 1,000 and 2,000 options tie at 306.88 MWh in their worst single-supplier removal. The larger option leads under normal operation. Make both findings visible.
- Authorization. The observed permit state is unverified. A named what-if assumption permits a conditional numerical solve. Keep both facts visible.

## States and interaction details

| State | Behavior required |
|---|---|
| Loading or recalculating | Preserve current selection and prior results, indicate that new results are pending, and associate the response with its request. |
| Empty | A valid snapshot may have no missing processor or the filter may hide all entities. Distinguish these cases and retain the baseline view. |
| Conditional | Surface each outstanding prerequisite. Distinguish graph reachability, modeled eligibility and positive allocated volume through text as well as color. |
| Failed requirement / unscored | Keep the discovery explanation. Show the reason and missing facts. Withhold the rank and objective for that plan. |
| Infeasible | Show the status and available conflict evidence, hide allocations and leave the objective unavailable. A synthetic test exercises agricultural acceptance below committed deliveries. |
| Tie, zero change, zero denominator | Render tied ranks, a real zero in the declared unit, and an unavailable percentage respectively. An unavailable percentage must never render as 0%. |
| Request or server error | Show field errors for invalid fractions or IDs. Preserve inputs for correction or retry. Handle a missing saved ID with navigation back to the current comparison. |
| Accessible/responsive | Keyboard navigation, focus restoration, accessible names for network entities, list equivalents for graph selection and tables that preserve units on narrow screens. No information conveyed by color or hover alone. |

## Handoff materials requested

Provide HTML and required assets for the five views above, including responsive and material state variants. Identify any external fonts or assets and their usage rights. After receipt, inspect the files, map them to these contracts, and raise any material conflicts before implementing product UI.
