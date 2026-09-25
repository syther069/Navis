"use client";

import { useState } from "react";
import {
  CaretDown,
  CheckCircle,
  MagnifyingGlass,
  Question,
  ShieldWarning,
} from "@phosphor-icons/react";
import Link from "next/link";

export type FaqItem = {
  id: string;
  category: "core" | "security" | "integrations" | "evidence";
  question: string;
  answer: string;
  constraintNote?: string;
  link?: { href: string; label: string };
};

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "what-is-navis",
    category: "core",
    question: "What is NAVIS?",
    answer:
      "NAVIS is a financial operations and risk governance terminal for autonomous equity agents on Solana. It acts as a deterministic boundary between AI agent proposals and onchain transactions. Agents propose actions based on an investment mandate; NAVIS enforces mathematical risk constraints; and users retain sole signing authority in their own wallets.",
    link: { href: "/agents/atlas", label: "Inspect Atlas Agent" },
  },
  {
    id: "why-does-it-exist",
    category: "core",
    question: "Why does NAVIS exist, and why not let AI trade directly?",
    answer:
      "Granting AI agents direct access to private keys or unconstrained financial authority leads to catastrophic failure modes: LLMs hallucinate non-existent tokens, miscalculate slippage, suffer prompt injection, or overconcentrate capital. NAVIS exists to ensure that AI is restricted to an advisory, proposal role. All execution invariants are enforced by deterministic, non-AI code before any transaction is built.",
    constraintNote: "NAVIS code is strictly deterministic. The AI model has zero access to private keys or execution hooks.",
  },
  {
    id: "how-does-it-work",
    category: "core",
    question: "How does the core workflow operate?",
    answer:
      "The workflow follows an 8-step pipeline: (1) Market Data captures slot heights and asset prices; (2) Atlas evaluates the mandate and formulates a proposal; (3) Policy / Risk runs 10 deterministic mathematical checks; (4) Proposal serializes the order into typed base units; (5) User Approval provides human review; (6) Wallet Signature authorizes the transaction via ed25519; (7) Onchain Action broadcasts to Solana RPC; and (8) Proof creates a canonical SHA-256 verifiable receipt.",
    link: { href: "/decisions", label: "View Decisions Ledger" },
  },
  {
    id: "what-does-atlas-do",
    category: "core",
    question: "What does Atlas do?",
    answer:
      "Atlas is NAVIS's reference portfolio management agent. It observes an approved universe of tokenized equities, monitors portfolio balance weights, and computes rebalance proposals according to an investment thesis. Crucially, Atlas cannot execute trades, cannot modify risk rules, and has zero signing authority.",
    link: { href: "/agents/atlas", label: "Review Atlas Mandate" },
  },
  {
    id: "what-does-user-control",
    category: "security",
    question: "What does the user control?",
    answer:
      "You control 100% of capital authorization and policy parameters. You connect your own Solana wallet, define the risk constraints (maximum single trade size, position caps, minimum SOL reserve, slippage ceilings), decide whether to approve or reject proposals, and sign transactions locally in your browser. NAVIS never holds your keys.",
    constraintNote: "No funds can leave your wallet without an explicit ed25519 signature from your browser wallet extension.",
  },
  {
    id: "autonomous-signing",
    category: "security",
    question: "Can Atlas execute trades without my wallet signature?",
    answer:
      "No. Never. NAVIS holds zero private keys. The agent cannot sign, transfer, or move funds unilaterally. Every execution requires user authorization in a connected wallet extension (Phantom, Solflare, etc.). In demo mode, executions halt at simulation by design.",
  },
  {
    id: "ai-hallucination",
    category: "security",
    question: "What happens if the AI agent hallucinates or makes a bad proposal?",
    answer:
      "The deterministic policy engine intercepts the proposal before any Solana transaction can be constructed. If the proposal attempts to trade an unapproved token, exceeds the 10% single-trade cap, breaches the 35% position limit, or exceeds 75 bps slippage, the evaluation fails immediately. The decision is recorded as BLOCKED, and execution halts.",
    link: { href: "/agents/atlas#risk", label: "Inspect 10 Policy Rules" },
  },
  {
    id: "real-integrations",
    category: "integrations",
    question: "What integrations are real versus simulated or planned?",
    answer:
      "Every integration is labeled according to its actual current state: Solana Wallet Standard and the Cryptographic Proof Verifier are LIVE; PreStocks is READ-ONLY for equity catalogue data; ClawPump Partner API is CONNECTED for agent discovery; Meteora DBC SDK is PREPARATION ONLY for quotes and pool configuration; Solana RPC is DEVNET operational; Atlas AI is SIMULATION (deterministic demo fixture) / CONNECTED (OpenAI); and Pyth Network Oracles are PLANNED for future onchain feeds.",
    constraintNote: "We never misrepresent planned integrations as live. A PREPARATION ONLY integration builds transaction bytes but does not broadcast.",
  },
  {
    id: "current-availability",
    category: "integrations",
    question: "What is currently available today?",
    answer:
      "Demo simulation mode is 100% operational with deterministic offchain integrity proofs and full UI walkthrough. Devnet execution is operational when an RPC and wallet are connected. Mainnet execution is intentionally gated behind an internal safety checklist and release approval flag.",
    link: { href: "/settings", label: "Check System Capabilities" },
  },
  {
    id: "assurance-levels",
    category: "evidence",
    question: "What do the three assurance levels mean?",
    answer:
      "Offchain integrity: Canonical SHA-256 hashes verify internal consistency; no wallet signed anything and no transaction exists (demo simulation). Wallet authorization: A connected wallet signed and a transaction payload was prepared or broadcast, but onchain settlement is pending or not yet proven. Onchain settlement: A signed transaction was finalized on Solana and confirmed with an immutable transaction signature and block slot.",
    link: { href: "/proofs", label: "Explore Proofs" },
  },
  {
    id: "proof-verification",
    category: "evidence",
    question: "How does the in-browser proof verification work?",
    answer:
      "The verifier runs open-source SHA-256 hashing directly in your browser. It parses the canonical JSON document, recomputes the hash of the portfolio snapshot, proposal, policy results, and overall receipt, and asserts that all cross-references match without making network calls to a centralized authority.",
    link: { href: "/proofs/demo-proof", label: "Test Proof Verifier" },
  },
  {
    id: "custody",
    category: "security",
    question: "Does NAVIS take custody of my funds or tokens?",
    answer:
      "No. NAVIS is 100% non-custodial. Your funds remain in your own Solana wallet or designated treasury account. NAVIS never holds custodial keys, intermediary contracts, or escrow pools.",
  },
] as const;

