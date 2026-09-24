export const questions = [
  {
    question: "What is NAVIS?",
    answer:
      "NAVIS is a governed Solana equity-agent workspace. It presents agent proposals, evaluates deterministic policy rules and records hash-verifiable receipts. It is not a brokerage or a place to buy legal shares.",
  },
  {
    question: "What does Atlas do?",
    answer:
      "Atlas is the public demo agent. It makes fresh Balanced and Oversized proposals using a validated PreStocks catalogue, or a clearly identified fixture fallback. Policy evaluates those proposals; Atlas never signs or submits a transaction.",
  },
  {
    question: "Does the demo move funds?",
    answer:
      "No. Atlas decisions and their receipts are simulations. A passing verdict in the demo is not a trade, a wallet signature or evidence of settlement.",
  },
  {
    question: "Can NAVIS execute on Solana mainnet?",
    answer:
      "No. Mainnet execution is blocked in code. A configuration flag cannot release the mainnet broadcast hard-stop.",
  },
  {
    question: "What is available on devnet?",
    answer:
      "Meteora DBC has configuration previews, pool reads, transaction preparation and simulation, and a gated devnet submit/confirm code path. Broadcast requires the deployment's devnet gate, RPC, an authenticated funded wallet and successful checks. No confirmed pool, configuration or signature is evidenced yet.",
  },
  {
    question: "Who approves an action?",
    answer:
      "The user does. Policy must pass first. Any value-moving devnet transaction still needs explicit review and signature in the connected wallet; rejecting in the wallet stops it. Atlas cannot authorize it.",
  },
  {
    question: "Does NAVIS hold my assets or act as a brokerage?",
    answer:
      "No. NAVIS is non-custodial: it does not hold your private keys or sign on your behalf. It is a decision and evidence workspace, not a brokerage.",
  },
  {
    question: "Are PreStocks tokens company shares?",
    answer:
      "No. PreStocks tokens provide economic exposure, not legal ownership of the underlying company's shares. NAVIS uses PreStocks data for read-only research and the Atlas universe, not trading.",
  },
  {
    question: "Is market information an execution quote?",
    answer:
      "No. PreStocks catalogue and research data are read-only. The timestamp reflects NAVIS's read time; it does not guarantee upstream freshness or an executable price.",
  },
  {
    question: "Are proof receipts onchain?",
    answer:
      "No. Today receipts are offchain documents whose hashes and cross-references can be verified in your browser. Matching hashes show internal consistency, not authorship or onchain settlement. Receipt anchoring is not implemented.",
  },
  {
    question: "Can I launch through ClawPump?",
    answer:
      "No. Provider verification, pair discovery and preflight checks exist, but a funded ClawPump launch is unsupported and blocked.",
  },
  {
    question: "Is the AI provider live?",
    answer:
      "The public production posture uses a deterministic demo provider. An OpenAI-compatible provider can be configured with credentials and a model, but that is not evidence of live public AI execution.",
  },
  {
    question: "Do I need a wallet to explore?",
    answer:
      "No. You can inspect the workspace, run the Atlas demo and verify the demo receipt without connecting a wallet. A compatible browser wallet is optional for orientation and required to authorize any eligible value-moving action.",
  },
] as const;
