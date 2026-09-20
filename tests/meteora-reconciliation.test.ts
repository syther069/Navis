import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it, vi } from "vitest";

import {
  classifyMeteoraProtocolEvidence,
  classifyMeteoraSendError,
  deriveTransactionSignature,
  isMeteoraIntentReplayable,
} from "../lib/integrations/meteora/submit-lifecycle";
import { SolanaRpcError } from "../lib/integrations/solana/rpc";
import {
  MeteoraReconciliationError,
  reconcileMeteoraLaunch,
  summarizeMeteoraLaunchEvidence,
  type MeteoraReconciliationDeps,
} from "../lib/services/meteora-reconciliation";

const QUOTE = "So11111111111111111111111111111111111111112";
const CONFIG = "Config11111111111111111111111111111111111111";
const BASE = "Base111111111111111111111111111111111111111";
const POOL = "Poo1111111111111111111111111111111111111111";
const SIGNATURE = "5".repeat(87);

describe("Meteora submit lifecycle helpers", () => {
  it("derives the onchain signature from a signed transaction before broadcast", () => {
    const payer = Keypair.generate();
    const transaction = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: bs58.encode(Buffer.alloc(32, 3)),
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      }),
    );
    transaction.sign(payer);
    expect(deriveTransactionSignature(transaction)).toBe(
      bs58.encode(transaction.signatures[0]!.signature!),
    );
  });

  it("refuses to derive a signature from an unsigned transaction", () => {
    const transaction = new Transaction({
      feePayer: Keypair.generate().publicKey,
      recentBlockhash: bs58.encode(Buffer.alloc(32, 3)),
    });
    expect(() => deriveTransactionSignature(transaction)).toThrow(
      /no fee-payer signature/,
    );
  });

  it("treats only clear preflight rejections as pre-broadcast failures", () => {
    expect(
      classifyMeteoraSendError(
        new Error("Transaction simulation failed: custom program error"),
      ).kind,
    ).toBe("rejected_before_broadcast");
    expect(classifyMeteoraSendError(new Error("Blockhash not found")).kind).toBe(
      "rejected_before_broadcast",
    );
    expect(classifyMeteoraSendError(new Error("socket hang up")).kind).toBe(
      "unknown_after_send",
    );
    expect(classifyMeteoraSendError(new Error("Request timed out")).kind).toBe(
      "unknown_after_send",
    );
    expect(
      classifyMeteoraSendError(
        new Error(
          "Transaction simulation failed: This transaction has already been processed",
        ),
      ).kind,
    ).toBe("unknown_after_send");
    expect(classifyMeteoraSendError(undefined).kind).toBe("unknown_after_send");
  });

  it("replays submitting, submitted, unknown_pending, confirmed and consumed intents", () => {
    for (const status of [
      "submitting",
      "submitted",
      "unknown_pending",
      "confirmed",
      "consumed",
    ]) {
      expect(isMeteoraIntentReplayable(status)).toBe(true);
    }
    for (const status of [
      "prepared",
      "simulated",
      "expired",
      "failed",
      "broadcasting",
    ]) {
      expect(isMeteoraIntentReplayable(status)).toBe(false);
    }
  });

  it("labels protocol evidence from the decoded account", () => {
    expect(
      classifyMeteoraProtocolEvidence({
        address: CONFIG,
        expected: { quoteMint: QUOTE },
        actual: { quoteMint: QUOTE },
      }),
    ).toMatchObject({ label: "protocol_verified", reason: "account_verified" });
    expect(
      classifyMeteoraProtocolEvidence({
        address: CONFIG,
        expected: { quoteMint: QUOTE },
        actual: null,
      }),
    ).toMatchObject({ label: "signature_confirmed", reason: "account_missing" });
    expect(
      classifyMeteoraProtocolEvidence({
        address: CONFIG,
        expected: { quoteMint: QUOTE },
        actual: { quoteMint: BASE },
      }),
    ).toMatchObject({ label: "evidence_incomplete", reason: "account_mismatch" });
    expect(
      classifyMeteoraProtocolEvidence({
        address: null,
        expected: { quoteMint: QUOTE },
        actual: null,
      }),
    ).toMatchObject({
      label: "evidence_incomplete",
      reason: "expected_accounts_missing",
    });
  });
});

type Launch = Record<string, unknown>;

function fakeDatabase(launch: Launch | undefined) {
  const updates: { table: unknown; values: Record<string, unknown> }[] = [];
  let updateResultOverride: Launch[] | null = null;
  const database = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (launch ? [launch] : []),
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return {
          where: () => ({
            returning: async () => updateResultOverride ?? [{ ...launch, ...values }],
            then: (resolve: (value: unknown) => void) => resolve(undefined),
          }),
        };
      },
    }),
    transaction: (callback: (transaction: unknown) => unknown) => callback(database),
  };
  return {
    database: database as never,
    updates,
    failNextUpdate() {
      updateResultOverride = [];
    },
  };
}

