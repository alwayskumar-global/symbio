import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { components } from "./schema";
type S = components["schemas"];
export type Candidate = S["Candidate"];
export type Eval = S["Evaluation"];
export type Plan = S["Plan"];
export type Evidence = S["Evidence"];
export type Verdict = S["Verdict"];
export type Summary = S["Summary"];
export type NNode = {
  properties: { id: string; name?: string };
  labels: string[];
  evidence_ids: string[];
};
export type Network = Omit<S["Network"], "nodes"> & { nodes: NNode[] };
export const snap = "kalundborg-pre-addition",
  prefix = "/snapshots/" + snap;
export async function api<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api/v1" + path, {
    signal,
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!res.ok)
    throw new Error(
      res.status === 404
        ? "This record is unavailable."
        : `Request failed (HTTP ${res.status}).`,
    );
  return res.json();
}
export function useData<T>(path: string | null) {
  const [tick, setTick] = useState(0),
    [result, set] = useState<{ key: string; data?: T; error?: string }>({
      key: "",
    });
  useEffect(() => {
    if (!path) return;
    const ac = new AbortController();
    set({ key: path });
    api<T>(path, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) set({ key: path, data });
      })
      .catch((e) => {
        if (!ac.signal.aborted) set({ key: path, error: e.message });
      });
    return () => ac.abort();
  }, [path, tick]);
  return {
    ...(result.key === path ? result : {}),
    retry: () => setTick((x) => x + 1),
  };
}
const listen = (f: () => void) => {
  window.addEventListener("hashchange", f);
  return () => window.removeEventListener("hashchange", f);
};
export function route() {
  return new URL(
    location.hash.slice(1).startsWith("/")
      ? location.hash.slice(1)
      : "/network",
    location.origin,
  );
}
export function useRoute() {
  useSyncExternalStore(listen, () => location.hash);
  return route();
}
export type Params = Record<string, string | null>;
export function href(path?: string, changes: Params = {}) {
  const url = route();
  if (path) url.pathname = path;
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  return "#" + url.pathname + url.search;
}
export function go(changes: Params, path?: string) {
  const next = href(path, changes);
  if (location.hash !== next) {
    history.pushState(null, "", next);
    window.dispatchEvent(new Event("hashchange"));
  }
}
export const fmt = (x: number | null | undefined) =>
  x == null
    ? "Unavailable"
    : x.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const human = (s: string) =>
  ({
    permit: "Authorization state",
    "site-a": "Hypothetical site A",
    gro: "NovoGro residue",
    yeast: "Novo Yeast Cream",
    grid: "Gas-grid outlet",
    farm: "Agricultural use",
    protected: "Protected direct delivery",
    transferable: "Transferable nutrient delivery",
  })[s] ??
  s
    .replace(/^rule-| -v1$/g, "")
    .replace(/-v1$/, "")
    .replaceAll("-", " ")
    .replace(/^./, (c) => c.toUpperCase());
export function option(id: string, cs: Candidate[]) {
  const c = cs.find((c) => c.id === id);
  return c ? fmt(c.capacity) + " wet t/year" : human(id);
}
export function Icon({ name }: { name: string }) {
  return <i aria-hidden="true" className={"ic ic-" + name} />;
}
export function Tag({
  children,
  kind = "exist",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return <span className={"tag tag--" + kind}>{children}</span>;
}
export function Header({
  title,
  sub,
  note,
  children,
}: {
  title: string;
  sub?: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <header className="pagehead">
      {children}
      <h1 className="t-page">{title}</h1>
      {sub && <p className="t-sub">{sub}</p>}
      {note && (
        <div className="ctxline">
          <Icon name="info" />
          {note}
        </div>
      )}
    </header>
  );
}
export function Load({
  r,
  label = "Loading",
  children,
}: {
  r: { error?: string; retry: () => void };
  label?: string;
  children?: ReactNode;
}) {
  return (
    <section className="panel state" role={r.error ? "alert" : "status"}>
      <Icon name={r.error ? "alert" : "layers"} />
      <b>{r.error || label}</b>
      {r.error ? (
        <button className="btn btn--secondary" onClick={r.retry}>
          Retry
        </button>
      ) : (
        <div className="skel" style={{ width: "55%", height: 12 }} />
      )}
      {children}
    </section>
  );
}
export function Claim({ id, label }: { id: string; label?: string }) {
  return (
    <button className="linkbtn" onClick={() => go({ drawer: id })}>
      <Icon name="book" />
      {label ?? human(id)}
    </button>
  );
}
export function Fields({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="fl">
      {items.map(([k, v]) => (
        <div key={k} className="fl__r">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Table({ cols, rows }: { cols: string[]; rows: ReactNode[][] }) {
  return (
    <div className="scroll">
      <table className="tbl">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Seg({
  items,
  value,
  set,
  label,
}: {
  items: [string, string][];
  value: string;
  set: (k: string) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([k, v]) => (
        <button key={k} aria-pressed={k === value} onClick={() => set(k)}>
          {v}
        </button>
      ))}
    </div>
  );
}
export function Agreement({
  value,
  set,
}: {
  value: string;
  set: (s: string) => void;
}) {
  return (
    <div className="agree">
      {["transferable", "protected"].map((k) => (
        <label key={k} className={"agree__opt " + (k === value ? "is-on" : "")}>
          <input
            type="radio"
            name="agreement"
            checked={k === value}
            onChange={() => set(k)}
          />
          <span>
            <span className="agree__title">{human(k)}</span>
            <span className="agree__desc">
              {k === "protected"
                ? "Committed residues continue directly to agriculture."
                : "Digestate may fulfil the modeled agricultural commitment."}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
