# Frontend setup and verification

## Start the application

From the repository root, complete the Python/Relate setup in README.md, activate Node 24.22.1 from web/.nvmrc, then run:

```sh
npm --prefix web ci
npm --prefix web run build
.venv/bin/symbio serve
```

Open http://127.0.0.1:8000/. Build before server startup. Restart an already-running server after the first build so it registers the static asset mount. The backend serves web/dist, the authorized evidence inventory document and local font notices. No frontend environment variables, API keys, accounts, CORS settings, remote fonts or separate web server are required. Backend environment overrides remain SYMBIO_PORT, SYMBIO_SEED_PATH and SYMBIO_WORK_PATH. First-time dependency installation requires network access. Normal use after build is offline.

## Design and contract mapping

The original 15-file design export is retained privately; it is not required to run or build the app. SHA-256 is 84affeb04743051a9a10ecd669845cf8a274fd8afbedfff60d2d1713c72c7186. The application uses web/src/design.css, a copy of the shared stylesheet, and web/src/app.css for the viewport shell and responsive adaptations. Local font packages contain DM Sans and DM Mono. The original CSS supplies the icon masks. Font notices are in web/public/licenses.

| Route | Supplied reference | Live behavior |
|---|---|---|
| /#/network | Explorer.dc.html | Select graph nodes, edges and streams, zoom, expand processing stages, filter, use list and inspect evidence. Paths come from discovered candidates and snapshot relationships. Repeated agricultural endpoints refer to one destination. |
| /#/opportunities | Opportunity.dc.html | Select among discovered capacities on the detail view, select a supplier path, expand verdicts, inspect prerequisites and choose an agreement. |
| /#/comparison | Comparison.dc.html | Submit agreement and selected options, retain baseline, inspect actual ranks, ties, conditional results, optional columns, saved allocations, constraints and evidence. |
| /#/disruptions | Disruptions.dc.html | Submit remaining capacity or independent supplier removals. Inspect the evaluated scenario and option, actual changed allocations, bounded route headroom and worst-loss results. |
| /#/evidence/{id} | Evidence.dc.html | Open a claim from a contextual modal or directly; inspect provenance, scope, linked rules and saved plans. The assumption and observed authorization have separate records. |

Each reference root is the first .shell.xshell. The review labels, preview toolbar, repeated variants and artboard frames are excluded. Original fixed diagram coordinates apply inside a scrollable, zoomable diagram. Shared navigation, native tables and dialogs replace simulated controls. Graph selection and analytical controls use native keyboard interactions. Hash parameters carry the selected entity, candidate, agreement, evaluation, plan, pending settings, source page and tab. Direct plan links resolve the persisted evaluation. Record IDs are local to the working store.

The primary implementation files are web/src/main.tsx, core.tsx, network.tsx, opportunity.tsx, results.tsx and evidence.tsx. The generated web/src/schema.ts derives from the backend OpenAPI document. To regenerate from the repository root after changing response models:

```sh
.venv/bin/python -c 'import json; from symbio.api import app; print(json.dumps(app.openapi()))' > /tmp/symbio-openapi.json
web/node_modules/.bin/openapi-typescript /tmp/symbio-openapi.json -o web/src/schema.ts
npm --prefix web run build
```

Calculated results come from evaluation and plan endpoints. Chart widths and displayed numeric precision are presentation transformations. Pending edits do not relabel saved results. Result retrieval and recalculation are cancellable; a superseded request cannot publish its response. Conditional assumptions, unknown inputs, solver failures and unavailable percentages stay distinct. Source links resolve only HTTP(S) URLs or the explicitly served local evidence document.

## Verification

```sh
.venv/bin/pytest -q
.venv/bin/symbio validate-data
npm --prefix web run build
(cd web && npx playwright install chromium)
npm --prefix web run test:e2e
```

Playwright starts and stops the actual local backend on port 18763 with a separate var/browser-test.rl working copy. Tests are in web/tests/product.spec.ts. The main workflow uses real Relate/GLOP records. Failure, timing and infeasible-state fixtures are confined to test interceptions. The prebuilt and locally cached toolchain was verified on macOS ARM64 using a frozen offline npm install. Browser coverage is Chromium, including a 390-pixel viewport; Safari and Firefox acceptance remain unverified.

The backend suite passes 24 tests and validates 48 claims. Six browser tests cover the complete flow, the four prescribed numerical examples, claim drawer dismissal and focus restoration, filtered-empty state, errors and retry, stale response suppression, infeasibility, deep links and reload. The screenshot test captures 1440 × 1000 viewport images under docs/screenshots. All five were compared with the first application shell cropped from the corresponding export, with external requests blocked. Review refinements included the package inspector, pathway display, agreement cards, recommendation controls and evidence context. Actual claim IDs, source names, number formatting and persisted record selectors differ from the illustrative boards. Visual comparison was manual, without a pixel-equality threshold.