function configLaunch(overrides: Launch = {}): Launch {
  return {
    id: "launch-1",
    provider: "meteora",
    cluster: "devnet",
    status: "unknown_pending",
    transactionSignature: SIGNATURE,
    quoteMint: QUOTE,
    baseMint: null,
    poolAddress: null,
    metadata: { kind: "meteora.createConfig", config: CONFIG, intentId: "intent-1" },
    ...overrides,
  };
}

function poolLaunch(overrides: Launch = {}): Launch {
  return configLaunch({
    status: "pool_submitted",
    baseMint: BASE,
    poolAddress: POOL,
    metadata: {
      kind: "meteora.createConfig",
      config: CONFIG,
      intentId: "intent-1",
      confirmation: { label: "protocol_verified", state: "protocol_verified" },
      pool: { intentId: "intent-2", transactionSignature: "7".repeat(87) },
    },
    ...overrides,
  });
}

function confirmedRpc(overrides: Partial<MeteoraReconciliationDeps["rpc"]> = {}) {
  return {
    getSignatureStatus: vi.fn().mockResolvedValue({
      contextSlot: BigInt(1_000),
      status: { slot: 900, err: null, confirmationStatus: "finalized" },
    }),
    getTransactionEvidence: vi.fn().mockResolvedValue({
      slot: 900,
      blockTime: 1_700_000_000,
      meta: { err: null, fee: 5_000, preBalances: [], postBalances: [] },
    }),
    ...overrides,
  } as unknown as MeteoraReconciliationDeps["rpc"];
}

function deps(input: {
  rpc?: MeteoraReconciliationDeps["rpc"];
  config?: { quoteMint: string } | null;
  pool?: { baseMint: string; config: string } | null;
}): MeteoraReconciliationDeps {
  return {
    rpc: input.rpc ?? confirmedRpc(),
    readConfig: vi.fn().mockResolvedValue(input.config ?? null),
    readPool: vi.fn().mockResolvedValue(input.pool ?? null),
  };
}

const cluster = { cluster: "devnet" as const };

