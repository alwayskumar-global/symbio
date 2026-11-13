You are the development lead for a new hackathon project. I am starting this session in Plan Mode. Read this entire brief, inspect the workspace, research the necessary technical details, and prepare a detailed implementation plan.

Do not start implementing the application yet.

## 1. Working arrangement

- **Codex owns:** technical planning, architecture, data preparation, backend, graph integration, optimization, tests, frontend implementation, and documentation.
- **I own the visual design:** I will use Claude Design to produce UI designs and provide them to you as HTML files.
- **Mandatory design checkpoint:** before implementing any product UI, you must ask me for those HTML designs. Do not invent the visual design, generate substitute screens, or proceed with a generic dashboard.
- When that checkpoint arrives, I will return to my planning conversation to obtain UI generation prompts, create the designs in Claude Design, and supply the resulting HTML files.

You may prepare functional screen requirements, API contracts, and view models before receiving the designs. These are functional specifications, not permission to build the UI.

Do not ask me to choose routine technical details you can reasonably decide. Identify genuine blockers, investigate them first, and make sensible recommendations.

## 2. Project identity and purpose

Working name: **Symbio**. The name is provisional; naming research must not block development.

We are building an industrial resource-network planning application for the **Relate by Neo4j Hackathon**:

https://relate.devpost.com/

Core question:

> Which additional processing capability would unlock the most useful and resilient resource exchanges in an industrial cluster?

Factories produce residual materials. Other facilities can consume those materials directly or after processing. The application discovers missing processing opportunities, evaluates a small set of candidate configurations, explains the evidence and constraints, and stress-tests the resulting network.

The differentiating feature is **discovering the missing processor**, with explainable consequences across the network.

The product must support this demonstration:

1. Explore the existing network and unresolved opportunities.
2. Discover candidate processing configurations that complete otherwise unavailable exchange paths.
3. Compare their modeled performance against the existing arrangement.
4. Reduce capacity or remove a supplier.
5. Recalculate allocations and show what changes, why it changes, and which alternatives remain.

The recommendation must follow the calculations. Do not engineer arbitrary thresholds or data to force a dramatic result.

## 3. Agreed scope

Start with:

- One industrial cluster: **Kalundborg, Denmark**.
- One material family: **industrial fermentation residues**, associated with enzyme and insulin production.
- Approximately **8–12 well-supported transformation or eligibility rules**, subject to evidence availability.
- **3–5 candidate processor configurations**, where evidence supports meaningful alternatives.
- One proposed processing addition evaluated at a time.
- A baseline representing the existing residue-management arrangement.
- Supplier-removal and processor-capacity scenarios.
- A portable persistent Relate store.
- A reproducible local demonstration.

A configuration can differ by process, site, or fixed capacity. Do not invent scientifically unsupported processor types merely to reach a target count.

Candidate sites are hypothetical planning options unless documented otherwise. Facility coordinates do not establish land availability.

Anaerobic digestion, gas upgrading, and digestate handling are relevant pathways to investigate. Do not expand the MVP into municipal waste, animal feed, hazardous waste, all industrial materials, or full engineering design.

This is a planning prototype. Outputs are ranked opportunities with assumptions and unresolved requirements, not engineering certification or investment advice.

## 4. Research findings and evidence limitations

Treat these as findings to verify and document, not a complete dataset:

- Kalundborg’s biogas plant began operation in spring 2018 and was inaugurated on 18 June 2018.
- The project was publicly announced on 23 March 2017.
- Residues were already used as fertilizer before the new plant.
- The added processing step recovered energy before the remaining biomass continued to agricultural use.

Consequently, **“tonnes diverted from landfill” is not an appropriate default impact metric for this case**.

Useful starting sources:

- Kalundborg Symbiosis:
  https://www.symbiosis.dk/en/
- Kalundborg Bioenergy:
  https://www.symbiosis.dk/en/kalundborg-bioenergi/
