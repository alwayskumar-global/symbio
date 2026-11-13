import { Fragment } from "react";
import {
  Agreement,
  Claim,
  Fields,
  fmt,
  go,
  Header,
  href,
  human,
  Load,
  Seg,
  Tag,
  useData,
  useRoute,
  type Candidate,
  type Verdict,
  prefix,
  type Network,
} from "./core";
import { Diagram, projection } from "./network";
export function Requirements({ vs }: { vs: Verdict[] }) {
  const q = useRoute().searchParams,
    filter = q.get("filter") || "all",
    open = q.get("requirement") ?? "rule-authorization-v1";
  return (
    <>
      <Seg
        label="Requirement outcome filter"
        value={filter}
        set={(f) => go({ filter: f })}
        items={["all", "passed", "unresolved", "failed"].map((k) => [
          k,
          human(k) +
            " " +
            vs.filter((v) => k === "all" || k === v.status).length,
        ])}
      />
      <div className="rq">
        <div className="rq__r rq__h">
          {["Requirement", "Observed input", "Outcome", "Evidence"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {vs
          .filter((v) => filter === "all" || v.status === filter)
          .map((v) => (
            <Fragment key={v.rule + v.stream}>
              <div className="rq__r rq__i">
                <button
                  className="rq__name"
                  aria-expanded={open === v.rule}
                  onClick={() =>
                    go({ requirement: open === v.rule ? "" : v.rule })
                  }
                >
                  › {human(v.rule)}
                </button>
                <span>
                  {v.value ?? "Unknown"}{" "}
                  {v.unit === "fraction" ? "fraction" : ""}
                </span>
                <span>
                  <span className={"badge req req--" + v.status}>
                    {v.status}
                  </span>
                </span>
                <Claim id={v.measurement} />
              </div>
              {open === v.rule && (
                <div className="rq__body">
                  <Fields
                    items={[
                      ["Rule version", v.rule],
                      ["Stream", human(v.stream)],
                      ["Measured basis", v.unit ?? "Unknown"],
                      ["Observed value", v.value ?? "Unknown"],
                      [
                        "Planning assumption",
                        v.planning_assumption ? (
                          <Claim id={v.planning_assumption} />
                        ) : (
                          "None"
                        ),
                      ],
                    ]}
                  />
                </div>
              )}
            </Fragment>
          ))}
        {vs.filter((v) => filter === "all" || v.status === filter).length ===
          0 && <p>No matching requirements.</p>}
      </div>
    </>
  );
}
export function Opportunity({ cs }: { cs: Candidate[] }) {
  const q = useRoute().searchParams,
    id =
      (q.get("candidate") === "baseline" ? null : q.get("candidate")) ||
      cs[Math.floor(cs.length / 2)]?.id,
    r = useData<Candidate>(id ? "/candidates/" + encodeURIComponent(id) : null),
    c = r.data,
    net = useData<Network>(prefix + "/network");
  if (!id) return <Header title="No processing option was discovered" />;
  if (!c)
    return (
      <Load r={r} label="Loading opportunity">
        <a href={href("/opportunities", { candidate: null })}>
          Return to discovered options
        </a>
      </Load>
    );
  const path = c.paths.find((p) => p.stream === q.get("stream")) || c.paths[0],
    conditional = c.paths.some((p) => p.eligible_under_assumptions);
  return (
    <>
      <Header
        title="Digestion, upgrading & digestate handling"
        sub="Explore how an additional processing package could connect fermentation residues to biomethane delivery and agricultural use."
      >
        <div className="between">
          <span className="crumbs">
            Opportunities　 ›　 Processing addition
          </span>
          <a className="btn btn--secondary btn--sm" href={href("/network")}>
            ← Back to network
          </a>
        </div>
      </Header>
      <div className="inset facts">
        <Tag kind="hyp">Hypothetical addition</Tag>
        <Tag kind="cond">
          {conditional ? "Conditional planning" : "Unresolved"}
        </Tag>
      </div>
      <section className="inset panel panel--tight cfg">
        <div>
          <b>Configuration</b>
          <div className="t-label">
            Alternative sizes of the same processing package
          </div>
        </div>
        <Seg
          label="Fixed annual intake capacity"
          value={id}
          set={(candidate) => go({ candidate })}
          items={cs.map((o) => [o.id, fmt(o.capacity) + " wet t/year"])}
        />
        <div className="t-label">
          <b>Fixed annual intake capacity</b> · {human(c.site)}
          <br />
          Capacity is an upper limit on allocated intake.
        </div>
      </section>
      <div className="od">
        <div className="od__main">
          <section className="od__sec">
            <h2 className="t-sec">What this addition connects</h2>
            <p className="t-body">
              Existing residues are delivered directly for agricultural use. The
              proposed addition can recover biomethane while preserving the
              modeled nutrient commitment.
            </p>
            <div className="sum3">
              {[
                [
                  "Residue streams",
                  c.paths.map((p) => human(p.stream)).join(" and "),
                ],
                ["Processing package", "Digestion, upgrading and handling"],
                ["Downstream uses", "Biomethane and agricultural use"],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="od__sec">
            <h2 className="t-sec">Connected pathway</h2>
            <Seg
              label="Supplier path"
              items={c.paths.map((p) => [p.stream, human(p.stream)])}
              value={path.stream}
              set={(stream) => go({ stream })}
            />
            <div className="between">
              <span className="t-label">
                Selected stream · {human(path.stream)}
              </span>
              <a
                className="btn btn--secondary btn--sm"
                href={href("/network", { entity: path.stream })}
              >
                Open in network →
              </a>
            </div>
            {net.data ? (
              <div className="gpanel compact-graph">
                <Diagram
                  g={projection(net.data, [c])}
                  selected={q.get("pathNode") || path.stream}
                  select={(v) => go({ pathNode: v })}
                  stages={net.data.nodes
                    .filter((x) => x.labels.includes("Stage"))
                    .map((x) => x.properties.id)}
                  startExpanded
                />
              </div>
            ) : (
              <Load r={net} />
            )}
          </section>
          <section className="od__sec">
            <h2 className="t-sec">Planning status</h2>
            <Fields
              items={[
                [
                  "Structural pathway",
                  path.reachable ? "Reachable" : "Unavailable",
                ],
                [
                  "Modeled eligibility",
                  path.eligible_under_assumptions
                    ? "Eligible under assumptions"
                    : "Unresolved or failed",
                ],
                [
                  "Operational verification",
                  path.operationally_verified ? "Verified" : "Unverified",
                ],
                ["Allocated volume", "Inspect a solved plan"],
              ]}
            />
          </section>
          <section className="od__sec">
            <h2 className="t-sec">Requirements &amp; evidence</h2>
            <Requirements vs={path.verdicts} />
          </section>
        </div>
        <aside className="od__ctx">
          <section className="od__cs">
            <small>Configuration summary</small>
            <h2 className="t-sec">
              {fmt(c.capacity)} <small className="unit">wet t/year</small>
            </h2>
            <Fields
              items={[
                ["Site", human(c.site)],
                ["Fixed capacity", fmt(c.capacity) + " wet t/year"],
                ["Capacity basis", <Claim id={c.capacity_claim} />],
                ["Authorization", <Claim id="permit" />],
              ]}
            />
          </section>
          <section className="od__cs">
            <b>Agreement</b>
            <Agreement
              value={q.get("agreement") || "protected"}
              set={(agreement) => go({ agreement })}
            />
            <a
              className="btn btn--primary"
              href={href("/comparison", {
                candidate: id,
                agreement: q.get("agreement") || "protected",
              })}
            >
              Compare options →
            </a>
          </section>
        </aside>
      </div>
    </>
  );
}
