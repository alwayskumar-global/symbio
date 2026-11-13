# Project status — 13 November 2026

The founder supplied the five page designs. Frontend integration, live Chromium verification and the visual review are complete. See [frontend verification](frontend.md).

| Category | Current record |
|---|---|
| Verified historical facts | Dated announcement, spring commissioning, June inauguration, pre-addition agricultural use and subsequent energy recovery. See the evidence inventory and its source locators. |
| Scenario assumptions | Two annual supplier quantities, composition, yields, one hypothetical site, three fixed capacities, receiving bounds, contract flexibility, freight, process loss and scoped what-if acceptance. See the claims CSV. |
| Decisions | Reconstruction, annual LP, delivered biomethane LHV, local single-file Relate store, checked-in immutable seed, single-process API, and conditional ranking. See decisions.md. |
| Runtime verification | macOS ARM64, CPython 3.11.18, Relate wheel/CLI 1.0.0 and OR-Tools 9.15.6755. Matching CLI reads the saved explanation and rejects a competing writer with exit code 5. |
| System evidence | Protected and transferable agreements each include four options under four conditions, for 32 saved plans. Tests exercise graph dependence, incomplete/failed rules, bounded joint outputs, disruptions, interrupted transactions and independent seed reconstruction. Live loopback HTTP exercised all API views and retained a custom evaluation across server restart. |
| External gaps | Operating agreements, permits, land availability, measured supplier-specific yields, costs and historical offtake remain unverified. The numerical comparison is illustrative. |
| Deferred work | Video ready per founder; submission copy and judge README prepared. Final submission pending. Optional MCP, financial comparison, historical prediction and multi-cluster expansion are deferred. At preparation, the public repository contained its license only. |

Clean-checkout acceptance passed on implementation commit `cb2b625`. A fresh local Git clone used a new virtual environment, cached pinned packages and the verified CLI. Frozen offline sync succeeded, 48 claims validated, all 24 tests passed, the CLI demo completed and read-only inspection returned 32 plans. The suite emitted four upstream SWIG/Starlette deprecation warnings. The clone remained clean after replay.