- Historical energy transition:
  https://www.symbiosis.dk/en/2022/01/11/gron-energi/
- Project announcement:
  https://orsted.dk/presse/nyheder/2017/03/residues-from-novo-nordisk-and-novozymes-to-be-converted-into-biogas
- Kalundborg modeling paper:
  https://www.symbiosis.dk/wp-content/uploads/2018/06/KalundborgSymbiosisPaperLCA2018-06.pdf
- Operator:
  https://bigadan.com/

Data-source cautions:

- EU E-PRTR data does not automatically provide detailed six-digit waste streams, composition, or weekly available supply.
- US EPA TRI chemical quantities are not total material-stream tonnages.
- Historical annual transfers are not automatically current uncommitted supply.
- Production residues already committed to an existing use cannot be treated as freely available.
- Do not mix historical facility identities, present-day capacities, and historical flows without explicit dating.

Use real documented facts where available. Use clearly labelled scenario assumptions where necessary. Never imply that missing operational information was sourced.

## 5. Evidence-first planning

Before finalizing the schema or optimization model, prepare an evidence inventory covering:

- Facilities and historical identities.
- Residue streams and existing destinations.
- Quantities, reporting periods, and wet/dry basis.
- Composition and relevant quality measurements.
- Transformation pathways and yields.
- Processor capacities.
- Product demand and downstream acceptance.
- Transport assumptions.
- Cost assumptions.
- Permission or authorization evidence.
- Historical timestamps.
- Reuse and redistribution rights for included material.

For each important input, record:

- Identifier and value.
- Unit and time basis.
- Classification: **sourced / inferred / assumed**.
- Source reference and supporting passage or location.
- Source publication date and access date.
- Period during which the fact applies.
- Derivation, if inferred.
- Uncertainty range, where justified.

“Sourced” does not mean independently verified. Avoid numerical confidence scores without a defensible interpretation.

If sufficient historical inputs are unavailable, recommend a documented reconstruction with explicit assumptions. Do not spend the entire project chasing an unattainable dataset.

## 6. Architecture and responsibilities

### Relate: connected context

Relate must genuinely power:

- Facility–stream–process–consumer relationships.
- Discovery of compatible transformation paths.
- Identification of missing processing capabilities.
- Rule applicability and linked evidence.
- Candidate explanations.
- Dependencies between plans and underlying facts.
- Scenario and plan inspection.
- Structural dependency analysis.

Relate must not be a decorative copy of relationships implemented elsewhere.

Technical references:

- https://relatedb.ai/
- https://github.com/relatedb/relate
- https://github.com/relatedb/relate/blob/main/docs/limitations.md

Verify current APIs, package availability, persistence behavior, and relevant Cypher support. Do not assume compatibility from examples alone.

### Rules: graph definitions with deterministic evaluation

Store rules, requirements, units, applicability, versions, and citations as graph entities.

A small deterministic evaluator may perform comparisons, unit conversion, missing-value handling, and evaluation that is awkward to express in Cypher.

Every verdict must trace back to:

- Rule version.
- Relevant stream and process.
- Measurements used.
- Evidence.
- Passed, failed, or unresolved conditions.

Unknown measurements must not silently pass.

Permission states are **verified / unverified / prohibited**, with scope and dates. A hypothetical proposed facility should retain unresolved authorization requirements; absence of an existing permit must not erase every future planning candidate.

Separate conditional planning opportunities from currently evidenced operational eligibility.

### Optimization: LP per fixed candidate

Preferred MVP approach:

1. Relate generates a small set of candidate configurations.
2. Fix each candidate’s technology, site, and capacity.
3. Solve continuous allocations separately for each candidate.
4. Compare all candidates against the baseline.
5. Repeat under stress scenarios.

Use OR-Tools linear programming if the final formulation supports it:

https://developers.google.com/optimization/lp/lp_example

This approach assumes fixed yields and linear constraints within each scenario.

