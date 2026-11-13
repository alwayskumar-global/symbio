from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi import Request as HttpRequest
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

from symbio.api.models import Candidate, Evaluation, Evidence, Network, Plan
from symbio.data import ROOT
from symbio.evaluations import Request, evaluate, payload
from symbio.graph import discover, get, network, rows
from symbio.storage import working


@asynccontextmanager
async def lifespan(app):
    # All graph operations execute synchronously on this one event-loop thread.
    with working() as db:
        app.state.db = db
        yield


app = FastAPI(title="Symbio local planning API", version="1", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])


@app.middleware("http")
async def guard(request: HttpRequest, call_next):
    if request.method == "POST":
        origin = request.headers.get("origin")
        if (
            request.headers.get("sec-fetch-site") == "cross-site"
            or origin
            and origin != str(request.base_url).rstrip("/")
        ):
            return JSONResponse({"detail": "Same-origin request required"}, 403)
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            return JSONResponse({"detail": "Expected application/json"}, 415)
    return await call_next(request)


@app.exception_handler(KeyError)
async def missing(request, error):
    return JSONResponse({"detail": f"Unknown identifier {error.args[0]}"}, 404)


@app.get("/api/v1/snapshots/{snapshot}/network")
async def get_network(snapshot: str) -> Network:
    get(app.state.db, "Snapshot", snapshot)
    return network(app.state.db)


@app.get("/api/v1/snapshots/{snapshot}/candidates")
async def get_candidates(snapshot: str) -> list[Candidate]:
    get(app.state.db, "Snapshot", snapshot)
    return list(discover(app.state.db).values())


@app.get("/api/v1/candidates/{candidate}")
async def get_candidate(candidate: str) -> Candidate:
    return discover(app.state.db)[candidate]


@app.post("/api/v1/evaluations")
async def post_evaluation(body: Request) -> Evaluation:
    try:
        return evaluate(app.state.db, body)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@app.get("/api/v1/evaluations/{evaluation}")
async def get_evaluation(evaluation: str) -> Evaluation:
    return payload(app.state.db, "Evaluation", evaluation)


@app.get("/api/v1/plans/{plan}")
async def get_plan(plan: str) -> Plan:
    return payload(app.state.db, "Plan", plan)


@app.get("/api/v1/evidence/{claim}")
async def evidence(claim: str) -> Evidence:
    db = app.state.db
    value = get(db, "Claim", claim)
    sources = rows(
        db,
        "MATCH (:Claim {id:$c})-[:CITES]->(s:Source) RETURN properties(s) AS source",
        c=claim,
    )
    rules = rows(
        db,
        "MATCH (r:RuleVersion)-[]->(:Claim {id:$c}) RETURN DISTINCT r.id AS id ORDER BY id",
        c=claim,
    )
    plans = rows(
        db,
        "MATCH (p:Plan)-[:DEPENDS_ON]->(:Claim {id:$c}) RETURN DISTINCT p.id AS id ORDER BY id",
        c=claim,
    )
    return {
        "claim": value,
        "sources": sources,
        "dependent_rules": rules,
        "dependent_plans": plans,
    }


# UI and API share the same loopback origin. Only compiled assets are exposed.

web_dist = ROOT / "web/dist"
if (web_dist / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=web_dist / "assets"), name="ui-assets")


@app.get("/", include_in_schema=False)
async def product():
    if not (web_dist / "index.html").is_file():
        raise HTTPException(
            503, "Build web/ with npm ci and npm run build, then restart Symbio."
        )
    return FileResponse(web_dist / "index.html")


@app.get("/references/evidence-inventory", include_in_schema=False)
async def inventory():
    return FileResponse(ROOT / "docs/evidence-inventory.md", media_type="text/plain")


if (web_dist / "licenses").is_dir():
    app.mount(
        "/licenses", StaticFiles(directory=web_dist / "licenses"), name="ui-licenses"
    )
