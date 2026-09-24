/**
 * Copy for contextual hints. Every statement here restates something the app
 * already asserts elsewhere (policy panel, receipt verifier, assurance
 * model); nothing describes a capability the code does not have.
 */
export type InfoHintEntry = Readonly<{
  title: string;
  what: string;
  why: string;
  next: string;
}>;

export const infoHintContent = {
  runDecision: {
    title: "Running a decision",
    what: "The agent proposes a portfolio move from its mandate and the selected scenario, then every deterministic policy check runs against it.",
    why: "Policy constrains the proposal before execution is considered. A single failed check rejects it; warnings are recorded separately.",
    next: "You get a pass or fail verdict with each check's observed value and limit, plus a receipt you can verify. Nothing is executed by this step.",
  },
  policyVerdict: {
    title: "Policy verdict",
    what: "Each row is one policy rule: the value observed in the proposal and the limit it was compared against.",
    why: "The verdict is deterministic for the same complete inputs, including market facts, portfolio state, evaluation time and policy limits.",
    next: "Passed proposals continue to a receipt. Failed proposals stop here; the receipt records the rejection and nothing is executed.",
  },
  assurance: {
    title: "Assurance level",
    what: "How far the evidence reaches: offchain integrity, wallet authorization, or onchain settlement. The second label states whether the evidence came from a demo simulation or live onchain data.",
    why: "Wallet authorization and onchain settlement require matching evidence. A simulation label or a successful integrity check is not proof of settlement.",
    next: "Read the level before trusting a receipt. Demo and simulated runs stop at offchain integrity by design.",
  },
  verifyReceipt: {
    title: "Verifying a receipt",
    what: "The verifier recomputes the canonical hashes of the stored document and checks that its cross-references agree.",
    why: "A receipt is only useful if a third party can recompute it. The check runs in this browser, not on a server you have to trust.",
    next: "You see which integrity checks passed. Matching hashes show internal consistency, not who authored the document or whether it settled onchain. The policy input hash cannot be independently recomputed from this receipt alone.",
  },
  proofReceipt: {
    title: "What this page checks",
    what: "A proof receipt is the canonical record of one decision: the proposal, the policy checks, the verdict and the hashes that bind them together.",
    why: "The page reports verification of the document's hashes and cross-references. Those checks establish internal consistency, not independent proof of authorship, policy inputs or onchain settlement.",
    next: "Follow the decision and agent links to see the run in context. If verification fails, do not rely on the receipt until the failure is understood.",
  },
  // Workspace surfaces (dashboard, Atlas, decision record).
  atlas: {
    title: "Atlas",
    what: "Atlas is the public demo agent. It reads the selected asset universe and proposes one portfolio action with a written rationale.",
    why: "Atlas only proposes. It cannot approve its own proposal, hold keys or sign anything.",
    next: "Every proposal goes to the deterministic policy checks. The result is recorded with a receipt you can verify.",
  },
  proposal: {
    title: "Proposal",
    what: "The action Atlas suggests: the asset to sell, the asset to buy, the exact amount in base units and the maximum slippage.",
    why: "A proposal is a suggestion with an expiry. It moves nothing on its own.",
    next: "Policy approves or rejects it. Value could only move after a wallet signs a transaction, which this demo never requests.",
  },
  risk: {
    title: "Risk limits",
    what: "The agent's recorded risk policy: trade size, position size, reserve floor, slippage, turnover, data age, liquidity and allowed modes.",
    why: "These limits are fixed before the proposal is made, so Atlas cannot widen them to fit a trade.",
    next: "Each limit is compared with the proposal in the policy section. One failed limit blocks the decision.",
  },
  simulation: {
    title: "Simulation",
    what: "A simulated execution records what would be attempted if the proposal passed. No transaction is built, signed or sent.",
    why: "Simulation lets you inspect the full decision chain without moving value. It is never evidence of settlement.",
    next: "The receipt is labelled Demo simulation and stops at offchain integrity. It never receives an explorer link.",
  },
  walletApproval: {
    title: "Your approval",
    what: "Wallet approval is your signature on a specific transaction. It is separate from policy approval.",
    why: "Policy approval only means the proposal fits the limits. Nothing moves value until your connected wallet signs.",
    next: "Demo decisions never request a signature. When a live path exists, the wallet prompt is the step where you approve or decline.",
  },
  lifecycle: {
    title: "Decision status",
    what: "Proposed, Approved, Signing, Submitted, Confirmed, Failed or Blocked, derived only from recorded facts.",
    why: "Approved means policy approved, not wallet approved. Confirmed requires a recorded transaction signature; without one a record stays at Submitted and is marked unproven. List rows show the recorded state; the full record holds the evidence.",
    next: "A simulated decision stays at Approved with a simulation label. It never shows Submitted or Confirmed.",
  },
  marketInputs: {
    title: "Market inputs",
    what: "The assets and price observations the run was evaluated against, with their source and read time.",
    why: "The policy verdict is only as good as the facts it used. Research prices are not execution quotes.",
    next: "Fixture universes use fictional demo prices and are labelled as such. PreStocks reads are dated to the moment of the run.",
  },
  context: {
    title: "Integration status",
    what: "Which services this instance has configured, and what the execution mode flags allow, as reported by the server's public capabilities.",
    why: "Configured is not connected: these flags do not prove a service is reachable or healthy. Execution stays off unless the mode enables it.",
    next: "Open Settings for the full capability list and Disclosures for what each state means.",
  },
} as const satisfies Record<string, InfoHintEntry>;

export type InfoHintKey = keyof typeof infoHintContent;
