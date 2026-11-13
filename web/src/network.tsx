import { useEffect, useRef, useState } from "react";
import {
  Claim,
  Fields,
  fmt,
  go,
  Header,
  href,
  human,
  Icon,
  Seg,
  Table,
  Tag,
  useRoute,
  type Network,
  type Candidate,
  type Plan,
} from "./core";
type Item = {
  id: string;
  name: string;
  kind: string;
  hyp: boolean;
  facts: string[];
};
type Line = Item & { from: string; to: string; route?: string };
function projection(n: Network, cs: Candidate[]) {
  const items: Item[] = n.nodes.flatMap((v) => {
    const l = v.labels.find((x) =>
      ["Facility", "Stream", "ProcessTemplate", "Destination"].includes(x),
    );
    if (
      !l ||
      (!cs.length && (l === "ProcessTemplate" || v.properties.id === "grid"))
    )
      return [];
    return [
      {
        id: v.properties.id,
        name: v.properties.name ?? human(v.properties.id),
        kind: {
          Facility: "Suppliers",
          Stream: "Residue streams",
          ProcessTemplate: "Processing",
          Destination: "Destinations",
        }[l]!,
        hyp: l === "ProcessTemplate" || v.properties.id === "grid",
        facts: v.evidence_ids,
      },
    ];
  });
  const lines: Line[] = [];
  function connect(
    from: string,
    to: string,
    name: string,
    hyp: boolean,
    facts: string[],
    route?: string,
  ) {
    const id = from + ":" + to;
    if (!lines.some((l) => l.id === id))
      lines.push({ id, from, to, name, kind: "Connection", hyp, facts, route });
  }
  for (const e of n.edges)
    if (["PRODUCES", "EXISTING_USE"].includes(e.relation))
      connect(
        e.source,
        e.target,
        human(e.relation.toLowerCase().replaceAll("_", " ")),
        false,
        e.evidence_ids,
      );
  for (const p of cs.flatMap((c) => c.paths)) {
    connect(
      p.stream,
      p.process,
      "Hypothetical",
      true,
      p.verdicts.map((v) => v.measurement),
      p.stream + "/feed",
    );
    connect(p.process, p.grid, "Biomethane", true, ["gas-quality"]);
    connect(p.process, p.farm, "Digestate", true, ["land"]);
  }
  return { items, lines };
}
type Graph = ReturnType<typeof projection>;
export function Diagram({
  g,
  select,
  selected,
  stages,
  plan,
  startExpanded = false,
}: {
  g: Graph;
  select: (id: string) => void;
  selected: string;
  stages: string[];
  plan?: Plan;
  startExpanded?: boolean;
}) {
  const outer = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(900),
    [zoom, setZoom] = useState(1),
    [expanded, expand] = useState(startExpanded);
  useEffect(() => {
    if (!outer.current) return;
    const ob = new ResizeObserver(([v]) => setWidth(v.contentRect.width));
    ob.observe(outer.current);
    return () => ob.disconnect();
  }, []);
  const scale = Math.max(0.64, Math.min(1, (width - 30) / 880)) * zoom;
  const streams = g.items.filter((i) => i.kind === "Residue streams");
  const layout = (id: string) => (id.includes("yeast") ? 400 : 70);
  function coords(i: Item) {
    if (i.kind === "Suppliers") return [0, layout(i.id), 140];
    if (i.kind === "Residue streams") return [170, layout(i.id), 120];
    return [740, i.id === "grid" ? 257 : 70, 140];
  }
  const exchange = (l: Line) => {
    if (!plan) return null;
    const matching = plan.allocations.filter((a) =>
      l.route
        ? a.exchange === l.route
        : l.from.startsWith("supplier-")
          ? false
          : l.hyp
            ? a.exchange.endsWith(
                l.to === "grid" ? "/gas-delivery" : "/digestate",
              )
            : a.exchange === l.from + "/direct",
    );
    if (!matching.length) return null;
    return {
      value: matching.reduce((sum, a) => sum + a.value, 0),
      unit: matching[0].unit,
    };
  };
  const val = (l: Line) => exchange(l)?.value;
  return (
    <div className="gwrap">
      <div className="gover" style={{ left: 12 }}>
        <span className="chip chip--static">
          <Icon name="layers" />
          {plan ? "Solved allocation" : "Pre-addition network"}
        </span>
      </div>
      <div className="gover row" style={{ right: 12, gap: 6 }}>
        {fmt(zoom * 100)}%{" "}
        <div className="zoom">
          {[
            ["minus", "Zoom out", -0.15],
            ["plus", "Zoom in", 0.15],
            ["fit", "Fit to view", 0],
          ].map(([ic, label, num]) => (
            <button
              key={ic}
              aria-label={String(label)}
              onClick={() =>
                setZoom((z) =>
                  num ? Math.min(2, Math.max(0.5, z + Number(num))) : 1,
                )
              }
            >
              <Icon name={String(ic)} />
            </button>
          ))}
        </div>
      </div>
      <div
        className="diagram-scroll"
        ref={outer}
        tabIndex={0}
        aria-label="Scrollable network diagram"
      >
        <div
          className="diagram-shell"
          style={{ width: 880 * scale, height: 450 * scale }}
        >
          <div className="diagram" style={{ transform: `scale(${scale})` }}>
            {["Suppliers", "Residue streams", "Processing", "Destinations"].map(
              (k, i) => (
                <span
                  className="gcol"
                  style={{ left: [0, 170, 370, 740][i] }}
                  key={k}
                >
                  {k}
                </span>
              ),
            )}
            {g.items.some((i) => i.id === "farm") &&
              [28, 426].map((top) => (
                <small
                  key={top}
                  className="gcap"
                  style={{ left: 640, top, width: 240, textAlign: "right" }}
                >
                  Same agricultural destination, shown twice
                </small>
              ))}
            <svg width="880" height="440" aria-hidden="true">
              <defs>
                {["hist", "hyp", "alloc"].map((k) => (
                  <marker
                    key={k}
                    id={"arrow" + k}
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto"
                  >
                    <path d="M0 0L8 4L0 8" fill={`var(--line-${k})`} />
                  </marker>
                ))}
              </defs>
              {g.lines.map((l) => {
                const y = layout(l.from),
                  stream = streams.some((s) => s.id === l.from);
                const d = !l.hyp
                  ? stream
                    ? `M290 ${y} H738`
                    : `M140 ${y} H168`
                  : stream
                    ? `M230 ${y + (y === 70 ? 22 : -22)} V235 H368`
                    : l.to === "grid"
                      ? "M590 257 H738"
                      : "M590 213 H810 V94";
                const k = val(l) ? "alloc" : l.hyp ? "hyp" : "hist";
                return (
                  <path
                    key={l.id}
                    d={d}
                    fill="none"
                    stroke={`var(--line-${k})`}
                    strokeWidth={k === "alloc" ? 4 : 2}
                    strokeDasharray={k === "hyp" ? "6 5" : undefined}
                    markerEnd={`url(#arrow${k})`}
                  />
                );
              })}
            </svg>
            {g.lines.map((l) => {
              const stream = streams.some((s) => s.id === l.from),
                y = layout(l.from);
              const [x, top] = !l.hyp
                ? [stream ? 515 : 155, y]
                : stream
                  ? [230, y === 70 ? 163 : 307]
                  : l.to === "grid"
                    ? [665, 257]
                    : [810, 152];
              return (
                <button
                  key={l.id}
                  title={l.from + " → " + l.to}
                  aria-label={l.from + " → " + l.to}
                  className={l.hyp ? "gchip" : "gh"}
                  style={{ left: x, top }}
                  onClick={() => select(l.id)}
                >
                  {l.hyp && (
                    <>
                      {l.name}
                      <small>
                        {val(l) != null
                          ? fmt(val(l)) + " " + exchange(l)?.unit + "/yr"
                          : l.name === "Hypothetical"
                            ? ""
                            : "Hypothetical"}
                      </small>
                    </>
                  )}
                </button>
              );
            })}
            {g.items.map((i) => {
              if (i.kind === "Processing")
                return (
                  <div
                    key={i.id}
                    className={
                      "gpkg " + (selected === i.id ? "is-selected" : "")
                    }
                    style={{ left: 370, top: expanded ? 141 : 184, width: 220 }}
                  >
                    <button className="gpkg__sel" onClick={() => select(i.id)}>
                      <Icon name="layers" />
                      <span>
                        <b>Proposed processing package</b>
                        <small>{i.name}</small>
                      </span>
                    </button>
                    {expanded && (
                      <ol className="gpkg__stages">
                        {stages.map((s) => (
                          <li key={s}>{human(s)}</li>
                        ))}
                      </ol>
                    )}
                    <button
                      className="gpkg__tog"
                      aria-expanded={expanded}
                      onClick={() => expand(!expanded)}
                    >
                      <Icon name="down" />
                      {expanded ? "Collapse" : "Expand"} stages
                    </button>
                  </div>
                );
              const [x, y, w] = coords(i);
              return (i.id === "farm" ? [70, 400] : [y]).map((top) => (
                <button
                  key={i.id + top}
                  className={
                    "node gn " +
                    (i.kind === "Residue streams"
                      ? "node--stream"
                      : i.hyp
                        ? "node--grid"
                        : i.kind === "Destinations"
                          ? "node--dest"
                          : "")
                  }
                  style={{ left: x, top: top - 22, width: w, minHeight: 44 }}
                  aria-pressed={selected === i.id}
                  onClick={() => select(i.id)}
                >
                  {i.kind !== "Residue streams" && (
                    <Icon
                      name={
                        i.kind === "Suppliers"
                          ? "factory"
                          : i.hyp
                            ? "flame"
                            : "box"
                      }
                    />
                  )}{" "}
                  {i.id === "farm" ? "Agricultural use" : i.name}
                </button>
              ));
            })}
          </div>
        </div>
      </div>
      <div className="gfoot">
        <div className="legend">
          {[
            "Existing use",
            "Hypothetical connection",
            "Allocated exchange",
          ].map((x, i) => (
            <span className="legend__i" key={x}>
              <i
                className={"edge edge--" + ["hist", "hyp", "alloc"][i]}
                style={{ width: 30 }}
              />
              {x}
            </span>
          ))}
        </div>
        <small>
          Connections describe possible routes. Allocated volumes require a
          solved plan.
        </small>
      </div>
    </div>
  );
}
export function Explorer({ n, cs }: { n: Network; cs: Candidate[] }) {
  const q = useRoute().searchParams,
    g = projection(n, cs),
    sel =
      q.get("entity") ?? g.items.find((i) => i.kind === "Processing")?.id ?? "",
    view = q.get("view") || "network",
    hyp = q.get("hyp") !== "0",
    types = q.get("types")?.split(",").filter(Boolean) || [],
    con = q.get("con") || "all";
  const items = g.items.filter(
    (i) =>
      (hyp || !i.hyp) &&
      (!types.length || types.includes(i.kind)) &&
      (con !== "hyp" || hyp) &&
      (con !== "hyp" ||
        g.lines.some((l) => l.hyp && (l.from === i.id || l.to === i.id))) &&
      (con !== "existing" || !i.hyp),
  );
  const lines = g.lines.filter(
    (l) =>
      items.some((i) => i.id === l.from) &&
      items.some((i) => i.id === l.to) &&
      (con === "all" || (con === "hyp") === l.hyp),
  );
  const selected = [...items, ...lines].find((i) => i.id === sel),
    select = (entity: string) => go({ entity }),
    stages = n.nodes
      .filter((i) => i.labels.includes("Stage"))
      .map((i) => i.properties.id);
  return (
    <>
      <Header
        title="Network explorer"
        sub="Explore existing resource flows and the processing connections that could extend them."
        note="Historical relationships with illustrative planning assumptions. All displayed allocations are annual."
      />
      <div className="tbar">
        <Seg
          label="View"
          value={view}
          set={(v) => go({ view: v })}
          items={[
            ["network", "Network"],
            ["list", "List"],
          ]}
        />
        <details className="menu">
          <summary className="btn btn--secondary btn--sm">
            <Icon name="filter" /> Entity types ▾
          </summary>
          <div className="menu__pop">
            {["Suppliers", "Residue streams", "Processing", "Destinations"].map(
              (t) => (
                <label className="check" key={t}>
                  <input
                    type="checkbox"
                    checked={types.includes(t)}
                    onChange={() =>
                      go({
                        types: (types.includes(t)
                          ? types.filter((x) => x !== t)
                          : [...types, t]
                        ).join(","),
                      })
                    }
                  />
                  {t}
                </label>
              ),
            )}
            <small>None selected shows every type.</small>
          </div>
        </details>
        <details className="menu">
          <summary className="btn btn--secondary btn--sm">
            <Icon name="route" /> Connection types ▾
          </summary>
          <div className="menu__pop">
            {[
              ["all", "All connections"],
              ["existing", "Existing use"],
              ["hyp", "Hypothetical pathway"],
            ].map(([k, v]) => (
              <label className="check" key={k}>
                <input
                  type="radio"
                  checked={con === k}
                  onChange={() => go({ con: k })}
                />
                {v}
              </label>
            ))}
          </div>
        </details>
        <label className="switch">
          <input
            role="switch"
            type="checkbox"
            checked={hyp}
            onChange={() => go({ hyp: hyp ? "0" : "1" })}
          />
          <span className="switch__track" />
          Show hypothetical connections
        </label>
      </div>
      <div className="wk">
        <section className="gpanel">
          {!items.length ? (
            <div className="state">
              <h3>No entities match these filters.</h3>
              <button onClick={() => go({ types: null, con: null, hyp: null })}>
                Clear filters
              </button>
            </div>
          ) : view === "list" ? (
            <div className="panel">
              <Seg
                label="List content"
                items={[
                  ["entities", "Entities"],
                  ["connections", "Connections"],
                ]}
                value={q.get("list") || "entities"}
                set={(v) => go({ list: v })}
              />
              <Table
                cols={["Name", "Type", "Context"]}
                rows={(q.get("list") === "connections" ? lines : items).map(
                  (i) => [
                    <button className="rowbtn" onClick={() => select(i.id)}>
                      {"from" in i ? i.id.replace(":", " → ") : i.name}
                    </button>,
                    i.kind,
                    i.hyp ? "Hypothetical" : "Existing",
                  ],
                )}
              />
            </div>
          ) : (
            <Diagram
              g={{ items, lines }}
              selected={sel}
              select={select}
              stages={stages}
            />
          )}
        </section>
        <aside className="insp">
          <div className="insp__head">
            <div className="col">
              <small>{selected?.kind || "Inspector"}</small>
              <h2 className="insp__h">
                {selected?.kind === "Processing"
                  ? "Proposed processing package"
                  : selected?.name || "Nothing selected"}
              </h2>
              {selected && (
                <span>
                  <Tag kind={selected.hyp ? "hyp" : "exist"}>
                    {selected.hyp ? "Hypothetical" : "Existing"}
                  </Tag>
                </span>
              )}
            </div>
            {selected && (
              <button
                className="btn btn--text"
                aria-label="Close details"
                onClick={() => select("")}
              >
                ×
              </button>
            )}
          </div>
          <div className="insp__body">
            {selected ? (
              <>
                {selected.kind === "Processing" ? (
                  <>
                    <p className="t-table">
                      Adds digestion, gas upgrading and digestate handling
                      between residue suppliers and downstream uses.
                    </p>
                    <Fields
                      items={[
                        ["Connection", "Reachable"],
                        [
                          "Modeled eligibility",
                          cs.some((c) =>
                            c.paths.some((p) => p.eligible_under_assumptions),
                          )
                            ? "Conditional on assumptions"
                            : "Unresolved",
                        ],
                        [
                          "Operational verification",
                          cs.some((c) =>
                            c.paths.some((p) => p.operationally_verified),
                          )
                            ? "Verified"
                            : "Unverified",
                        ],
                      ]}
                    />
                    <table className="otbl">
                      <caption>
                        Observed state is what is known. Planning treatment is
                        what the scenario assumes.
                      </caption>
                      <thead>
                        <tr>
                          <th>Requirement</th>
                          <th>Observed state</th>
                          <th>Planning treatment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cs[0]?.paths[0]?.verdicts
                          .filter((v) => v.status !== "passed")
                          .map((v) => (
                            <tr key={v.rule}>
                              <td>{human(v.rule)}</td>
                              <td>{human(v.value ?? "unknown")}</td>
                              <td className="plan">
                                {v.planning_assumption
                                  ? "Conditional assumption"
                                  : "Unresolved"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    <a
                      className="btn btn--primary"
                      href={href("/opportunities")}
                    >
                      View processing options
                    </a>
                    <Claim id="permit" label="Authorization state" />
                  </>
                ) : (
                  <Fields
                    items={[
                      ["Meaning", selected.name],
                      ["Identifier", selected.id],
                      ["Allocation", "Requires a solved plan"],
                    ]}
                  />
                )}
                <b>Linked evidence</b>
                {[...new Set(selected.facts)].map((id) => (
                  <Claim key={id} id={id} />
                ))}
              </>
            ) : (
              <p>Select an entity or connection to inspect its evidence.</p>
            )}
          </div>
        </aside>
      </div>
      <section className="inset panel">
        <h2 className="t-sec">Discovered opportunities</h2>
        {cs.length ? (
          <>
            <h3>Add digestion, gas upgrading and digestate handling</h3>
            <div className="g3">
              {cs.map((c) => (
                <div className="opt" key={c.id}>
                  <Tag kind="hyp">Hypothetical addition</Tag>
                  <b className="opt__size">
                    {fmt(c.capacity)} <small className="unit">wet t/year</small>
                  </b>
                  <a href={href("/opportunities", { candidate: c.id })}>
                    Inspect opportunity →
                  </a>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>No missing processing option was found.</p>
        )}
      </section>
    </>
  );
}
export { projection };