describe("reconcileMeteoraLaunch", () => {
  it("marks a confirmed signature with a matching config as protocol_verified", async () => {
    const store = fakeDatabase(configLaunch());
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ config: { quoteMint: QUOTE } }),
      store.database,
      cluster,
    );
    expect(result.httpStatus).toBe(200);
    expect(result.launch.status).toBe("confirmed");
    expect(result.confirmation).toMatchObject({
      label: "protocol_verified",
      signature: { slot: 900, feeLamports: 5_000, transactionSignature: SIGNATURE },
      protocol: { address: CONFIG, checks: [{ field: "quoteMint", ok: true }] },
    });
    expect(store.updates.at(-1)?.values).toMatchObject({ status: "confirmed" });
  });

  it("stops at signature_confirmed when the config account is missing", async () => {
    const store = fakeDatabase(configLaunch());
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ config: null }),
      store.database,
      cluster,
    );
    expect(result.httpStatus).toBe(200);
    expect(result.launch.status).toBe("signature_confirmed");
    expect(result.confirmation.label).toBe("signature_confirmed");
    expect(result.confirmation.protocol?.reason).toBe("account_missing");
    expect(result.confirmation.signature?.slot).toBe(900);
  });

  it("flags evidence_incomplete when the onchain config quotes a different mint", async () => {
    const store = fakeDatabase(configLaunch());
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ config: { quoteMint: BASE } }),
      store.database,
      cluster,
    );
    expect(result.launch.status).toBe("signature_confirmed");
    expect(result.confirmation.label).toBe("evidence_incomplete");
    expect(result.confirmation.protocol?.checks[0]).toMatchObject({
      field: "quoteMint",
      expected: QUOTE,
      actual: BASE,
      ok: false,
    });
  });

  it("re-checks a signature_confirmed launch and upgrades it once the account exists", async () => {
    const store = fakeDatabase(configLaunch({ status: "signature_confirmed" }));
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ config: { quoteMint: QUOTE } }),
      store.database,
      cluster,
    );
    expect(result.launch.status).toBe("confirmed");
  });

  it("keeps a submitting launch pending while the signature is unknown to the cluster", async () => {
    const store = fakeDatabase(configLaunch({ status: "submitting" }));
    const rpc = confirmedRpc({
      getSignatureStatus: vi
        .fn()
        .mockResolvedValue({ contextSlot: BigInt(10), status: null }),
    } as never);
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ rpc }),
      store.database,
      cluster,
    );
    expect(result.httpStatus).toBe(202);
    expect(result.launch.status).toBe("unknown_pending");
    expect(result.confirmation.state).toBe("signature_not_found");
    expect(store.updates.at(-1)?.values.status).toBe("unknown_pending");
  });

  it("fails a launch whose signature confirmed with an onchain error", async () => {
    const store = fakeDatabase(configLaunch());
    const rpc = confirmedRpc({
      getSignatureStatus: vi.fn().mockResolvedValue({
        contextSlot: BigInt(1_000),
        status: {
          slot: 900,
          err: { InstructionError: [0, "Custom"] },
          confirmationStatus: "confirmed",
        },
      }),
    } as never);
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ rpc }),
      store.database,
      cluster,
    );
    expect(result.launch.status).toBe("failed");
    expect(result.confirmation.state).toBe("onchain_error");
  });

  it("stays pending on RPC outages instead of guessing", async () => {
    const store = fakeDatabase(configLaunch());
    const rpc = confirmedRpc({
      getSignatureStatus: vi
        .fn()
        .mockRejectedValue(new SolanaRpcError("RPC timed out", "timeout")),
    } as never);
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ rpc }),
      store.database,
      cluster,
    );
    expect(result.httpStatus).toBe(202);
    expect(result.confirmation.state).toBe("rpc_unavailable");
  });

  it("verifies the pool phase against the pool account and keeps config evidence", async () => {
    const store = fakeDatabase(poolLaunch());
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ pool: { baseMint: BASE, config: CONFIG } }),
      store.database,
      cluster,
    );
    expect(result.launch.status).toBe("pool_confirmed");
    expect(result.confirmation.phase).toBe("pool");
    expect(result.confirmation.signature?.transactionSignature).toBe("7".repeat(87));
    const metadata = result.launch.metadata as Record<string, Record<string, unknown>>;
    expect(metadata.confirmation.label).toBe("protocol_verified");
    expect(metadata.pool.confirmation).toMatchObject({ label: "protocol_verified" });
    expect(summarizeMeteoraLaunchEvidence("pool_confirmed", metadata)).toMatchObject({
      label: "protocol_verified",
      account: POOL,
    });
  });

  it("does not verify a pool launch that never recorded its base mint", async () => {
    const store = fakeDatabase(poolLaunch({ baseMint: null }));
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({ pool: { baseMint: BASE, config: CONFIG } }),
      store.database,
      cluster,
    );
    expect(result.launch.status).toBe("pool_signature_confirmed");
    expect(result.confirmation.label).toBe("evidence_incomplete");
  });

  it("marks a pool whose account points at another config as evidence_incomplete", async () => {
    const store = fakeDatabase(poolLaunch());
    const result = await reconcileMeteoraLaunch(
      "launch-1",
      deps({
        pool: { baseMint: BASE, config: "Other11111111111111111111111111111111111111" },
      }),
      store.database,
      cluster,
    );
    expect(result.launch.status).toBe("pool_signature_confirmed");
    expect(result.confirmation.label).toBe("evidence_incomplete");
  });

  it("returns settled launches unchanged without touching the RPC", async () => {
    for (const status of [
      "confirmed",
      "failed",
      "broadcast_failed",
      "pool_confirmed",
    ]) {
      const store = fakeDatabase(configLaunch({ status }));
      const dependencies = deps({});
      const result = await reconcileMeteoraLaunch(
        "launch-1",
        dependencies,
        store.database,
        cluster,
      );
      expect(result.launch.status).toBe(status);
      expect(store.updates).toHaveLength(0);
      expect(dependencies.rpc.getSignatureStatus).not.toHaveBeenCalled();
    }
  });

  it("rejects launches that are neither pending nor settled", async () => {
    for (const status of ["prepared", "simulated", "broadcasting"]) {
      const store = fakeDatabase(configLaunch({ status }));
      await expect(
        reconcileMeteoraLaunch("launch-1", deps({}), store.database, cluster),
      ).rejects.toBeInstanceOf(MeteoraReconciliationError);
    }
  });

  it("rejects an unknown launch and a cluster mismatch", async () => {
    await expect(
      reconcileMeteoraLaunch(
        "missing",
        deps({}),
        fakeDatabase(undefined).database,
        cluster,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      reconcileMeteoraLaunch(
        "launch-1",
        deps({}),
        fakeDatabase(configLaunch({ cluster: "mainnet-beta" })).database,
        cluster,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to overwrite a launch whose status moved during the check", async () => {
    const store = fakeDatabase(configLaunch());
    store.failNextUpdate();
    await expect(
      reconcileMeteoraLaunch(
        "launch-1",
        deps({ config: { quoteMint: QUOTE } }),
        store.database,
        cluster,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("finalizeMeteoraSubmit", () => {
  it("does not overwrite a launch the reconciler already settled", async () => {
    const { finalizeMeteoraSubmit } = await import("../lib/services/meteora-submit");
    const settled = configLaunch({ status: "confirmed" });
    const intentUpdates: Record<string, unknown>[] = [];
    const database = {
      transaction: (callback: (transaction: unknown) => unknown) => callback(database),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            // Launch CAS finds no row in the submitting state.
            returning: async () => [],
            then: (resolve: (value: unknown) => void) => {
              intentUpdates.push({ table, values });
              resolve(undefined);
            },
          }),
        }),
      }),
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [settled] }) }),
      }),
    };
    const launch = await finalizeMeteoraSubmit(database as never, {
      launchId: "launch-1",
      intentId: "intent-1",
      fromLaunchStatus: "submitting",
      launchStatus: "unknown_pending",
      intentStatus: "unknown_pending",
      metadata: {},
    });
    expect(launch?.status).toBe("confirmed");
    expect(intentUpdates).toHaveLength(0);
  });
});
