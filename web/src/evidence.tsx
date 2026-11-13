import { useEffect, useRef, useState } from "react";
import {
  api,
  Claim,
  prefix,
  type Candidate,
  Fields,
  go,
  Header,
  href,
  human,
  Load,
  Tag,
  useData,
  useRoute,
  type Evidence,
  type Plan,
} from "./core";
const origins = ["network", "opportunities", "comparison", "disruptions"];
function details(id: string) {
  return "/evidence/" + encodeURIComponent(id);
}
function Source({ s }: { s: Record<string, string> }) {
  const link =
    s.url === "docs/evidence-inventory.md"
      ? "/references/evidence-inventory"
      : /^https?:\/\//.test(s.url)
        ? s.url
        : null;
  return link ? (
    <a href={link} target="_blank" rel="noreferrer">
      {s.name} ↗
    </a>
  ) : (
    <span>{s.name}</span>
  );
}
function ClaimFields({ e }: { e: Evidence }) {
  const c = e.claim;
  return (
    <Fields
      items={[
        ["Value", c.value],
        [
          "Classification",
          <span className={"badge prov prov--" + c.classification}>
            {c.classification}
          </span>,
        ],
        ["Unit", c.unit],
        ["Basis", c.basis],
        ["Time basis", c.time_basis],
        ["Effective period", c.effective],
      ]}
    />
  );
}
export function Drawer({ id }: { id: string }) {
  const ref = useRef<HTMLDialogElement>(null),
    r = useData<Evidence>(details(id)),
    q = useRoute();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer-modal"
      aria-label="Evidence drawer"
      onCancel={(e) => {
        e.preventDefault();
        go({ drawer: null });
      }}
    >
      <div className="stack">
        <div className="between">
          <b>Evidence</b>
          <button
            className="btn btn--secondary btn--sm"
            aria-label="Close evidence"
            onClick={() => go({ drawer: null })}
          >
            ×
          </button>
        </div>
        <h2 className="t-sec">{human(id)}</h2>
        {!r.data ? (
          <Load r={r} />
        ) : (
          <>
            <code>{id}</code>
            <ClaimFields e={r.data} />
            <b>Source & location</b>
            {r.data.sources.map(({ source: s }) => (
              <Source key={s.id} s={s} />
            ))}
            <small>{r.data.claim.locator}</small>
            {id === "permit" && (
              <div className="notice notice--cond">
                Recorded authorization: {r.data.claim.value}. Planning
                assumptions are tracked separately.
              </div>
            )}
            <a
              className="btn btn--primary"
              href={href(details(id), {
                drawer: null,
                origin: q.pathname.startsWith("/evidence/")
                  ? q.searchParams.get("origin")
                  : q.pathname.split("/")[1],
              })}
            >
              Open full evidence detail →
            </a>
          </>
        )}
      </div>
    </dialog>
  );
}
export function EvidencePage() {
  const u = useRoute(),
    q = u.searchParams,
    id = decodeURIComponent(u.pathname.split("/")[2] || ""),
    r = useData<Evidence>(id ? details(id) : null),
    e = r.data,
    [copy, setCopy] = useState("Copy identifier"),
    [error, setError] = useState("");
  const candidates = useData<Candidate[]>(prefix + "/candidates");
  const verdict = candidates.data
    ?.flatMap((c) => c.paths.flatMap((p) => p.verdicts))
    .find((v) => v.measurement === id);
  const back = href(
    "/" +
      (origins.includes(q.get("origin") || "") ? q.get("origin") : "network"),
    { drawer: null },
  );
  async function openPlan(pid: string) {
    try {
      const p = await api<Plan>("/plans/" + pid);
      go(
        {
          evaluation: p.evaluation,
          plan: pid,
          scenario: p.scenario,
          candidate: p.candidate,
          agreement: p.assumption_set,
          tab: null,
        },
        p.scenario === "normal" ? "/comparison" : "/disruptions",
      );
    } catch {
      setError("The saved plan could not be opened. Try again.");
    }
  }
  return (
    <>
      <Header title={id ? human(id) : "Evidence"}>
        <div className="between">
          <span className="crumbs">
            {human(q.get("origin") || "network")}　 ›　 Evidence
          </span>
          <a className="btn btn--secondary" href={back}>
            ← Return to {q.get("origin") || "network"}
          </a>
        </div>
        <small>Evidence detail</small>
      </Header>
      {!id ? (
        <div className="inset panel">No claim was specified.</div>
      ) : !e ? (
        <div className="inset">
          <Load r={r} />
        </div>
      ) : (
        <>
          <div className="inset facts">
            Claim identifier <code>{id}</code>
            <button
              className="linkbtn"
              onClick={() =>
                navigator.clipboard.writeText(id).then(
                  () => setCopy("Copied"),
                  () => setCopy("Copy unavailable"),
                )
              }
            >
              {copy}
            </button>
          </div>
          <div className="od">
            <div className="od__main">
              {[
                [
                  "Claim",
                  <>
                    <div className="splitcol">
                      <div>
                        <small>Value</small>
                        <b
                          className={
                            id === "permit"
                              ? "badge auth auth--" + e.claim.value
                              : "vbig"
                          }
                        >
                          {e.claim.value}
                        </b>
                        <small>{e.claim.basis}</small>
                      </div>
                      <div>
                        <small>Classification</small>
                        <span
                          className={
                            "badge prov prov--" + e.claim.classification
                          }
                        >
                          {e.claim.classification}
                        </span>
                        <small>
                          How this input is represented in the illustrative
                          model
                        </small>
                      </div>
                    </div>
                    <Fields
                      items={[
                        ["Physical / contract basis", e.claim.basis],
                        ["Unit", e.claim.unit],
                        ["Time basis", e.claim.time_basis],
                        ["Applies to", e.claim.effective],
                        ["Uncertainty", e.claim.uncertainty],
                      ]}
                    />
                  </>,
                ],
                [
                  "Source & location",
                  <>
                    {e.sources.map(({ source: s }) => (
                      <Source s={s} key={s.id} />
                    ))}
                    <Fields
                      items={[
                        ["Location", e.claim.locator],
                        ["Published", e.claim.publication],
                        ["Accessed", e.claim.access],
                      ]}
                    />
                  </>,
                ],
                [
                  "Scope & applicability",
                  <Fields
                    items={[
                      ["Subject", e.claim.subject],
                      ["Use", e.claim.use],
                      ["Effective period", e.claim.effective],
                      ["Collection", e.claim.collection],
                    ]}
                  />,
                ],
                [
                  "Derivation & uncertainty",
                  <Fields
                    items={[
                      ["Derivation", e.claim.derivation],
                      ["Uncertainty", e.claim.uncertainty],
                      ["Rights", e.claim.rights],
                    ]}
                  />,
                ],
              ].map(([t, body]) => (
                <section className="od__sec" key={String(t)}>
                  <h2 className="t-sec">{t}</h2>
                  {body}
                </section>
              ))}
              <section className="od__sec">
                <h2 className="t-sec">Used by</h2>
                <Tag>Dependent records</Tag>
                <b>Rules ({e.dependent_rules.length})</b>
                {e.dependent_rules.map((v) => (
                  <code key={v.id}>{v.id}</code>
                ))}
                <details>
                  <summary>Saved plans ({e.dependent_plans.length})</summary>
                  {e.dependent_plans.map((v) => (
                    <button
                      className="linkbtn"
                      key={v.id}
                      onClick={() => openPlan(v.id)}
                    >
                      {v.id}
                    </button>
                  ))}
                </details>
                {error && <p role="alert">{error}</p>}
              </section>
            </div>
            <aside className="od__ctx">
              <section className="od__cs">
                <b>How this claim is used</b>
                <Fields
                  items={[
                    [
                      "Requirement",
                      verdict ? human(verdict.rule) : "No linked verdict",
                    ],
                    ["Outcome", verdict?.status ?? "Unavailable"],
                  ]}
                />
                {verdict?.planning_assumption && (
                  <div className="planblock">
                    <small>What-if treatment, separate from the record</small>
                    <p>Named scenario assumption</p>
                    <Claim id={verdict.planning_assumption} />
                  </div>
                )}
                {id === "permit" && (
                  <p>
                    A planning assumption permits a conditional numerical
                    evaluation when its prerequisites hold. Recorded
                    authorization: {e.claim.value}.
                  </p>
                )}
              </section>
              <section className="od__cs">
                <b>Return context</b>
                <p>You came from {q.get("origin") || "the network"}.</p>
                <a className="btn btn--primary" href={back}>
                  Back to analysis
                </a>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
