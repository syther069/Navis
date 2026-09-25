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
  navDecisions: {
    title: "Decisions ledger",
    what: "Automated trade or rebalance proposals evaluated against hard risk policies.",
    why: "Policy checks precede every execution. Proposals cannot move funds without passing deterministic boundaries.",
    next: "Inspect individual decisions to review the observed inputs, policy thresholds, and verified receipts.",
  },
  navMarkets: {
    title: "Markets & launch",
    what: "Liquidity discovery and dynamic bonding curve profiles for equity-backed tokens.",
    why: "Connects agent portfolios to governed pools while keeping PreStocks catalogues read-only.",
    next: "Review pair configurations, run preflight checks, or track onchain bonding curve progress.",
  },
  navProofs: {
    title: "Proof receipts",
    what: "Locally recomputable cryptographic evidence binding intent, policies, and outcomes.",
    why: "Proves execution compliance deterministically without relying on trust in offchain reporting.",
    next: "Verify document hashes, review state transitions, or audit timeline integrity.",
  },
  atlas: {
    title: "Atlas agent",
    what: "Atlas is the reference NAVIS portfolio agent. It monitors tokenized asset allocations against an investment mandate and formulates trade proposals.",
    why: "Autonomous agents have zero signing or execution authority. Atlas can only propose trades; it cannot move funds on its own.",
    next: "Every Atlas proposal must pass deterministic policy checks and be explicitly signed in your wallet before execution.",
  },
  policy: {
    title: "Deterministic policy",
    what: "A deterministic set of immutable mathematical risk rules evaluated against every proposal before any transaction can be prepared.",
    why: "Policy enforces non-negotiable boundaries (position caps, slippage limits, reserve floors). If a single rule fails, the proposal is immediately blocked.",
    next: "Inspect observed values against limit thresholds. Only proposals clearing all policy checks can proceed to user authorization.",
  },
  risk: {
    title: "Risk boundaries",
    what: "Hard risk constraints that protect portfolio solvency, including maximum single-trade size, position concentration, minimum SOL reserve, and maximum slippage.",
    why: "Risk checks prevent catastrophic losses, oracle latency attacks, and rogue agent behavior before funds are ever touched.",
    next: "When market conditions or trade parameters exceed risk boundaries, the evaluation halts and execution is blocked.",
  },
  proposal: {
    title: "Trade proposal",
    what: "A structured trade order generated by an agent detailing input and output mints, amounts, slippage tolerance, and execution thesis.",
    why: "Proposals represent intent rather than execution. They isolate the agent's analytical decision from financial settlement.",
    next: "Review the proposal details, thesis, and confidence score. Approved proposals require your wallet signature to execute.",
  },
  simulation: {
    title: "Transaction simulation",
    what: "An offchain dry-run that models execution outcome, balance deltas, and state transitions without submitting onchain or spending gas.",
    why: "Simulation verifies whether the transaction would succeed or revert, catching unexpected slippage or liquidity shortfalls safely.",
    next: "In demo mode, execution stops at simulation. In live mode, successful simulation confirms the transaction is safe to sign.",
  },
  approval: {
    title: "User approval",
    what: "The non-custodial authorization step where you explicitly review and sign the policy-cleared transaction in your connected wallet.",
    why: "The wallet is the sole execution authority. NAVIS never holds private keys, and agents cannot sign transactions on your behalf.",
    next: "Approve the transaction in your wallet extension to sign and broadcast to Solana, or reject it to cancel.",
  },
  proof: {
    title: "Proof receipt",
    what: "A tamper-evident cryptographic document capturing the snapshot, proposal, policy verdict, and execution outcome bound by SHA-256 hashes.",
    why: "Provides independent verifiable accountability. Anyone can recompute document hashes locally in their browser without trusting NAVIS servers.",
    next: "Open the receipt in the verifier or inspect the canonical hash chain to audit decision integrity.",
  },
  broadcast: {
    title: "Onchain broadcast gate",
    what: "Broadcast is the final transmission of a signed transaction to the Solana validator cluster for inclusion in a slot.",
    why: "Broadcasting creates immutable onchain ledger state. In this environment, Meteora broadcasting is intentionally disabled at code level for capital safety.",
    next: "Transaction preparation, simulation, and wallet approval may be exercised, but the transaction payload cannot be broadcast.",
  },
  signing: {
    title: "Cryptographic wallet signature",
    what: "Your connected Solana wallet signs the transaction message with its private key using Ed25519 cryptography.",
    why: "NAVIS is strictly non-custodial. Private keys never touch NAVIS servers, and autonomous agents have zero signing capability.",
    next: "Review the exact instruction accounts and fees in your wallet extension before approving the signature.",
  },
  preflight: {
    title: "Launch preflight checks",
    what: "Preflight performs dependency audits, mint account inspections, and provider quote calculations before transaction assembly.",
    why: "Catches missing mint accounts, unlinked agents, or incompatible token programs before funds are committed.",
    next: "If all preflight checks pass, an exact quote and parameters are locked for transaction preparation.",
  },
  providerState: {
    title: "Provider integration state",
    what: "The real-time status of external API connectivity, partner credentials, and downstream liquidity providers.",
    why: "NAVIS reports only verified HTTP 200 responses from upstream APIs, never assuming connectivity or optimistic health.",
    next: "If a provider is unconfigured or unreachable, related launch and discovery actions remain safely disabled.",
  },
  transactionLifecycle: {
    title: "9-stage transaction lifecycle",
    what: "Transactions progress through 9 distinct states: Preparing → Simulation → Awaiting Wallet → Signing → Submitted → Confirming → Confirmed (or Failed / Blocked).",
    why: "Financial transactions require total lifecycle transparency to distinguish simulated results from confirmed onchain settlement.",
    next: "Track the active stage indicator on each transaction ledger entry for an exact audit trail.",
  },
  verifiableRecord: {
    title: "Verifiable financial record",
    what: "A structured, self-contained record documenting What, Who, Why, Policy, When, Network, Transaction, and Result.",
    why: "Separates verifiable facts from trust in application state. Technical metadata and hashes can be audited on demand.",
    next: "Expand the technical metadata section to inspect canonical hashes or run local client-side verification.",
  },
  meteoraDbc: {
    title: "Meteora Dynamic Bonding Curve",
    what: "A 6-step lifecycle (Configuration → Preparation → Simulation → Approval → Broadcast → Confirmation) for DBC liquidity pool deployment.",
    why: "Ensures curve mathematics, quote token profiles, and migration thresholds are fully validated before initialization.",
    next: "In this environment, broadcasting is disabled: simulation is the terminal state and no pool is created onchain.",
  },
  marketData: {
    title: "Market data & pricing",
    what: "Scannable market overview showing real token prices, mark valuations, premiums/discounts, and token standards.",
    why: "PreStocks assets provide economic exposure only and are presented read-only. Data reflects catalogue snapshots, not live execution quotes.",
    next: "Inspect individual asset metrics, review risk eligibility tags, or launch a governed liquidity pair.",
  },
  atlasSignal: {
    title: "Atlas agent signal",
    what: "Directional proposal (BUY, SELL, REBALANCE) formulated by Atlas against its mandate and the asset universe.",
    why: "Atlas signals only appear when an active, verifiable proposal actually exists for that asset. They are never fabricated.",
    next: "Review the full decision record to inspect the agent's quantitative thesis and deterministic policy checks.",
  },
} as const satisfies Record<string, InfoHintEntry>;

export type InfoHintKey = keyof typeof infoHintContent;
