import { describe, expect, it } from "vitest";

import {
  assertExecutionGate,
  assertExecutionTransition,
  isTerminalExecutionState,
  validateTransitionEvidence,
} from "../lib/services/execution";

function validGate() {
  return {
    decisionStatus: "approved" as const,
    decisionHash: "a".repeat(64),
    expectedDecisionHash: "a".repeat(64),
    decisionExpiresAt: new Date("2026-09-17T09:00:00.000Z"),
    proposalExpiresAt: new Date("2026-09-17T09:00:00.000Z"),
    proposalAction: "BUY" as const,
    ownerId: "11111111-1111-4111-8111-111111111111",
    expectedOwnerId: "11111111-1111-4111-8111-111111111111",
    mode: "devnet" as const,
    cluster: "devnet" as const,
    executionKind: "wallet" as const,
    devnetExecutionAvailable: true,
    mainnetExecutionAvailable: false,
    policyEvaluation: { approved: true, inputHash: "b".repeat(64) },
    expectedPolicyInputHash: "b".repeat(64),
    hasActiveAttempt: false,
    now: new Date("2026-09-17T08:00:00.000Z"),
  };
}

describe("execution attempt state machine", () => {
  it("allows the guarded happy path and terminal outcomes", () => {
    expect(() => assertExecutionTransition("created", "simulated")).not.toThrow();
    expect(() =>
      assertExecutionTransition("simulated", "awaiting_signature"),
    ).not.toThrow();
    expect(() =>
      assertExecutionTransition("awaiting_signature", "submitted"),
    ).not.toThrow();
    expect(() => assertExecutionTransition("submitted", "confirmed")).not.toThrow();
    expect(isTerminalExecutionState("confirmed")).toBe(true);
    expect(isTerminalExecutionState("unknown_pending")).toBe(false);
  });

  it("rejects skipped, repeated, and post-terminal transitions", () => {
    expect(() => assertExecutionTransition("created", "submitted")).toThrow(
      "Invalid execution transition",
    );
    expect(() => assertExecutionTransition("submitted", "submitted")).toThrow(
      "Invalid execution transition",
    );
    expect(() => assertExecutionTransition("confirmed", "failed")).toThrow(
      "Invalid execution transition",
    );
  });

  it("requires signature and confirmation evidence", () => {
    expect(() =>
      validateTransitionEvidence("awaiting_signature", "submitted", {}),
    ).toThrow("real transaction signature");
    expect(() =>
      validateTransitionEvidence(
        "submitted",
        "confirmed",
        {},
        {
          transactionSignature: "a".repeat(64),
        },
      ),
    ).toThrow("confirmation timestamp and slot");

    expect(
      validateTransitionEvidence(
        "submitted",
        "confirmed",
        {
          confirmedAt: "2026-09-17T08:00:00.000Z",
          slot: "1234",
          feeLamports: "5000",
        },
        { transactionSignature: "a".repeat(64) },
      ),
    ).toMatchObject({ slot: BigInt(1234), feeLamports: BigInt(5000) });
  });

  it("requires safe failure evidence", () => {
    expect(() => validateTransitionEvidence("created", "failed", {})).toThrow(
      "safe error description",
    );
  });

  it("opens only an owned, approved, fresh, policy-matched decision", () => {
    expect(() => assertExecutionGate(validGate())).not.toThrow();

    expect(() =>
      assertExecutionGate({ ...validGate(), decisionStatus: "rejected" }),
    ).toThrow("not approved");
    expect(() =>
      assertExecutionGate({ ...validGate(), expectedDecisionHash: "c".repeat(64) }),
    ).toThrow("hash changed");
    expect(() =>
      assertExecutionGate({
        ...validGate(),
        proposalExpiresAt: new Date("2026-09-17T07:59:00.000Z"),
      }),
    ).toThrow("expired");
    expect(() =>
      assertExecutionGate({ ...validGate(), hasActiveAttempt: true }),
    ).toThrow("active execution");
  });

  it("blocks demo wallet execution and disabled live modes", () => {
    expect(() =>
      assertExecutionGate({
        ...validGate(),
        mode: "demo",
        executionKind: "wallet",
      }),
    ).toThrow("Demo decisions");
    expect(() =>
      assertExecutionGate({ ...validGate(), devnetExecutionAvailable: false }),
    ).toThrow("Devnet execution is not enabled");
  });
});
