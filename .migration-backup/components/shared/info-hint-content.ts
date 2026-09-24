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
} as const satisfies Record<string, InfoHintEntry>;

export type InfoHintKey = keyof typeof infoHintContent;
