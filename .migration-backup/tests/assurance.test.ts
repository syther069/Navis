import { describe, expect, it } from "vitest";

import { assuranceForExecution, assuranceForReceipt } from "../lib/assurance";
import { demoProof } from "../fixtures/demo-proof";

const signature = "5".repeat(88);

describe("assurance helper", () => {
  it("labels the prepared demo receipt as an offchain demo simulation", () => {
    const assurance = assuranceForReceipt(demoProof.document);
    expect(assurance.level).toBe("offchain_integrity");
    expect(assurance.origin).toBe("demo_simulation");
    expect(assurance.levelLabel).toBe("Offchain integrity");
    expect(assurance.originLabel).toBe("Demo simulation");
  });

  it("never upgrades a demo receipt even if execution fields look live", () => {
    const assurance = assuranceForReceipt({
      mode: "demo",
      execution: { state: "confirmed", transactionSignature: signature },
    });
    expect(assurance.level).toBe("offchain_integrity");
    expect(assurance.origin).toBe("demo_simulation");
  });

  it("maps confirmed live receipts with a signature to onchain settlement", () => {
    const assurance = assuranceForReceipt({
      mode: "devnet",
      execution: { state: "confirmed", transactionSignature: signature },
    });
    expect(assurance.level).toBe("onchain_settlement");
    expect(assurance.origin).toBe("live_onchain");
  });

  it("maps a signed but failed live receipt to wallet authorization", () => {
    const assurance = assuranceForReceipt({
      mode: "mainnet",
      execution: { state: "failed", transactionSignature: signature },
    });
    expect(assurance.level).toBe("wallet_authorization");
    expect(assurance.origin).toBe("live_onchain");
  });

  it("keeps rejected live receipts without a signature at offchain integrity", () => {
    const assurance = assuranceForReceipt({
      mode: "devnet",
      execution: { state: "rejected", transactionSignature: null },
    });
    expect(assurance.level).toBe("offchain_integrity");
    expect(assurance.origin).toBe("live_onchain");
  });

  it("maps execution attempts by state and signature", () => {
    expect(
      assuranceForExecution({ state: "simulated", transactionSignature: null }),
    ).toMatchObject({ level: "offchain_integrity", origin: "demo_simulation" });
    expect(
      assuranceForExecution({
        state: "rejected",
        transactionSignature: null,
        mode: "demo",
      }),
    ).toMatchObject({ level: "offchain_integrity", origin: "demo_simulation" });
    expect(
      assuranceForExecution({
        state: "awaiting_signature",
        transactionSignature: null,
        mode: "devnet",
      }),
    ).toMatchObject({ level: "offchain_integrity", origin: "live_onchain" });
    expect(
      assuranceForExecution({
        state: "submitted",
        transactionSignature: signature,
        mode: "devnet",
      }),
    ).toMatchObject({ level: "wallet_authorization", origin: "live_onchain" });
    expect(
      assuranceForExecution({
        state: "unknown_pending",
        transactionSignature: signature,
        mode: "devnet",
      }),
    ).toMatchObject({ level: "wallet_authorization", origin: "live_onchain" });
    expect(
      assuranceForExecution({
        state: "confirmed",
        transactionSignature: signature,
        mode: "mainnet",
      }),
    ).toMatchObject({ level: "onchain_settlement", origin: "live_onchain" });
  });

  it("does not claim settlement for a confirmed state without a signature", () => {
    const assurance = assuranceForExecution({
      state: "confirmed",
      transactionSignature: null,
      mode: "devnet",
    });
    expect(assurance.level).not.toBe("onchain_settlement");
  });
});
