import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans/index.css";
import "@fontsource/dm-mono/latin-400.css";
import "@fontsource/dm-mono/latin-500.css";
import "./design.css";
import "./app.css";
import {
  href,
  Icon,
  Load,
  prefix,
  useData,
  useRoute,
  type Candidate,
  type Network,
} from "./core";
import { Explorer } from "./network";
import { Opportunity } from "./opportunity";
import { Analysis } from "./results";
import { EvidencePage, Drawer } from "./evidence";
function App() {
  const url = useRoute(),
    page = url.pathname.split("/")[1] || "network",
    drawer = url.searchParams.get("drawer");
  const n = useData<Network>(prefix + "/network"),
    cs = useData<Candidate[]>(prefix + "/candidates");
  const previous = useRef(url.pathname);
  useEffect(() => {
    if (previous.current !== url.pathname) {
      previous.current = url.pathname;
      window.scrollTo(0, 0);
      document
        .querySelector<HTMLElement>("main")
        ?.focus({ preventScroll: true });
    }
    document.title =
      (page === "opportunities"
        ? "Opportunity detail"
        : page === "evidence"
          ? "Evidence detail"
          : page === "network"
            ? "Network explorer"
            : page === "disruptions"
              ? "Disruption analysis"
              : "Comparison") + " · Symbio";
  }, [url.pathname, page]);
  const choices = cs.data?.slice().sort((a, b) => a.capacity - b.capacity);
  return (
    <div className="sb shell xshell">
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector<HTMLElement>("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <nav className="nav" aria-label="Primary">
        <div className="nav__brand">
          <b className="wordmark">Symbio</b>
        </div>
        {[
          ["network", "Network", "network"],
          ["opportunities", "Opportunities", "route"],
          ["comparison", "Comparison", "chart"],
          ["disruptions", "Disruptions", "alert"],
        ].map(([p, t, i]) => (
          <a
            key={p}
            className="nav__i"
            href={href("/" + p, { drawer: null })}
            aria-current={
              (page === "evidence" ? url.searchParams.get("origin") : page) ===
              p
                ? "page"
                : undefined
            }
          >
            <Icon name={i} />
            {t}
          </a>
        ))}
      </nav>
      <div className="workspace">
        <header className="topbar">
          <span className="t-label">Case</span>
          <b>Kalundborg</b>
          <span className="tag tag--exist">Illustrative reconstruction</span>
        </header>
        <main id="main" tabIndex={-1}>
          {page === "evidence" ? (
            <EvidencePage />
          ) : !choices ? (
            <Load r={cs} label="Discovering processing options" />
          ) : page === "opportunities" ? (
            <Opportunity cs={choices} />
          ) : page === "comparison" || page === "disruptions" ? (
            <Analysis key={page} cs={choices} stress={page === "disruptions"} />
          ) : page !== "network" ? (
            <section className="panel">
              Page unavailable. <a href="#/network">Return to network</a>
            </section>
          ) : !n.data ? (
            <Load r={n} label="Loading network" />
          ) : (
            <Explorer n={n.data} cs={choices} />
          )}
        </main>
      </div>
      {drawer && <Drawer id={drawer} />}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
