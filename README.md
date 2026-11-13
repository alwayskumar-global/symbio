# Symbio

Find the missing process that can turn fermentation residues into usable gas while keeping commitments to farmers.

## Use case

Before Kalundborg added local biogas production, most bioresidues already went to agricultural land. Symbio reconstructs that decision: can two suppliers route residues through a new processor, deliver biomethane to the grid, and still provide the agreed agricultural service?

The agreement changes the answer. When direct delivery is protected, every option ties at **0 MWh/year** and the baseline is retained. If digestate can instead satisfy an equivalent nitrogen obligation, a **2,000 wet tonne/year** intake option delivers **772.91 MWh/year** in the normal case. Remove the yeast supplier and that option ties the 1,000-tonne option at **306.88 MWh/year**. These are annual modeled deliveries on a lower-heating-value basis. Quantities, yields, capacity and the alternative agreement are illustrative; the permit remains unverified. Historical plant output is not used to calculate these results.

## How it uses Relate

**Mode: embedded, single file.** A judge can open the same dated network and saved explanations after the application stops, using one portable file and no database server. On first launch the app makes a writable copy so experiments preserve the submitted evidence.

The [discovery query](queries/discover.cypher) follows each facility to its stream and material, then through an acceptance rule to a process package at a proposed site. It requires connected digestion and upgrading stages, a grid destination for biomethane, and a farm destination for digestate. Removing the enabling rule removes the opportunity. OR-Tools GLOP computes feasible flows for the configurations Relate discovers. Symbio then saves plans, allocations and constraints in Relate, where a judge can follow a plan back to its claims and sources.

## Where the data lives

- [Persistent Relate store](dist/kalundborg-seed.rl) and [SHA-256 manifest](dist/kalundborg-seed.manifest.json): 32 plans covering two agreements, four options including the baseline, and four operating conditions.
- [Case inputs](data/case/kalundborg.json), [claims](data/evidence/claims.csv), and [sources](data/evidence/sources.json) rebuild the graph. [Evidence notes](docs/evidence-inventory.md) distinguish historical facts from scenario assumptions.

## Run locally

Prerequisites: macOS or Linux, Git, curl and Python 3 with venv. For the browser UI, install Node 24.22.1 with npm (the CLI demo does not need Node). From a fresh checkout:

```sh
git clone https://github.com/alwayskumar-global/symbio.git
cd symbio
python3 -m venv .bootstrap
.bootstrap/bin/python -m pip install uv==0.13.7
export PATH="$PWD/.bootstrap/bin:$PWD/.tools:$PATH"
export UV_CACHE_DIR="$PWD/.uv-cache" UV_PYTHON_INSTALL_DIR="$PWD/.python-runtime"
export DO_NOT_TRACK=1
uv python install 3.11.18
uv sync --frozen
./tools/install-relate.sh
relate --version
uv run --frozen symbio validate-data
uv run --frozen symbio demo --case kalundborg
# With nvm installed; otherwise activate the same Node version with your manager.
nvm install "$(cat web/.nvmrc)"
nvm use "$(cat web/.nvmrc)"
npm --prefix web ci
npm --prefix web run build
uv run --frozen symbio serve
```

Open the [application](http://127.0.0.1:8000/) or the local API reference at [127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). The provided seed includes both agreement cases and the preset disruptions. The first run copies it to a private writable store. Stop the demo CLI before starting the API. Use one server worker. The CLI inspection below targets the immutable seed and can run while the API is active.

```sh
relate --read-only --json -d dist/kalundborg-seed.rl -c 'MATCH (p:Plan) RETURN count(p) AS plans'
relate --read-only --json -d dist/kalundborg-seed.rl -c 'MATCH (p:Plan)-[:DEPENDS_ON]->(c:Claim)-[:CITES]->(s:Source) RETURN p.id,c.id,s.name LIMIT 8'
uv run --frozen pytest -q
```

A fresh checkout can rebuild the seed with `uv run --frozen symbio seed`. This replaces the generated seed and manifest and preserves existing working copies. To start a new experiment, stop the current owner and set `SYMBIO_WORK_PATH` to a fresh path. Rebuild comparison uses the logical fingerprint and result metrics. The artifact SHA-256 verifies an individual shipped file. Install/downloads require network access. The local demo after setup is offline.

## Configuration

Configuration is read from the **process environment**. To use a file, copy `.env.example` to `.env`, then use `set -a; . ./.env; set +a` before launching. Required secrets and external services: none. Never use the seed as the working store.

| Optional variable | Default | Purpose |
|---|---|---|
| `SYMBIO_SEED_PATH` | `dist/kalundborg-seed.rl` | Read-only seed and adjacent `.manifest.json` checksum |
| `SYMBIO_WORK_PATH` | `var/kalundborg.rl` | Independent experiment copy with an adjacent process lock |
| `SYMBIO_PORT` | `8000` | Local HTTP port on 127.0.0.1 |

Relative store paths resolve from the repository root. The packaged Python entry point expects a source checkout with the data and Cypher files. The POSIX process lock requires macOS or Linux. CPython, dependency versions and hashes are pinned in `.python-version` and `uv.lock`. CLI 1.0.0 release asset checksums are pinned in `tools/install-relate.sh`. Only macOS ARM64 has been exercised here.

## Reproduce the comparison

```sh
curl -fsS http://127.0.0.1:8000/api/v1/snapshots/kalundborg-pre-addition/network
curl -fsS http://127.0.0.1:8000/api/v1/snapshots/kalundborg-pre-addition/candidates
curl -fsS -H 'Content-Type: application/json' -d '{"assumption_set":"transferable","capacity_target":"site-a-intake-2000","capacity_fraction":0.5}' http://127.0.0.1:8000/api/v1/evaluations
```

Read a returned plan ID at `/api/v1/plans/{id}`. The stress cases independently halve capacity and remove each selected supplier. Set `remove_suppliers` to an array of facility IDs to select disruptions. An omitted capacity target derates each candidate's own installation in its separate solve. Query `/api/v1/evidence/permit` to inspect the unverified site authorization. Use `assumption_set=protected` for the existing direct-delivery obligation.

See [evidence inventory](docs/evidence-inventory.md), [model decisions](docs/decisions.md), [design handoff](docs/design-handoff.md) and [project status](docs/status.md). The five supplied designs are implemented. See [frontend setup, routes and verification](docs/frontend.md). AI assistance was used for research, implementation, tests and documentation. The data inventory contains original summaries with source locators. The UI bundles local fonts and icon masks.