If the actual requirements introduce binary operating decisions, joint facility selection, or nonlinear behavior, explain the consequence and propose the smallest defensible adjustment. Do not silently substitute a different model.

### Agent and MCP

Secondary to the working core.

Potential tools include:

- Discover opportunities.
- Explain a candidate.
- List unresolved requirements.
- Evaluate a scenario.
- Inspect plan evidence.

The core demo must work without a paid LLM service. An optional language interface must use the same validated application operations.

## 7. Candidate generation and ranking

Candidates must originate from missing capabilities on relevant source-to-consumer paths.

Each candidate should explain:

- Which streams it can accept.
- Which transformation rules justify that.
- Which consumers or downstream uses it could connect.
- Which requirements remain unresolved.
- Which site and capacity assumptions it uses.

Path count is a discovery signal, not the final objective. Several paths can compete for the same material.

Evaluate all shortlisted candidates with consistent metrics and assumptions. Do not discard promising candidates solely because a simplistic path-count heuristic ranks them poorly.

Explain the limit of the search: best among the evaluated candidates, not necessarily a globally optimal industrial network.

## 8. Optimization requirements

The plan must specify:

- Decision variables.
- Units.
- Objective and tie-breaking.
- Supply and demand bounds.
- Process capacities.
- Conversion yields.
- Quality and eligibility constraints.
- Transport and operating assumptions.
- Existing commitments and baseline treatment.
- Output destinations.
- Handling of unresolved information.
- Solver status and infeasibility behavior.

Do not combine incompatible units.

In particular:

- Distinguish wet tonnes, dry matter, volatile solids, gas volume, and energy.
- Use explicit conversions with evidence or labelled assumptions.
- Account for multiple outputs and process losses.
- Do not double-count the same material through successive exchanges.
- Do not create unrestricted sinks for digestate or gas.
- Prevent artificial cycles from creating material, energy, or unlimited benefit.

Prefer a small, interpretable objective over an arbitrary weighted score. Keep evidence quality visible separately from physical or economic performance.

If a financial comparison is included, include relevant candidate-specific costs or clearly label the narrower comparison. Do not claim commercial viability from throughput alone.

## 9. Resilience and explanations

Required stress tests:

- Reduce a processor’s capacity.
- Remove each relevant supplier in turn and re-solve.

Report:

- Baseline and stressed performance.
- Absolute and percentage changes where meaningful.
- Unallocated inputs and unmet downstream requirements.
- Changed exchanges.
- Substitute routes with actual available capacity.
- Infeasible cases.
- Worst-performing supplier-removal scenario.

Graph reachability alone does not establish operational resilience.

Distinguish:

- A structurally available path.
- A path satisfying the modeled conditions.
- An exchange allocated volume in a solved plan.

Describe resilience only against tested disruptions. Do not claim real-world reliability probabilities.

Use solver results to identify active constraints where possible. Do not present an LLM-generated explanation as a formal infeasibility certificate.

## 10. Validation strategy

Preferred: a historical backtest, only if the evidence supports it.

Requirements:

- Choose a cutoff before the documented March 2017 announcement.
- Use inputs available before that cutoff.
- Exclude future project announcements and outcome-specific facts from candidate generation.
- Use generic transformation rules with traceable origins.
- Freeze candidate generation and ranking before evaluation.
- Report the historical addition’s actual rank.
- Acknowledge that this is retrospective and the outcome is already known.

Otherwise, use a **documented case reconstruction**.

Regardless of historical validation, test the computational system using small hand-checkable fixtures:

- Known valid and invalid paths.
- Missing specifications.
- Shared capacity.
- Conversion yields.
- Demand limitations.
- Unit conversions.
- Duplicate paths.
- Supplier removal.
- No feasible candidate.
- Baseline outperforming a proposed addition.

Synthetic fixtures are appropriate for software correctness. Label them separately from the case-study evidence.

## 11. Persistence and reproducibility

Prefer a single-file Relate store if current capabilities support the required workflow.

