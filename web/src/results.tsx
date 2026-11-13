import { useEffect, useRef, useState } from "react";
import {
  Agreement,
  api,
  Claim,
  Fields,
  fmt,
  go,
  Header,
  href,
  human,
  Load,
  option,
  prefix,
  route,
  Seg,
  Table,
  Tag,
  useData,
  useRoute,
  type Candidate,
  type Eval,
  type Plan,
  type Summary,
  type Network,
} from "./core";
import { Requirements } from "./opportunity";
import { Diagram, projection } from "./network";

function Bars({ rows }: { rows: [string, number | null | undefined][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1] ?? 0));
  return (
    <div>
      {rows.map(([name, v]) => (
        <div className="bar" key={name}>
          <b>{name}</b>
          <div className="bar__track">
            <span
              className={"bar__fill " + (v === max ? "is-pick" : "")}
              style={{ width: (100 * (v ?? 0)) / max + "%" }}
            />
            <span className="bar__val">{fmt(v)}</span>
          </div>
        </div>
      ))}
      <p className="t-label">Delivered biomethane · MWh/year, LHV</p>
    </div>
  );
}
function Worst({ ev, cs }: { ev: Eval; cs: Candidate[] }) {
  return (
    <section className="od__sec">
      <h2 className="t-sec">Normal operation and worst tested supplier loss</h2>
      <div className="sum3">
        <div>
          <small>Normal-operation leaders</small>
          <b>
            {ev.normal_leaders.map((c) => option(c, cs)).join(" · ") ||
              "Unavailable"}
          </b>
          {fmt(ev.ranking[0]?.objective.value)} MWh/year
        </div>
        <div>
          <small>Worst single-supplier loss leaders</small>
          <b>
            {ev.worst_case_leaders.map((c) => option(c, cs)).join(" · ") ||
              "Unavailable"}
          </b>
          {fmt(
            ev.plans.find(
              (p) =>
                p.candidate === ev.worst_case_leaders[0] &&
                ev.worst_supplier_removals[p.candidate]?.includes(p.scenario),
            )?.objective?.value,
          )}{" "}
          MWh/year
        </div>
      </div>
    </section>
  );
}
function PlanDetail({ p, stress }: { p: Plan; stress: boolean }) {
  const q = useRoute().searchParams,
    choices = stress
      ? [
          "Changed exchanges",
          "Constraints",
          "Route headroom",
          "Requirements & evidence",
        ]
      : ["Allocations", "Constraints", "Requirements & evidence"],
    tab = choices.includes(q.get("tab") || "") ? q.get("tab")! : choices[0],
    stream = q.get("detailStream") || p.requirements[0]?.stream;
  return (
    <section id="saved-plan" className="od__sec">
      <div className="between">
        <h2 className="t-sec">
          {stress
            ? "Exchanges, constraints and route headroom"
            : "Selected plan"}
        </h2>
        <Tag kind={p.conditional ? "cond" : "exist"}>{p.eligibility}</Tag>
      </div>
      <Fields
        items={[
          ["Saved plan", <code>{p.id}</code>],
          ["Agreement", human(p.assumption_set)],
          ["Configuration", human(p.candidate)],
          ["Status", p.status],
        ]}
      />
      {p.status !== "optimal" ? (
        <div className="notice notice--cond">
          {human(p.status)} · {p.reason || "No validated allocation available."}
        </div>
      ) : (
        <div className="facts">
          {[
            ["Unallocated residue", p.unallocated],
            ["Unmet gas requirement", p.unmet_demand],
            ["Freight", p.freight],
          ].map(([name, v]) =>
            typeof v === "object" && v ? (
              <span className="chip chip--static" key={String(name)}>
                {String(name)} · {fmt(v.value)} {v.unit}/year
              </span>
            ) : null,
          )}
        </div>
      )}
      <Seg
        label="Plan detail"
        items={choices.map((k) => [k, k])}
        value={tab}
        set={(tab) => go({ tab })}
      />
      {tab === "Constraints" ? (
        <Table
          cols={["Constraint", "Slack / year", "Active", "Evidence"]}
          rows={(p.constraints || []).map((c) => [
            human(c.id),
            fmt(c.slack.value) + " " + c.slack.unit,
            c.active ? "Binding" : "No",
            c.facts.map((id) => <Claim key={id} id={id} />),
          ])}
        />
      ) : tab === "Route headroom" ? (
        <>
          <p>
            Additional intake for each independently solved route at fixed
            service levels. Values cannot be added.
          </p>
          <Table
            cols={["Route", "Additional wet t/year"]}
            rows={(p.route_headroom || []).map((h) => [
              h.exchange,
              fmt(h.additional.value),
            ])}
          />
        </>
      ) : tab === "Requirements & evidence" ? (
        <>
          {p.requirements.length ? (
            <>
              <Seg
                label="Requirement stream"
                value={stream}
                set={(detailStream) => go({ detailStream })}
                items={[...new Set(p.requirements.map((v) => v.stream))].map(
                  (s) => [s, human(s)],
                )}
              />
              <Requirements
                vs={p.requirements.filter((v) => v.stream === stream)}
              />
            </>
          ) : (
            <p>
              Existing agricultural use. No proposed processor requirements
              apply.
            </p>
          )}
        </>
      ) : tab === "Changed exchanges" ? (
        <>
          {!p.vs_normal?.changed_exchanges.length && (
            <p>
              {p.status === "optimal"
                ? "No allocation changes."
                : "Allocation changes unavailable."}
            </p>
          )}
          <Table
            cols={["Exchange", "Stressed / year", "Change / year", "Basis"]}
            rows={(p.vs_normal?.changed_exchanges || []).map((a) => [
              a.exchange,
              fmt(a.value) + " " + a.unit,
              fmt(a.delta) + " " + a.unit,
              a.basis,
            ])}
          />
        </>
      ) : (
        <Table
          cols={["Exchange", "Quantity / year", "Physical basis"]}
          rows={p.allocations.map((a) => [
            a.exchange,
            fmt(a.value) + " " + a.unit,
            a.basis,
          ])}
        />
      )}
      <details>
        <summary>Input evidence ({p.facts.length})</summary>
        <div className="facts">
          {p.facts.map((id) => (
            <Claim key={id} id={id} />
          ))}
        </div>
      </details>
    </section>
  );
}
function StressGraph({
  p,
  normal,
  cs,
}: {
  p: Plan;
  normal?: Summary;
  cs: Candidate[];
}) {
  const n = useData<Network>(prefix + "/network"),
    [which, set] = useState("stressed"),
    [sel, select] = useState(""),
    base = useData<Plan>(
      which === "normal" && normal ? "/plans/" + normal.id : null,
    ),
    plan = which === "normal" ? base.data : p;
  if (!n.data) return <Load r={n} />;
  return (
    <section className="od__sec">
      <h2 className="t-sec">Changed allocations</h2>
      <Seg
        label="Network view"
        value={which}
        set={set}
        items={[
          ["normal", "Normal"],
          ["stressed", "Stressed"],
        ]}
      />
      {plan?.status === "optimal" ? (
        <>
          <div className="gpanel">
            <Diagram
              g={projection(
                n.data,
                cs.filter((c) => c.id === plan.candidate),
              )}
              plan={plan}
              selected={sel}
              select={select}
              stages={n.data.nodes
                .filter((n) => n.labels.includes("Stage"))
                .map((n) => n.properties.id)}
            />
          </div>
          {sel && (
            <div className="planblock">
              {human(sel)} · {plan.scenario}
            </div>
          )}
        </>
      ) : !plan ? (
        <Load r={base} />
      ) : (
        <p>Allocation unavailable.</p>
      )}
    </section>
  );
}
function ComparisonTable({
  ev,
  cs,
  select,
  current,
}: {
  ev: Eval;
  cs: Candidate[];
  select: (p: Summary) => void;
  current?: string;
}) {
  const [reverse, set] = useState(false),
    [cols, columns] = useState<string[]>([]);
  const opt = ["Unallocated wet t", "Unmet MWh", "Freight t km"],
    normal = ev.plans.filter((p) => p.scenario === "normal");
  const [detail, setDetail] = useState<Record<string, Plan>>({}),
    [err, setErr] = useState(""),
    [tick, retry] = useState(0);
  useEffect(() => {
    if (!cols.length) return;
    const ac = new AbortController();
    setErr("");
    Promise.all(normal.map((p) => api<Plan>("/plans/" + p.id, ac.signal)))
      .then((v) => {
        if (!ac.signal.aborted)
          setDetail(Object.fromEntries(v.map((p) => [p.id, p])));
      })
      .catch((e) => {
        if (!ac.signal.aborted) setErr(e.message);
      });
    return () => ac.abort();
  }, [ev.id, cols.length, tick]);
  const rank = (id: string) => ev.ranking.find((r) => r.candidate === id)?.rank;
  const sorted = [...normal].sort((a, b) =>
    a.candidate === "baseline"
      ? -1
      : b.candidate === "baseline"
        ? 1
        : ((rank(a.candidate) ?? 999) - (rank(b.candidate) ?? 999)) *
          (reverse ? -1 : 1),
  );
  return (
    <section className="od__sec">
      <div className="between">
        <h2 className="t-sec">Comparison table</h2>
        <div className="row">
          <button className="btn btn--text" onClick={() => set(!reverse)}>
            Rank {reverse ? "↑" : "↓"}
          </button>
          <details className="menu">
            <summary className="btn btn--secondary">Columns</summary>
            <div className="menu__pop" style={{ right: 0, left: "auto" }}>
              {opt.map((c) => (
                <label key={c} className="check">
                  <input
                    type="checkbox"
                    checked={cols.includes(c)}
                    onChange={() =>
                      columns(
                        cols.includes(c)
                          ? cols.filter((x) => x !== c)
                          : [...cols, c],
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>
      {err && (
        <button onClick={() => retry((t) => t + 1)}>
          Retry column data · {err}
        </button>
      )}
      <Table
        cols={[
          "Option",
          "Rank",
          "Delivered MWh/year",
          "Difference from baseline",
          ...cols,
          "Planning status",
        ]}
        rows={sorted.map((p) => {
          const r = rank(p.candidate),
            d = detail[p.id];
          return [
            <button
              className="rowbtn"
              aria-pressed={p.id === current}
              onClick={() => select(p)}
            >
              {p.id === current ? "●" : "○"} {option(p.candidate, cs)}
            </button>,
            r == null
              ? "Unscored"
              : r +
                (ev.ranking.filter((x) => x.rank === r).length > 1
                  ? " · tied"
                  : ""),
            fmt(p.objective?.value),
            <>
              {fmt(p.vs_baseline?.mwh)} MWh/year{" "}
              <small>
                (
                {p.vs_baseline?.percent == null
                  ? "percentage unavailable"
                  : fmt(p.vs_baseline.percent) + "%"}
                )
              </small>
            </>,
            ...cols.map((c) =>
              d
                ? fmt(
                    [d.unallocated, d.unmet_demand, d.freight][opt.indexOf(c)]
                      ?.value,
                  )
                : "Loading…",
            ),
            <Tag kind={p.candidate === "baseline" ? "exist" : "cond"}>
              {p.status !== "optimal"
                ? p.status
                : p.candidate === "baseline"
                  ? "Existing"
                  : "Conditional"}
            </Tag>,
          ];
        })}
      />
    </section>
  );
}
export function Analysis({ cs, stress }: { cs: Candidate[]; stress: boolean }) {
  const u = useRoute(),
    q = u.searchParams,
    ids = cs.map((c) => c.id),
    agree = q.get("agreement") || "transferable",
    chosen = q.has("options")
      ? (q.get("options") || "").split(",").filter(Boolean)
      : ids;
  const suppliers = [
      ...new Set(cs.flatMap((c) => c.paths.map((p) => p.supplier))),
    ],
    removed = q.has("losses")
      ? (q.get("losses") || "").split(",").filter(Boolean)
      : suppliers;
  const mode = q.get("mode") || "loss",
    target = q.get("target") || chosen[0] || "",
    fraction = q.get("remaining") ?? "50",
    invalid =
      fraction.trim() === "" ||
      !Number.isFinite(+fraction) ||
      +fraction < 0 ||
      +fraction > 100;
  const eid = q.get("evaluation"),
    saved = useData<Eval>(
      eid ? "/evaluations/" + encodeURIComponent(eid) : null,
    );
  const standalone = useData<Plan>(
    !eid && q.get("plan")
      ? "/plans/" + encodeURIComponent(q.get("plan")!)
      : null,
  );
  useEffect(() => {
    const plan = standalone.data;
    if (!eid && plan) {
      history.replaceState(
        null,
        "",
        href(plan.scenario === "normal" ? "/comparison" : "/disruptions", {
          evaluation: plan.evaluation,
          scenario: plan.scenario,
          agreement: plan.assumption_set,
          candidate: plan.candidate,
        }),
      );
      window.dispatchEvent(new Event("hashchange"));
    }
  }, [standalone.data, eid]);
  const [last, setLast] = useState<Eval>(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    ctl = useRef<AbortController | null>(null);
  const ev =
      saved.data || (last && (!eid || last.id === eid) ? last : undefined),
    all = ev?.plans || [];
  const scenario = stress
    ? q.get("scenario") && q.get("scenario") !== "normal"
      ? q.get("scenario")!
      : all.find((p) => p.scenario === "remove-supplier-yeast")?.scenario ||
        all.find((p) => p.scenario.startsWith("remove-"))?.scenario ||
        "capacity"
    : "normal";
  const setOfPlans = all.filter((p) => p.scenario === scenario);
  const selected =
    setOfPlans.find((p) => p.id === q.get("plan")) ||
    setOfPlans.find((p) => p.candidate === q.get("candidate")) ||
    setOfPlans.find(
      (p) => p.candidate === (stress ? cs[0]?.id : ev?.normal_leaders[0]),
    ) ||
    setOfPlans[0];
  const missingPlan =
    q.has("plan") && ev && !all.some((p) => p.id === q.get("plan"));
  const detail = useData<Plan>(
    selected && !missingPlan ? "/plans/" + selected.id : null,
  );
  async function run(initial = false) {
    ctl.current?.abort();
    const ac = new AbortController();
    ctl.current = ac;
    setPending(true);
    setError("");
    const body = {
      assumption_set: agree,
      candidate_ids: chosen,
      capacity_fraction: stress && mode === "capacity" ? +fraction / 100 : 0.5,
      capacity_target:
        stress && mode === "capacity" && target !== "each" ? target : null,
      remove_suppliers: stress && mode === "loss" ? removed : suppliers,
    };
    try {
      const result = await api<Eval>("/evaluations", ac.signal, body);
      if (ac.signal.aborted || route().pathname !== u.pathname) return;
      const sc = stress
        ? mode === "capacity"
          ? "capacity"
          : "remove-" +
            (removed.includes("supplier-yeast") ? "supplier-yeast" : removed[0])
        : "normal";
      const id = stress
        ? target === "each"
          ? chosen[0]
          : target
        : chosen.includes(q.get("candidate") || "")
          ? q.get("candidate")
          : result.normal_leaders[0];
      const p =
        result.plans.find((p) => p.scenario === sc && p.candidate === id) ||
        result.plans.find((p) => p.scenario === sc);
      setLast(result);
      const changes = {
        evaluation: result.id,
        scenario: sc,
        plan: p?.id ?? null,
        candidate: p?.candidate ?? null,
        applied: JSON.stringify(body),
      };
      if (initial) {
        history.replaceState(null, "", href(undefined, changes));
        window.dispatchEvent(new Event("hashchange"));
      } else go(changes);
    } catch (e) {
      if (!ac.signal.aborted) setError((e as Error).message);
    } finally {
      if (!ac.signal.aborted) setPending(false);
    }
  }
  useEffect(() => {
    if (!eid && !q.has("plan") && !disabled) void run(true);
    return () => ctl.current?.abort();
  }, []);
  useEffect(() => {
    const stop = () => {
      if (route().searchParams.get("evaluation") !== eid) {
        ctl.current?.abort();
        setPending(false);
      }
    };
    window.addEventListener("popstate", stop);
    return () => window.removeEventListener("popstate", stop);
  }, [eid]);
  const status = ev ? human(ev.assumption_set) : "",
    pick = (p: Summary) =>
      go({ plan: p.id, candidate: p.candidate, scenario: p.scenario });
  const diff =
    ev &&
    (agree !== ev.assumption_set ||
      [...chosen].sort().join() !==
        all
          .filter((p) => p.scenario === "normal")
          .map((p) => p.candidate)
          .filter((c) => c !== "baseline")
          .sort()
          .join() ||
      (stress &&
        q.get("applied") !==
          JSON.stringify({
            assumption_set: agree,
            candidate_ids: chosen,
            capacity_fraction: mode === "capacity" ? +fraction / 100 : 0.5,
            capacity_target:
              mode === "capacity" && target !== "each" ? target : null,
            remove_suppliers: mode === "loss" ? removed : suppliers,
          })));
  const disabled =
    !chosen.length ||
    (stress &&
      ((mode === "capacity" && invalid) ||
        (mode === "loss" && !removed.length) ||
        (target !== "each" && !chosen.includes(target))));
  const norm = all.find(
    (p) => p.candidate === selected?.candidate && p.scenario === "normal",
  );
  return (
    <>
      <Header
        title={stress ? "Disruption analysis" : "Compare processing options"}
        sub={
          stress
            ? "Test capacity reductions and supplier losses to see how allocations and delivered energy change."
            : "Evaluate the existing arrangement against hypothetical processing capacities."
        }
        note="Annual results · Assumed quantities, yields and acceptance terms"
      >
        {stress && (
          <a
            className="back"
            href={href("/comparison", { plan: null, scenario: "normal" })}
          >
            ← Back to comparison
          </a>
        )}
      </Header>
      <div className="inset stack analysis">
        <section className={"panel " + (stress ? "ctl4" : "ctl")}>
          <div className="col">
            <b>{stress ? "Scenario controls" : "Agreement"}</b>
            <Agreement value={agree} set={(agreement) => go({ agreement })} />
          </div>
          <div className="col">
            {stress ? (
              <>
                <b>Test</b>
                <Seg
                  label="Test"
                  items={[
                    ["capacity", "Processor capacity"],
                    ["loss", "Single-supplier loss"],
                  ]}
                  value={mode}
                  set={(mode) => go({ mode })}
                />
                <label>
                  Processor{" "}
                  <select
                    value={target}
                    onChange={(e) => go({ target: e.target.value })}
                  >
                    {mode === "capacity" && (
                      <option value="each">Each evaluated processor</option>
                    )}
                    {cs
                      .filter((c) => chosen.includes(c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {option(c.id, cs)}
                        </option>
                      ))}
                  </select>
                </label>
                {mode === "capacity" ? (
                  <label>
                    Remaining capacity (%){" "}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={fraction}
                      onChange={(e) => go({ remaining: e.target.value })}
                    />
                    <input
                      aria-label="Remaining capacity"
                      type="range"
                      min="0"
                      max="100"
                      value={fraction}
                      onChange={(e) => go({ remaining: e.target.value })}
                    />
                    {invalid && (
                      <span role="alert">Enter 0 to 100% remaining.</span>
                    )}
                  </label>
                ) : (
                  <>
                    {suppliers.map((s) => (
                      <label key={s}>
                        <input
                          type="checkbox"
                          checked={removed.includes(s)}
                          onChange={() =>
                            go({
                              losses: (removed.includes(s)
                                ? removed.filter((v) => v !== s)
                                : [...removed, s]
                              ).join(","),
                            })
                          }
                        />{" "}
                        {human(s)}
                      </label>
                    ))}
                    <small>Each removal is tested independently.</small>
                  </>
                )}
              </>
            ) : (
              <>
                <b>Processor sizes</b>
                <div className="facts">
                  {cs.map((c) => (
                    <button
                      className="chip"
                      key={c.id}
                      aria-pressed={chosen.includes(c.id)}
                      onClick={() =>
                        go({
                          options: (chosen.includes(c.id)
                            ? chosen.filter((i) => i !== c.id)
                            : [...chosen, c.id]
                          ).join(","),
                        })
                      }
                    >
                      {option(c.id, cs)}
                    </button>
                  ))}
                </div>
                <Tag>Baseline · always included</Tag>
              </>
            )}
          </div>
          <div className="col">
            <b>{stress ? "Run" : "Evaluation"}</b>
            <button
              className="btn btn--primary"
              disabled={disabled}
              onClick={() => run()}
            >
              {stress ? "Run disruption test" : "Evaluate options"}
            </button>
            {stress && (
              <button
                className="btn btn--secondary"
                onClick={() =>
                  go({
                    agreement: null,
                    remaining: null,
                    losses: null,
                    target: null,
                    mode: null,
                  })
                }
              >
                Reset controls
              </button>
            )}
            <Fields
              items={[
                ["Agreement", human(agree)],
                [
                  "Included",
                  String(chosen.length) + " processor sizes + baseline",
                ],
                [
                  "Status",
                  pending
                    ? "Calculating"
                    : diff
                      ? "Inputs changed"
                      : ev
                        ? "Completed"
                        : "Ready",
                ],
              ]}
            />
            {!chosen.length && <small>Select a processor size.</small>}
          </div>
        </section>
        {pending && (
          <div role="status" className="notice notice--info">
            {ev
              ? "Recalculating · previous evaluated results shown"
              : "Evaluating options…"}
          </div>
        )}
        {error && (
          <div role="alert" className="notice notice--cond">
            {error}{" "}
            <button disabled={disabled} onClick={() => run()}>
              Retry evaluation
            </button>
          </div>
        )}
        {saved.error && (
          <Load r={saved}>
            <button onClick={() => run()}>Create a new evaluation</button>
          </Load>
        )}
        {!ev && !pending && !eid && !q.has("plan") && (
          <section className="panel">
            <h2 className="t-sec">Not evaluated yet</h2>
            <p>Select valid inputs and run the evaluation.</p>
          </section>
        )}
        {missingPlan || standalone.error ? (
          <div className="notice notice--cond">
            Saved plan unavailable in this evaluation.{" "}
            <button
              onClick={() => {
                go({ plan: null });
                if (!eid) void run();
              }}
            >
              Return to results
            </button>
          </div>
        ) : null}
        {ev && (
          <>
            <div className="ctxbar">
              <b>Evaluated results</b>
              {status} {diff && <Tag kind="cond">Pending inputs differ</Tag>}
              <small>{ev.id}</small>
            </div>
            {stress ? (
              <>
                <div className="panel">
                  <b>Saved scenario </b>
                  <select
                    aria-label="Saved scenario"
                    value={scenario}
                    onChange={(e) =>
                      go({ scenario: e.target.value, plan: null })
                    }
                  >
                    {[...new Set(all.map((p) => p.scenario))]
                      .filter((s) => s !== "normal")
                      .map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                  </select>{" "}
                  <select
                    aria-label="Saved option"
                    value={selected?.candidate || ""}
                    onChange={(e) => {
                      const p = setOfPlans.find(
                        (p) => p.candidate === e.target.value,
                      );
                      if (p) pick(p);
                    }}
                  >
                    {setOfPlans.map((p) => (
                      <option key={p.id} value={p.candidate}>
                        {option(p.candidate, cs)}
                      </option>
                    ))}
                  </select>
                </div>
                {selected && (
                  <div className="reco">
                    <h2 className="reco__head">
                      {option(selected.candidate, cs)} · {human(scenario)}
                    </h2>
                    <p>
                      {selected.status === "optimal"
                        ? fmt(selected.objective?.value) + " MWh/year delivered"
                        : human(selected.status)}
                    </p>
                    {detail.data?.disruption.fraction != null && (
                      <p>
                        {fmt(Number(detail.data.disruption.fraction) * 100)}%
                        remaining · target{" "}
                        {String(detail.data.disruption.target ?? "baseline")}
                      </p>
                    )}
                  </div>
                )}
                <div className="od__main">
                  <section className="od__sec">
                    <h2 className="t-sec">Normal versus stressed</h2>
                    <Bars
                      rows={[
                        ["Normal", norm?.objective?.value],
                        ["Stressed", selected?.objective?.value],
                      ]}
                    />
                    <span>
                      Change · {fmt(selected?.vs_normal?.mwh)} MWh/year ·{" "}
                      {selected?.vs_normal?.percent == null
                        ? "percentage unavailable"
                        : fmt(selected.vs_normal.percent) + "%"}
                    </span>
                  </section>
                  {detail.data && (
                    <StressGraph p={detail.data} normal={norm} cs={cs} />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="od__main">
                  <section className="od__sec">
                    <div className="reco">
                      <small>Current · {status}</small>
                      <h2 className="reco__head">
                        {ev.recommendation === "baseline"
                          ? "Retain the existing arrangement"
                          : ev.normal_leaders.length
                            ? ev.normal_leaders
                                .map((id) => option(id, cs))
                                .join(" · ") + " leads under normal operation"
                            : "No ranked option"}
                      </h2>
                      <p>
                        {fmt(ev.ranking[0]?.objective.value)} MWh/year delivered
                        under the evaluated agreement and current planning
                        assumptions.
                      </p>
                      <div className="facts">
                        <Tag kind="cond">Conditional result</Tag>
                        <Tag>Normal operation</Tag>
                        <Claim id={ev.assumption_set} />
                      </div>
                      <div className="facts">
                        <button
                          className="btn btn--secondary"
                          onClick={() =>
                            document
                              .getElementById("saved-plan")
                              ?.scrollIntoView()
                          }
                        >
                          Inspect selected plan
                        </button>
                        <a
                          className="btn btn--secondary"
                          href={href("/disruptions", {
                            scenario: null,
                            plan: null,
                          })}
                        >
                          Test disruptions
                        </a>
                      </div>
                    </div>
                  </section>
                  <section className="od__sec">
                    <h2 className="t-sec">Delivered biomethane</h2>
                    <Bars
                      rows={[...all.filter((p) => p.scenario === "normal")]
                        .sort(
                          (a, b) =>
                            (b.objective?.value ?? -1) -
                            (a.objective?.value ?? -1),
                        )
                        .map((p) => [
                          option(p.candidate, cs),
                          p.objective?.value,
                        ])}
                    />
                  </section>
                  <ComparisonTable
                    ev={ev}
                    cs={cs}
                    select={pick}
                    current={selected?.id}
                  />
                  <Worst ev={ev} cs={cs} />
                </div>
              </>
            )}
            {!missingPlan &&
              (detail.data ? (
                <div className="od__main">
                  <PlanDetail p={detail.data} stress={stress} />
                </div>
              ) : (
                selected && <Load r={detail} label="Loading saved plan" />
              ))}
            {stress ? (
              <div className="od__main">
                <Worst ev={ev} cs={cs} />
              </div>
            ) : (
              <a
                className="btn btn--secondary"
                href={href("/disruptions", {
                  scenario: null,
                  plan: null,
                  target: chosen.includes(selected?.candidate || "")
                    ? selected!.candidate
                    : chosen[0],
                })}
              >
                Inspect supplier-loss scenarios →
              </a>
            )}
          </>
        )}
        {!ev &&
          !error &&
          !pending &&
          !saved.error &&
          !standalone.error &&
          (eid || q.has("plan")) && (
            <Load r={saved} label="Retrieving evaluation" />
          )}
      </div>
    </>
  );
}
