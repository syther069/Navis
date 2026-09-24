import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ExecutionLedgerRow,
  LaunchLedgerRow,
  type ExecutionLedgerRecord,
  type LaunchLedgerRecord,
} from "../components/transactions/ledger-row";
import { transactionStateForRecord } from "../components/transactions/transaction-presentation";

describe("recorded transaction states", () => {
  it("maps every persisted execution state without promoting unsigned attempts", () => {
    expect(
      Object.entries({
        created: "preparing",
        simulated: "simulation",
        awaiting_signature: "awaiting_wallet",
        submitted: "submitted",
        confirmed: "confirmed",
        failed: "failed",
        rejected: "blocked",
        cancelled: "blocked",
      }).map(
        ([status, state]) => transactionStateForRecord("execution", status) === state,
      ),
    ).toEqual(Array(8).fill(true));
  });

  it("leaves an unknown broadcast outcome unmapped instead of claiming network evidence", () => {
    expect(transactionStateForRecord("execution", "unknown_pending")).toBeNull();
    expect(transactionStateForRecord("launch", "unknown_pending")).toBeNull();
    expect(transactionStateForRecord("launch", "pool_unknown_pending")).toBeNull();
  });

  it("distinguishes signed-before-broadcast from submitted and refuses unknown statuses", () => {
    expect(transactionStateForRecord("launch", "submitting")).toBe("signing");
    expect(transactionStateForRecord("launch", "pool_submitted")).toBe("submitted");
    expect(transactionStateForRecord("launch", "pool_signature_confirmed")).toBe(
      "confirming",
    );
    expect(transactionStateForRecord("launch", "prepared")).toBe("preparing");
    expect(transactionStateForRecord("launch", "expired")).toBeNull();
    expect(transactionStateForRecord("launch", "provider_unrecognised")).toBeNull();
  });
});

describe("ledger records", () => {
  it("renders a populated execution from persisted schema fields, with technical data behind disclosure", () => {
    const row: ExecutionLedgerRecord = {
      id: "a45280c9-9229-4cc3-964f-17dba9d00bef",
      state: "confirmed",
      cluster: "devnet",
      transactionSignature:
        "5x7HTSfAToQsJJsd1GLm7tHw2TuWzdTvbEaDdULFKUhdPQha8jVVQ4VPqgfdrj4WeXuhhcfxeBFsRdM2bJxKxEJ",
      submittedAt: new Date("2026-03-03T11:10:00Z"),
      confirmedAt: new Date("2026-03-03T11:11:00Z"),
      slot: BigInt("312345678"),
      feeLamports: "5000",
      errorCode: null,
      safeError: null,
      createdAt: new Date("2026-03-03T11:09:00Z"),
      decisionHash: "a".repeat(64),
      agentMode: "devnet",
      proposal: {
        action: "BUY",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: { rawAmount: "1500000000", decimals: 9, uiAmount: "1.5" },
        minimumOutputAmount: { rawAmount: "120000000", decimals: 6, uiAmount: "120" },
        maxSlippageBps: 100,
        thesis: "A bounded swap reviewed against current risk parameters.",
        evidence: [
          { sourceId: "market-feed", claim: "Quote observed for this decision" },
        ],
        confidenceBps: 7500,
        invalidationConditions: ["Quote expires before wallet approval"],
        dataTimestamp: "2026-03-03T11:08:00Z",
        expiresAt: "2026-03-03T11:13:00Z",
      },
    };
    const html = renderToStaticMarkup(<ExecutionLedgerRow row={row} />);
    expect(html).toContain("Confirmed");
    expect(html).toContain("1.5");
    expect(html).toContain("5000 lamports");
    expect(html).toContain("<details");
    expect(html).toContain("Copy transaction signature");
    expect(html).toContain("explorer.solana.com/tx/");
    expect(html).toContain("Execution attempt does not store a wallet address");
  });

  it("does not provide an explorer link for a pre-broadcast signed launch", () => {
    const row: LaunchLedgerRecord = {
      id: "a45280c9-9229-4cc3-964f-17dba9d00bef",
      provider: "meteora",
      status: "pool_submitting",
      cluster: "devnet",
      providerRequestId: null,
      baseMint: null,
      quoteMint: null,
      poolAddress: null,
      payoutWallet: null,
      transactionSignature: "signed-but-not-broadcast",
      metadata: {},
      createdAt: new Date("2026-03-03T11:09:00Z"),
      updatedAt: new Date("2026-03-03T11:10:00Z"),
      agentName: "Atlas",
      agentSlug: "atlas",
    };
    const html = renderToStaticMarkup(<LaunchLedgerRow row={row} />);
    expect(html).toContain("Signing");
    expect(html).not.toContain("explorer.solana.com");
    expect(html).toContain("Market launch");
  });
});