Include:

- Documented seed facts.
- Rules and evidence references.
- Baseline.
- Candidate configurations.
- A small set of reproducible saved scenarios and results.

Preserve an immutable seed and create writable working copies for experiments.

Verify:

- Data survives process restart.
- Judges can inspect the store using documented Relate commands.
- The store can be rebuilt from source data.
- Results reference the exact input snapshot, rule versions, solver configuration, and scenario.
- Application processes do not accidentally open conflicting writers.
- A clean checkout can reproduce the main demonstration.

Do not rely on ephemeral serverless storage for the persistent graph.

## 12. Technical defaults to investigate

Unless the workspace already establishes a suitable stack, consider:

- Python for modeling, evidence preparation, Relate integration, and optimization.
- FastAPI for application endpoints.
- React and TypeScript for implementing my supplied HTML designs.
- A persistent local backend for the primary demonstration.

These are recommendations, not requirements to adopt without checking compatibility.

Pin verified dependency versions. Plan an early technical proof for Relate persistence, graph queries, and solver integration before substantial application development.

## 13. Mandatory UI design handoff

Place a visible milestone in the plan:

**BLOCKED — AWAITING USER HTML DESIGNS**

Before that milestone, you may complete evidence work, backend services, graph operations, optimization, tests, API contracts, and functional screen requirements.

Before writing product screens or styling:

1. Prepare a concise design handoff covering:
   - Required screens or views.
   - User actions.
   - Information each view must display.
   - Loading, empty, error, conditional, and infeasible states.
   - Network interaction requirements.
   - Scenario controls.
   - Evidence and provenance presentation.
   - Representative data and API view models.
2. Ask me explicitly:
   **“The project is ready for UI design. Please provide the Claude Design HTML files for the following screens…”**
3. Wait for the files before implementing the UI.

At that point I will obtain UI prompts separately and provide the designs.

After receiving them:

- Inspect the HTML and assets.
- Map the supplied screens to the application contracts.
- Preserve the visual system, hierarchy, typography, spacing, and interactions.
- Replace static content with application data.
- Implement accessibility and responsiveness consistently with the designs.
- Raise material missing states or conflicting behavior before inventing major design changes.

Do not create substitute designs while waiting.

## 14. Scope exclusions

Keep these outside the initial MVP:

- Marketplace transactions.
- Live factory integrations.
- User accounts and billing.
- Multiple clusters.
- Broad regulatory certification.
- Automated real-world investment recommendations.
- Full lifecycle assessment.
- Detailed process engineering.
- Multi-facility construction optimization.
- LLM-generated compatibility rules.
- Mandatory paid AI dependencies.

## 15. Planning deliverables

Your first response should provide a concrete plan, not application code.

Include:

1. Your understanding of the product and its boundaries.
2. Workspace findings.
3. Evidence inventory and data gaps.
4. Verified technical capabilities and remaining uncertainties.
5. Recommended architecture and alternatives considered.
6. Proposed graph schema.
7. Candidate-generation method.
8. LP formulation and comparison metrics.
9. API contracts and functional view requirements.
10. Validation and meaningful tests.
11. Persistence and reproducibility strategy.
12. Phased tasks with dependencies, expected files, acceptance criteria, and verification commands.
13. The explicit UI design checkpoint.
14. Risks, fallback decisions, and realistic scope priorities.
15. Only questions whose answers materially block progress.

Keep planning read-only in Plan Mode, apart from its supported planning mechanism. Do not install dependencies, scaffold the application, or implement features yet.

Once I approve the plan and enable implementation, preserve the agreed brief, plan, evidence inventory, decisions, and project status in repository documentation. Add concise repository instructions that preserve the UI checkpoint for future Codex sessions.

Track verified facts, assumptions, decisions, blockers, and deferred features separately. Update these documents as work progresses so development does not drift.

Start by inspecting the workspace and validating the evidence and technical assumptions that most affect feasibility.