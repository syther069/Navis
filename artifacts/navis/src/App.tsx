import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SolanaWalletProvider } from "@/components/wallet/solana-wallet-provider";
import { PageDataContext } from "@/lib/page-data";
import { ErrorBoundary, type ErrorFallbackProps } from "@/components/error-boundary";
import WorkspaceError from "@/app/(workspace)/error";
import NotFound from "@/app/(workspace)/not-found";
import { DashboardPage as Home, AtlasPage as Atlas, DecisionPage as Decision } from "@/pages/workspace-pages";
import Agents from "virtual:navis-page/agents";
import NewAgent from "virtual:navis-page/newAgent";
import Agent from "virtual:navis-page/agent";
import Decisions from "virtual:navis-page/decisions";
import DemoDecision from "@/pages/prepared-example";
import Proofs from "virtual:navis-page/proofs";
import Proof from "virtual:navis-page/proof";
import Markets from "virtual:navis-page/markets";
import Transactions from "virtual:navis-page/transactions";
import Settings from "virtual:navis-page/settings";
import Disclosures from "virtual:navis-page/disclosures";

function pageFor(path: string) {
  if (path === "/") return Home;
  if (path === "/agents/atlas") return Atlas;
  if (path === "/agents") return Agents;
  if (path === "/agents/new") return NewAgent;
  if (/^\/agents\/atlas\/decisions\/[^/]+$/.test(path)) return DemoDecision;
  if (/^\/agents\/[^/]+$/.test(path)) return Agent;
  if (path === "/decisions") return Decisions;
  if (/^\/decisions\/[^/]+$/.test(path)) return Decision;
  if (path === "/proofs") return Proofs;
  if (/^\/proofs\/[^/]+$/.test(path)) return Proof;
  if (path === "/markets/launch") return Markets;
  if (path === "/transactions") return Transactions;
  if (path === "/settings") return Settings;
  if (path === "/disclosures") return Disclosures;
  return null;
}
function RouteError({error, resetError}: ErrorFallbackProps) {
  return <WorkspaceError error={error} reset={resetError}/>;
}
export default function App() {
  const [location] = useLocation();
  const search = useSearch();
  const pathname = location.replace(/\/$/, "") || "/";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{data?: any; error?: string; status?: number; path?: string}>({});
  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Workspace", "/agents": "Agents", "/agents/new": "New agent",
      "/agents/atlas": "Atlas", "/decisions": "Decisions", "/proofs": "Proofs",
      "/markets/launch": "Market launch", "/transactions": "Transactions",
      "/settings": "Capabilities", "/disclosures": "Disclosures",
    };
    const title = titles[pathname] ?? (pathname.startsWith("/proofs/") ? "Proof receipt" : pathname.includes("/decisions/") ? "Decision detail" : pathname.startsWith("/agents/") ? "Persistent agent" : "Not found");
    document.title = `${title} · Navis`;
    window.scrollTo({top: 0, left: 0});
  }, [pathname]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("navis:refresh", refresh);
    return () => window.removeEventListener("navis:refresh", refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({data: previous.data}));
    fetch(`/api/workspace?path=${encodeURIComponent(pathname)}`, {
      credentials: "same-origin", signal: controller.signal,
    }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw Object.assign(new Error(body.error ?? `Workspace request failed (${response.status}).`), {status: response.status});
      if (pathname === "/agents/new") {
        const agentsResponse = await fetch("/api/workspace?path=%2Fagents", { credentials: "same-origin", signal: controller.signal });
        const agentsData = await agentsResponse.json();
        if (!agentsResponse.ok) throw new Error(agentsData.error ?? "Unable to load your agents.");
        body.ownedAgents = agentsData.ownedAgents;
      }
      setState({data: body, path: pathname});
    }).catch(error => {
      if (error.name !== "AbortError") setState(previous => ({data: previous.data, error: error.message, status: error.status, path: pathname}));
    });
    return () => controller.abort();
  }, [pathname, revision]);
  const Page = pageFor(pathname);
  const content = !Page || state.status === 404 ? <NotFound/> : state.error ? (
    <section className="route-panel" role="alert"><h1>Unable to open this workspace</h1><p>{state.error}</p><button className="secondary-button" onClick={() => setRevision(value => value + 1)}>Try again</button></section>
  ) : state.path !== pathname ? <section className="route-panel" role="status">Loading workspace…</section>
    : <ErrorBoundary resetKey={pathname + revision} FallbackComponent={RouteError}><PageDataContext.Provider value={state.data}><Page key={pathname + search}/></PageDataContext.Provider></ErrorBoundary>;
  return state.data?.capabilities ? (
    <SolanaWalletProvider cluster={state.data.capabilities.cluster}>
      <WorkspaceShell capabilities={state.data.capabilities}>{content}</WorkspaceShell>
    </SolanaWalletProvider>
  ) : <main className="workspace-main">{content}</main>;
}