export function FaqSection({ defaultFilter = "all" }: { defaultFilter?: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultFilter);
  const [expandedId, setExpandedId] = useState<string | null>("what-is-navis");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredItems = FAQ_ITEMS.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="faq-section-container" id="faq" aria-label="Frequently Asked Questions">
      {/* ── FAQ Search & Filter Toolbar ── */}
      <div className="faq-toolbar">
        <div className="faq-search-box">
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search questions or operational boundaries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="faq-search-input"
            aria-label="Search FAQ"
          />
        </div>

        <div className="faq-category-pills" role="tablist" aria-label="FAQ categories">
          {[
            { id: "all", label: "All Questions" },
            { id: "core", label: "Core Architecture" },
            { id: "security", label: "Safety & Control" },
            { id: "integrations", label: "Integrations & Status" },
            { id: "evidence", label: "Proof & Verification" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
              className={`faq-cat-btn ${selectedCategory === cat.id ? "faq-cat-active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FAQ Accordion List ── */}
      <div className="faq-accordion-list" role="region" aria-label="FAQ items">
        {filteredItems.length === 0 ? (
          <div className="faq-empty-state">
            <p>No questions matched your search query.</p>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <article
                key={item.id}
                className={`faq-item ${isExpanded ? "faq-item-expanded" : ""}`}
              >
                <button
                  type="button"
                  className="faq-trigger"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`faq-answer-${item.id}`}
                >
                  <span className="faq-question-text">{item.question}</span>
                  <CaretDown
                    className={`faq-caret ${isExpanded ? "faq-caret-rotated" : ""}`}
                    size={16}
                    aria-hidden="true"
                  />
                </button>

                {isExpanded && (
                  <div
                    id={`faq-answer-${item.id}`}
                    className="faq-answer-panel"
                    role="region"
                    aria-labelledby={`faq-question-${item.id}`}
                  >
                    <p className="faq-answer-text">{item.answer}</p>

                    {item.constraintNote ? (
                      <div className="faq-constraint-box">
                        <ShieldWarning size={15} weight="bold" />
                        <div>
                          <strong>Operational Constraint:</strong> {item.constraintNote}
                        </div>
                      </div>
                    ) : null}

                    {item.link ? (
                      <div className="faq-answer-link">
                        <Link className="text-link" href={item.link.href}>
                          {item.link.label} &rarr;
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
