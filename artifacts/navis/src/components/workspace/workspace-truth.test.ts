/**
 * Truth tests for lifecycle mapping and integration status.
 *
 * Runner: Node's built-in test runner through tsx (no extra dependency).
 *   cd artifacts/navis && node_modules/.bin/tsx --test src/components/workspace/workspace-truth.test.ts
 * Excluded from the app tsconfig by its `**\/*.test.ts` pattern.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { integrationRows } from "./integrations.ts";
import { deriveLifecycle, walletApprovalFor, type LifecycleInput } from "./lifecycle.ts";
import type { PublicCapabilities } from "./types.ts";

const SIG = "5VfYmGQ1pXw9d8Kc2bJt3nRr4sLh6uE7aZy8oPq1Wx2Ck3Mv4Nb5";

function lifecycle(input: LifecycleInput) {
  return deriveLifecycle(input);
}

function step(input: LifecycleInput, key: string) {
  const found = lifecycle(input).steps.find((item) => item.key === key);
  assert.ok(found, `missing step ${key}`);
  return found;
}

// A positive claim that a signature exists. "No transaction signature is
// recorded." is an honest negative and must not match.
const signedClaim = /^(a transaction signature is recorded|signed)|recorded as confirmed with a transaction signature/i;

describe("deriveLifecycle", () => {
  it("proposal without a verdict is PROPOSED", () => {
    const result = lifecycle({ approved: null, executionState: null });
    assert.equal(result.stage, "PROPOSED");
    assert.equal(step({ approved: null, executionState: null }, "policy").state, "current");
  });

  it("policy approval alone is APPROVED, never wallet approval", () => {
    const input = { approved: true, executionState: null } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "APPROVED");
    assert.equal(result.qualifier, "Policy only");
    assert.equal(step(input, "signing").state, "waiting");
    assert.equal(walletApprovalFor(result, null).label, "Not requested");
  });

  it("a simulation stays APPROVED and never reaches submission or confirmation", () => {
    const input = { approved: true, executionState: "simulated", mode: "demo" } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "APPROVED");
    assert.equal(result.simulated, true);
    assert.equal(result.qualifier, "Policy only · simulated");
    for (const key of ["signing", "submitted", "confirmed"]) {
      assert.equal(step(input, key).state, "not-requested");
    }
    assert.doesNotMatch(result.summary, /confirmed|submitted onchain/i);
  });

  it("a policy rejection is BLOCKED by policy and nothing reaches a wallet", () => {
    const input = { approved: false, executionState: "rejected", mode: "demo" } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "BLOCKED");
    assert.equal(result.qualifier, "By policy");
    assert.equal(result.simulated, false);
    assert.equal(step(input, "policy").state, "blocked");
    assert.equal(walletApprovalFor(result, null).label, "Not reached");
  });

  it("an attempt closed before signing is BLOCKED before signing", () => {
    const result = lifecycle({ approved: true, executionState: "rejected" });
    assert.equal(result.stage, "BLOCKED");
    assert.equal(result.qualifier, "Before signing");
  });

  it("awaiting_signature is SIGNING and waits on the wallet", () => {
    const input = { approved: true, executionState: "awaiting_signature" } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "SIGNING");
    assert.equal(step(input, "signing").state, "current");
    assert.equal(walletApprovalFor(result, null).label, "Awaiting wallet");
  });

  it("submitted with a signature is SUBMITTED and unconfirmed", () => {
    const input = { approved: true, executionState: "submitted", signature: SIG } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "SUBMITTED");
    assert.equal(result.qualifier, "Unconfirmed");
    assert.equal(step(input, "signing").state, "complete");
    assert.equal(step(input, "confirmed").state, "waiting");
  });

  it("submitted without a signature never claims a signature", () => {
    const input = { approved: true, executionState: "submitted" } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "SUBMITTED");
    const signing = step(input, "signing");
    assert.equal(signing.state, "unrecorded");
    assert.doesNotMatch(signing.note, signedClaim);
    assert.match(result.summary, /no transaction signature is recorded/i);
    assert.equal(walletApprovalFor(result, null).label, "No signature recorded");
  });

  it("confirmed with a signature is CONFIRMED", () => {
    const input = { approved: true, executionState: "confirmed", signature: SIG } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "CONFIRMED");
    assert.equal(result.tone, "success");
    assert.equal(step(input, "confirmed").state, "complete");
    assert.equal(walletApprovalFor(result, SIG).label, "Signature recorded");
  });

  it("confirmed without a signature in a full record is not CONFIRMED and does not claim signing", () => {
    const input = { approved: true, executionState: "confirmed", signature: null } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "SUBMITTED");
    assert.equal(result.qualifier, "Confirmation unproven");
    assert.notEqual(step(input, "confirmed").state, "complete");
    assert.equal(step(input, "signing").state, "unrecorded");
    for (const item of result.steps) {
      assert.doesNotMatch(item.note, signedClaim);
    }
    assert.match(result.summary, /not proven/i);
  });

  it("a summary row reports the recorded state without asserting or denying signatures", () => {
    const input = { approved: true, executionState: "confirmed", evidence: "summary" } as const;
    const result = lifecycle(input);
    assert.equal(result.stage, "CONFIRMED");
    assert.equal(result.qualifier, "Recorded state");
    const signing = step(input, "signing");
    assert.doesNotMatch(signing.note, signedClaim);
    assert.match(signing.note, /full record/i);
  });

  it("failed and cancelled attempts are FAILED with no settlement", () => {
    for (const state of ["failed", "cancelled"]) {
      const result = lifecycle({ approved: true, executionState: state });
      assert.equal(result.stage, "FAILED");
      assert.equal(result.steps.find((item) => item.key === "confirmed")?.state, "failed");
      assert.equal(result.steps.find((item) => item.key === "submitted")?.state, "waiting");
    }
  });

  it("produces all seven distinct stages", () => {
    const stages = new Set(
      [
        { approved: null, executionState: null },
        { approved: true, executionState: null },
        { approved: true, executionState: "awaiting_signature" },
        { approved: true, executionState: "submitted", signature: SIG },
        { approved: true, executionState: "confirmed", signature: SIG },
        { approved: true, executionState: "failed" },
        { approved: false, executionState: "rejected" },
      ].map((input) => lifecycle(input).stage),
    );
    assert.equal(stages.size, 7);
  });
});

const baseCapabilities: PublicCapabilities = {
  mode: "demo",
  cluster: "devnet",
  demoAvailable: true,
  devnetExecutionAvailable: false,
  mainnetExecutionAvailable: false,
  walletAuthenticationConfigured: true,
  appOriginConfigured: true,
  persistenceConfigured: true,
  solanaRpcConfigured: true,
  clawpumpConfigured: true,
  meteoraConfigured: true,
  aiConfigured: true,
  prestocksConfigured: true,
};

function rowFor(capabilities: PublicCapabilities, key: string) {
  const row = integrationRows(capabilities).find((item) => item.key === key);
  assert.ok(row, `missing row ${key}`);
  return row;
}

describe("integrationRows", () => {
  it("never reports a configured service as live, connected or healthy", () => {
    for (const row of integrationRows(baseCapabilities)) {
      assert.doesNotMatch(`${row.label} ${row.detail}`, /\b(live|connected|healthy|online)\b/i, row.key);
      assert.ok(!["live", "connected"].includes(row.value as string), row.key);
    }
  });

  it("reports the database as configured with availability unverified", () => {
    const row = rowFor(baseCapabilities, "persistence");
    assert.equal(row.value, "configured");
    assert.equal(row.label, "Database configured");
    assert.match(row.detail, /unverified/i);
  });

  it("does not claim an external model when the proposal provider may be the demo provider", () => {
    const row = rowFor(baseCapabilities, "ai");
    assert.doesNotMatch(`${row.label} ${row.detail}`, /model provider configured|openai|external model/i);
    assert.match(row.detail, /demo provider/i);
  });

  it("keeps Meteora broadcasting off even when configured", () => {
    const row = rowFor(baseCapabilities, "meteora");
    assert.equal(row.value, "preparation");
    assert.match(row.label, /broadcast off/i);
  });

  it("derives execution from the mode flags only", () => {
    assert.equal(rowFor(baseCapabilities, "execution").value, "simulation");
    assert.equal(
      rowFor({ ...baseCapabilities, mode: "devnet", devnetExecutionAvailable: false }, "execution").value,
      "blocked",
    );
    assert.equal(
      rowFor({ ...baseCapabilities, mode: "devnet", devnetExecutionAvailable: true }, "execution").value,
      "devnet",
    );
    // A flag for another mode does not enable execution in this mode.
    assert.equal(
      rowFor({ ...baseCapabilities, mode: "devnet", mainnetExecutionAvailable: true }, "execution").value,
      "blocked",
    );
  });

  it("marks unconfigured services unavailable", () => {
    const none: PublicCapabilities = {
      ...baseCapabilities,
      persistenceConfigured: false,
      solanaRpcConfigured: false,
      clawpumpConfigured: false,
      meteoraConfigured: false,
      aiConfigured: false,
      prestocksConfigured: false,
    };
    for (const row of integrationRows(none).filter((item) => item.key !== "execution")) {
      assert.equal(row.value, "unavailable", row.key);
      assert.equal(row.label, "Not configured", row.key);
    }
  });
});
