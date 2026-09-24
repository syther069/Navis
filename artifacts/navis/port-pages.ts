/**
 * Convert the preserved server-page presentation into browser-only modules.
 * Data access is deliberately removed before Vite resolves imports. All page
 * inputs come from the authenticated workspace endpoint, never server env.
 */
import fs from "node:fs";
import path from "node:path";
import { transformWithEsbuild, type Plugin } from "vite";

const pages: Record<string, string> = {
  home: "(workspace)/page.tsx",
  atlas: "(workspace)/agents/atlas/page.tsx",
  agents: "(workspace)/agents/page.tsx",
  newAgent: "(workspace)/agents/new/page.tsx",
  agent: "(workspace)/agents/[slug]/page.tsx",
  decisions: "(workspace)/decisions/page.tsx",
  proofs: "(workspace)/proofs/page.tsx",
  settings: "(workspace)/settings/page.tsx",
  transactions: "(workspace)/transactions/page.tsx",
  markets: "(workspace)/markets/launch/page.tsx",
  disclosures: "(workspace)/disclosures/page.tsx",
  decision: "(decision-detail)/decisions/[decisionId]/page.tsx",
  proof: "(decision-detail)/proofs/[proofId]/page.tsx",
  demoDecision: "(workspace)/agents/atlas/decisions/[decisionId]/page.tsx",
};
function between(source: string, start: string, end: string, replacement = "") {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Page migration marker missing: ${start} / ${end}`);
  return source.slice(0, a) + replacement + source.slice(b);
}
export function portPages(): Plugin {
  return {
    name: "navis-browser-pages",
    resolveId(id) {
      if (id.startsWith("virtual:navis-page/")) return "\0" + id;
    },
    async load(id) {
      if (!id.startsWith("\0virtual:navis-page/")) return;
      const key = id.split("/").at(-1)!;
      const filename = path.resolve(import.meta.dirname, "src/app", pages[key]);
      this.addWatchFile(filename);
      let s = fs.readFileSync(filename, "utf8");
      // No original server module is ever part of the browser module graph.
      s = s.replace(/import[\s\S]*?from\s+["']([^"']+)["'];/g, (statement, module) => {
        if (module === "next" || module === "next/headers" || module === "drizzle-orm" ||
          /^@\/lib\/(auth|db|env$|services)/.test(module) ||
          /@\/lib\/integrations\/(clawpump\/(server|pairs)|meteora\/(config|broadcast-safety)|prestocks\/client)/.test(module)) return "";
        return statement;
      });
      s = s.replace(/export const metadata[\s\S]*?;\n/g, "").replace(/export const dynamic[^\n]*\n/g, "");
      const intro = 'const data = usePageData(); const {capabilities, session} = data; const env = { databaseUrl: capabilities.persistenceConfigured, clawpumpApiKey: capabilities.clawpumpConfigured, cluster: capabilities.cluster, executionMode: capabilities.mode };';
      if (key === "home" || key === "atlas") {
        s = s.replace("getPublicCapabilities()", "usePageData().capabilities");
      } else if (["agents", "decisions", "proofs", "newAgent"].includes(key)) {
        s = s.replace("export default async function", "export default function");
        const start = key === "newAgent" ? "  const capabilities =" : "  const token =";
        const end = key === "agents" ? "  const ownerNote" : key === "newAgent" ? "  return (" : "  const publicCount";
        const values = key === "agents" ? "const {ownedAgents} = data;" : key === "newAgent" ? "const ownedAgents = data.ownedAgents ?? []; const canPersist = Boolean(session) && capabilities.persistenceConfigured && capabilities.walletAuthenticationConfigured;" : "const {stored} = data;";
        s = between(s, start, end, intro + values + "\n");
      } else if (key === "settings") {
        s = between(s, "async function describeClawPump", "  return (\n    <>", "export default function SettingsPage() {\n" + intro + "const clawpump = describeClawPump(data.clawpump);\n");
      } else if (key === "agent") {
        s = between(s, "export default async function", "  return (\n    <>", "export default function PersistentAgentPage() {\n" + intro + "const {bundle, storedDecisions, clawpumpIdentity} = data;\n");
      } else if (key === "decision") {
        s = between(s, "async function resolveDecisionRun", "  return (", "export default function DecisionDetailPage() {\n" + intro + "const {run} = data; const decisionId = run.decision?.id ?? window.location.pathname.split('/').pop()!;\n");
      } else if (key === "proof") {
        s = between(s, "async function loadStoredProof", "  if (proofId === demoProof.id)", "export default function ProofDetailPage() {\n" + intro + "const proofId = window.location.pathname.split('/').pop();\n");
        s = s.replace("const stored = await loadStoredProof(proofId);", "const {stored} = data;");
      } else if (key === "transactions") {
        s = s.replace("}).format(value)", "}).format(new Date(value))");
        s = between(s, "async function loadExecutionRows", "function toneForExecution");
        s = between(s, "export default async function TransactionsPage", "  const filteredExecutions", "export default function TransactionsPage() {\n" + intro + "const {executions, launches} = data; const filter = resolveFilter(new URLSearchParams(window.location.search).get('state') ?? undefined);\n");
      } else if (key === "markets") {
        s = between(s, "/** Reuse a stored verification", "const CLAWPUMP_NOT_CONFIGURED");
        s = between(s, "async function ClawPumpSection", "  if (!clawpump.configured)", "function ClawPumpSection(_: any) {\nconst {clawpump, launchContext} = usePageData();\n");
        s = between(s, "async function MeteoraSection", "  if (previews.length", "function MeteoraSection(_: any) {\n" + intro + "const {previews, prestocks, launchContext, profiles, broadcastAvailable, broadcastBlockedReason} = data;\n");
        s = between(s, "  const [prestocks, launchContext] = await", "  const prestocksSymbols");
        s = between(s, "  const executionEnabled =", "  return (", "  const executionEnabled = capabilities.devnetExecutionAvailable || capabilities.mainnetExecutionAvailable;\n");
        s = s.replace("listMeteoraQuoteProfileAvailability(env.cluster)", "profiles").replace("Boolean(env.solanaRpcUrl)", "capabilities.meteoraConfigured");
        s = s.replace("isMeteoraBroadcastAvailable(broadcastCapability)", "broadcastAvailable").replace("meteoraBroadcastUnavailableReason(broadcastCapability)", "broadcastBlockedReason");
        s = s.replace("async function PreStocksSection", "function PreStocksSection").replace("const prestocks = await prestocksPromise;", "const {prestocks} = usePageData();");
        s = between(s, "  const clawpumpPromise = loadClawPump();", "  return (", intro + "const clawpumpPromise = null; const prestocksPromise = null; const contextPromise = null;\n");
      } else if (key === "demoDecision") {
        s = between(s, "export default async function", "  if (decisionId", "export default function DemoDecisionPage() {\n const decisionId = window.location.pathname.split('/').pop();\n");
      }
      s = 'import { usePageData } from "@/lib/page-data";\nimport { describeClawPump, summarizeMeteoraLaunchEvidence } from "@/lib/page-presentation";\n' + s;
      return (await transformWithEsbuild(s, filename, { loader: "tsx", jsx: "automatic" })).code;
    },
  };
}