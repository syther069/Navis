import { z } from "zod";

import type { SolanaCluster } from "../../domain";
import {
  SOLANA_GENESIS_HASHES,
  type SolanaCommitment,
  type SolanaRpcConfig,
} from "./config";

const rpcEnvelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});

const signatureStatusResponseSchema = z.object({
  context: z.object({ slot: z.number().int().nonnegative() }),
  value: z.array(
    z
      .object({
        slot: z.number().int().nonnegative(),
        confirmations: z.number().int().nonnegative().nullable(),
        err: z.unknown().nullable(),
        confirmationStatus: z.enum(["processed", "confirmed", "finalized"]).optional(),
      })
      .nullable(),
  ),
});

const tokenBalanceSchema = z.object({
  accountIndex: z.number().int().nonnegative(),
  mint: z.string().min(32),
  owner: z.string().min(32).optional(),
  uiTokenAmount: z.object({
    amount: z.string().regex(/^\d+$/),
    decimals: z.number().int().min(0).max(18),
  }),
});

const transactionEvidenceSchema = z
  .object({
    slot: z.number().int().nonnegative(),
    blockTime: z.number().int().nullable(),
    meta: z
      .object({
        err: z.unknown().nullable(),
        fee: z.number().int().nonnegative().safe(),
        preBalances: z.array(z.number().int().nonnegative().safe()),
        postBalances: z.array(z.number().int().nonnegative().safe()),
        preTokenBalances: z.array(tokenBalanceSchema).optional(),
        postTokenBalances: z.array(tokenBalanceSchema).optional(),
      })
      .nullable(),
  })
  .nullable();

export class SolanaRpcError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "timeout" | "network" | "rpc" | "invalid",
  ) {
    super(message);
    this.name = "SolanaRpcError";
  }
}

type RpcFetch = typeof fetch;

export type SolanaHealth = Readonly<{
  status: "healthy" | "unhealthy" | "not_configured" | "cluster_mismatch";
  cluster: SolanaCluster;
  commitment: SolanaCommitment;
  slot?: bigint;
  latencyMs?: number;
  checkedAt: string;
  safeError?: string;
}>;

export class SolanaRpcClient {
  private requestId = 0;

  constructor(
    readonly config: SolanaRpcConfig,
    private readonly fetcher: RpcFetch = fetch,
  ) {}

  async request(method: string, params: readonly unknown[] = []) {
    if (!this.config.endpoint) {
      throw new SolanaRpcError("Solana RPC is not configured", "not_configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(this.config.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++this.requestId,
          method,
          params,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new SolanaRpcError(
          `Solana RPC returned HTTP ${response.status}`,
          "network",
        );
      }

      const envelope = rpcEnvelopeSchema.safeParse(await response.json());
      if (!envelope.success) {
        throw new SolanaRpcError("Solana RPC returned an invalid envelope", "invalid");
      }
      if (envelope.data.error) {
        throw new SolanaRpcError(
          `Solana RPC error ${envelope.data.error.code}: ${envelope.data.error.message}`,
          "rpc",
        );
      }
      return envelope.data.result;
    } catch (error) {
      if (error instanceof SolanaRpcError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SolanaRpcError("Solana RPC request timed out", "timeout");
      }
      throw new SolanaRpcError("Solana RPC request failed", "network");
    } finally {
      clearTimeout(timeout);
    }
  }

  async getHealth() {
    return z.literal("ok").parse(await this.request("getHealth"));
  }

  async getGenesisHash() {
    return z
      .string()
      .min(32)
      .parse(await this.request("getGenesisHash"));
  }

  async getSlot() {
    const slot = z
      .number()
      .int()
      .nonnegative()
      .parse(await this.request("getSlot", [{ commitment: this.config.commitment }]));
    return BigInt(slot);
  }

  async getSignatureStatus(signature: string) {
    const result = signatureStatusResponseSchema.parse(
      await this.request("getSignatureStatuses", [
        [signature],
        { searchTransactionHistory: true },
      ]),
    );
    return {
      contextSlot: BigInt(result.context.slot),
      status: result.value[0] ?? null,
    };
  }

  async getTransactionEvidence(signature: string) {
    return transactionEvidenceSchema.parse(
      await this.request("getTransaction", [
        signature,
        { commitment: this.config.commitment, maxSupportedTransactionVersion: 0 },
      ]),
    );
  }

  async checkHealth(): Promise<SolanaHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.config.endpoint) {
      return {
        status: "not_configured",
        cluster: this.config.cluster,
        commitment: this.config.commitment,
        checkedAt,
        safeError: "Set SOLANA_RPC_URL to enable RPC reads.",
      };
    }

    const startedAt = performance.now();
    try {
      const [health, genesisHash, slot] = await Promise.all([
        this.getHealth(),
        this.getGenesisHash(),
        this.getSlot(),
      ]);
      if (genesisHash !== SOLANA_GENESIS_HASHES[this.config.cluster]) {
        return {
          status: "cluster_mismatch",
          cluster: this.config.cluster,
          commitment: this.config.commitment,
          checkedAt,
          latencyMs: Math.round(performance.now() - startedAt),
          safeError: "The RPC genesis hash does not match the configured cluster.",
        };
      }
      return {
        status: health === "ok" ? "healthy" : "unhealthy",
        cluster: this.config.cluster,
        commitment: this.config.commitment,
        slot,
        checkedAt,
        latencyMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        cluster: this.config.cluster,
        commitment: this.config.commitment,
        checkedAt,
        latencyMs: Math.round(performance.now() - startedAt),
        safeError:
          error instanceof SolanaRpcError
            ? error.message
            : "Solana RPC health check failed.",
      };
    }
  }
}
