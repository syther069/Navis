import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attempt: null as Record<string, unknown> | null,
  transition: vi.fn(),
}));

vi.mock("../lib/services/execution", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/services/execution")>();
  return {
    ...actual,
    transitionExecutionAttempt: mocks.transition,
  };
});

import { SolanaRpcError } from "../lib/integrations/solana/rpc";
import { reconcileExecutionAttempt } from "../lib/services/reconciliation";

const database = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => (mocks.attempt ? [mocks.attempt] : []),
      }),
    }),
  }),
} as unknown as Parameters<typeof reconcileExecutionAttempt>[2];

const signature = "5".repeat(88);

function submittedAttempt(state: "submitted" | "unknown_pending" = "submitted") {
  return {
    id: "attempt-1",
    state,
    transactionSignature: signature,
  };
}

function rpc(
  overrides: Partial<{
    getSignatureStatus: () => Promise<unknown>;
    getTransactionEvidence: () => Promise<unknown>;
  }> = {},
) {
  return {
    getSignatureStatus: vi.fn(
      overrides.getSignatureStatus ??
        (async () => ({
          contextSlot: BigInt(100),
          status: { slot: 90, err: null, confirmationStatus: "finalized" },
        })),
    ),
    getTransactionEvidence: vi.fn(
      overrides.getTransactionEvidence ??
        (async () => ({
          slot: 90,
          blockTime: 1_758_326_400,
          meta: { err: null, fee: 5000, preBalances: [10], postBalances: [5] },
        })),
    ),
  } as unknown as Parameters<typeof reconcileExecutionAttempt>[1];
}

function transitionedTo() {
  return mocks.transition.mock.calls[0]?.[1];
}

describe("reconciliation under unknown RPC outcomes", () => {
  beforeEach(() => {
    mocks.attempt = submittedAttempt();
    mocks.transition.mockReset();
    mocks.transition.mockImplementation(async (_id, next, evidence) => ({
      state: next,
      evidence,
    }));
  });

  it.each(["timeout", "network", "rpc", "invalid"] as const)(
    "maps a %s RPC failure to unknown_pending, never failed or confirmed",
    async (code) => {
      await reconcileExecutionAttempt(
        "attempt-1",
        rpc({
          getSignatureStatus: async () => {
            throw new SolanaRpcError(`rpc ${code}`, code);
          },
        }),
        database,
      );
      expect(transitionedTo()).toBe("unknown_pending");
      expect(mocks.transition.mock.calls[0]?.[2]).toMatchObject({
        metadata: { reason: code },
      });
    },
  );

  it("maps a timeout while fetching the transaction to unknown_pending", async () => {
    await reconcileExecutionAttempt(
      "attempt-1",
      rpc({
        getTransactionEvidence: async () => {
          throw new SolanaRpcError("timed out", "timeout");
        },
      }),
      database,
    );
    expect(transitionedTo()).toBe("unknown_pending");
  });

  it("keeps a signature the cluster has not seen as unknown_pending", async () => {
    await reconcileExecutionAttempt(
      "attempt-1",
      rpc({
        getSignatureStatus: async () => ({ contextSlot: BigInt(100), status: null }),
      }),
      database,
    );
    expect(transitionedTo()).toBe("unknown_pending");
    expect(mocks.transition.mock.calls[0]?.[2]).toMatchObject({
      metadata: { reason: "signature_not_found" },
    });
  });

  it.each(["processed", undefined])(
    "keeps a %s confirmation status as unknown_pending",
    async (confirmationStatus) => {
      await reconcileExecutionAttempt(
        "attempt-1",
        rpc({
          getSignatureStatus: async () => ({
            contextSlot: BigInt(100),
            status: { slot: 90, err: null, confirmationStatus },
          }),
        }),
        database,
      );
      expect(transitionedTo()).toBe("unknown_pending");
      expect(mocks.transition.mock.calls[0]?.[2]).toMatchObject({
        metadata: { reason: "not_yet_confirmed" },
      });
    },
  );

  it("keeps a confirmed signature without readable transaction evidence as unknown_pending", async () => {
    await reconcileExecutionAttempt(
      "attempt-1",
      rpc({ getTransactionEvidence: async () => null }),
      database,
    );
    expect(transitionedTo()).toBe("unknown_pending");
    expect(mocks.transition.mock.calls[0]?.[2]).toMatchObject({
      metadata: { reason: "confirmed_transaction_evidence_unavailable" },
    });
  });

  it("re-reconciles an unknown_pending attempt to confirmed once evidence is complete", async () => {
    mocks.attempt = submittedAttempt("unknown_pending");
    await reconcileExecutionAttempt("attempt-1", rpc(), database);
    expect(transitionedTo()).toBe("confirmed");
    expect(mocks.transition.mock.calls[0]?.[2]).toMatchObject({
      slot: 90,
      feeLamports: 5000,
    });
  });

  it("marks an onchain error failed only when the cluster reports it", async () => {
    await reconcileExecutionAttempt(
      "attempt-1",
      rpc({
        getSignatureStatus: async () => ({
          contextSlot: BigInt(100),
          status: {
            slot: 90,
            err: { InstructionError: [0, "Custom"] },
            confirmationStatus: "finalized",
          },
        }),
      }),
      database,
    );
    expect(transitionedTo()).toBe("failed");
  });

  it("does not swallow non-RPC failures as an execution outcome", async () => {
    await expect(
      reconcileExecutionAttempt(
        "attempt-1",
        rpc({
          getSignatureStatus: async () => {
            throw new TypeError("programming error");
          },
        }),
        database,
      ),
    ).rejects.toThrow("programming error");
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("refuses to reconcile attempts that were never broadcast", async () => {
    mocks.attempt = {
      id: "attempt-1",
      state: "awaiting_signature",
      transactionSignature: null,
    };
    await expect(
      reconcileExecutionAttempt("attempt-1", rpc(), database),
    ).rejects.toThrow("Only submitted or unknown-pending");
    mocks.attempt = { id: "attempt-1", state: "submitted", transactionSignature: null };
    await expect(
      reconcileExecutionAttempt("attempt-1", rpc(), database),
    ).rejects.toThrow("requires a transaction signature");
  });
});
