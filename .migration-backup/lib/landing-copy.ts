/** First-screen copy shared by the landing page, its test and the judge smoke. */
export const LANDING_SENTENCE =
  "Navis lets an AI equity agent propose Solana actions, but only deterministic policy checks and wallet approval can turn those proposals into verifiable receipts.";

export const LANDING_PROOF_POINTS = [
  {
    id: "policy",
    title: "The agent cannot bypass policy",
    body: "Every proposal passes through deterministic risk checks in Navis code. A single failed check rejects it and nothing is executed.",
  },
  {
    id: "labels",
    title: "Demo and live evidence are labelled differently",
    body: "Each receipt and ledger row carries an assurance badge: offchain integrity, wallet authorization or onchain settlement, plus a demo simulation or live onchain label.",
  },
  {
    id: "wallet",
    title: "Wallet approval remains required for value movement",
    body: "Navis never holds private keys. Nothing moves value until a connected wallet signs, and simulations never receive explorer links.",
  },
] as const;
