"""Wire contracts for the local application and the Claude Design handoff."""

from typing import Any, Literal

from pydantic import BaseModel


class Quantity(BaseModel):
    value: float
    unit: str
    basis: str
    period: str


class Allocation(Quantity):
    exchange: str


class Change(Allocation):
    delta: float


class Delta(BaseModel):
    mwh: float
    percent: float | None
    changed_exchanges: list[Change]


class Verdict(BaseModel):
    rule: str
    stream: str
    process: str
    measurement: str
    unit: str | None
    value: str | None
    status: Literal["passed", "failed", "unresolved"]
    evidence: str | None
    planning_assumption: str | None


class Path(BaseModel):
    id: str
    stream: str
    supplier: str
    process: str
    site: str
    grid: str
    farm: str
    verdicts: list[Verdict]
    reachable: bool
    eligible_under_assumptions: bool
    operationally_verified: bool


class Candidate(BaseModel):
    id: str
    site: str
    process: str
    capacity_claim: str
    capacity: float
    fixed_intake: Quantity
    hypothetical_site: bool
    paths: list[Path]


class Edge(BaseModel):
    source: str
    relation: str
    target: str
    evidence_ids: list[str]


class Network(BaseModel):
    snapshot: str
    nodes: list[dict[str, Any]]
    edges: list[Edge]
    opportunities: list[str]


class Summary(BaseModel):
    id: str
    candidate: str
    scenario: str
    status: str
    objective: Quantity | None = None
    vs_normal: Delta | None
    vs_baseline: Delta | None


class Constraint(BaseModel):
    id: str
    slack: Quantity
    active: bool
    facts: list[str]


class Headroom(BaseModel):
    exchange: str
    additional: Quantity


class Plan(Summary):
    evaluation: str
    manifest: dict[str, Any]
    assumption_set: str
    disruption: dict[str, Any]
    conditional: bool
    eligibility: str
    requirements: list[Verdict]
    allocations: list[Allocation]
    facts: list[str]
    constraints: list[Constraint] | None = None
    route_headroom: list[Headroom] | None = None
    unmet_demand: Quantity | None = None
    unallocated: Quantity | None = None
    unmet_offtake: Quantity | None = None
    freight: Quantity | None = None
    reason: str | None = None


class Ranked(BaseModel):
    rank: int
    candidate: str
    objective: Quantity


class Evaluation(BaseModel):
    id: str
    manifest: dict[str, Any]
    assumption_set: str
    plans: list[Summary]
    normal_leaders: list[str]
    recommendation: str | list[str]
    worst_supplier_removals: dict[str, list[str]]
    worst_case_leaders: list[str]
    ranking: list[Ranked]


class Evidence(BaseModel):
    claim: dict[str, str]
    sources: list[dict[str, dict[str, str]]]
    dependent_rules: list[dict[str, str]]
    dependent_plans: list[dict[str, str]]
