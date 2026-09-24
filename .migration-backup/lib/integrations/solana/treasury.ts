import { z } from "zod";

import { solanaPublicKeySchema, type SolanaCluster } from "../../domain";
import { SolanaRpcClient } from "./rpc";

const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
] as const;

const rpcContextSchema = z.object({ slot: z.number().int().nonnegative() });
const nativeBalanceSchema = z.object({
  context: rpcContextSchema,
  value: z.number().int().nonnegative().safe(),
});
const tokenAccountsSchema = z.object({
  context: rpcContextSchema,
  value: z.array(
    z.object({
      pubkey: solanaPublicKeySchema,
      account: z.object({
        data: z.object({
          parsed: z.object({
            info: z.object({
              mint: solanaPublicKeySchema,
              owner: solanaPublicKeySchema,
              tokenAmount: z.object({
                amount: z.string().regex(/^\d+$/),
                decimals: z.number().int().min(0).max(18),
              }),
            }),
          }),
        }),
      }),
    }),
  ),
});

export type TreasuryBalance = Readonly<{
  kind: "native" | "spl-token";
  mint?: string;
  tokenAccount?: string;
  rawAmount: string;
  decimals: number;
  slot: bigint;
  program?: (typeof TOKEN_PROGRAMS)[number];
}>;

export type TreasuryBalanceRead = Readonly<{
  owner: string;
  cluster: SolanaCluster;
  commitment: "confirmed" | "finalized";
  source: "solana_rpc";
  capturedAt: string;
  balances: readonly TreasuryBalance[];
}>;

export async function readTreasuryBalances(
  client: SolanaRpcClient,
  ownerCandidate: string,
): Promise<TreasuryBalanceRead> {
  const owner = solanaPublicKeySchema.parse(ownerCandidate);
  const anchorSlot = await client.getSlot();
  if (anchorSlot > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Solana slot exceeds the safe JSON-RPC request range");
  }
  const minContextSlot = Number(anchorSlot);

  const [nativeResult, ...tokenResults] = await Promise.all([
    client.request("getBalance", [
      owner,
      { commitment: client.config.commitment, minContextSlot },
    ]),
    ...TOKEN_PROGRAMS.map((programId) =>
      client.request("getTokenAccountsByOwner", [
        owner,
        { programId },
        {
          commitment: client.config.commitment,
          minContextSlot,
          encoding: "jsonParsed",
        },
      ]),
    ),
  ]);

  const native = nativeBalanceSchema.parse(nativeResult);
  const balances: TreasuryBalance[] = [
    {
      kind: "native",
      rawAmount: String(native.value),
      decimals: 9,
      slot: BigInt(native.context.slot),
    },
  ];

  for (const [index, result] of tokenResults.entries()) {
    const program = TOKEN_PROGRAMS[index];
    const parsed = tokenAccountsSchema.parse(result);
    for (const token of parsed.value) {
      if (token.account.data.parsed.info.owner !== owner) {
        throw new Error("Solana RPC returned a token account for a different owner");
      }
      balances.push({
        kind: "spl-token",
        mint: token.account.data.parsed.info.mint,
        tokenAccount: token.pubkey,
        rawAmount: token.account.data.parsed.info.tokenAmount.amount,
        decimals: token.account.data.parsed.info.tokenAmount.decimals,
        slot: BigInt(parsed.context.slot),
        program,
      });
    }
  }

  return Object.freeze({
    owner,
    cluster: client.config.cluster,
    commitment: client.config.commitment,
    source: "solana_rpc",
    capturedAt: new Date().toISOString(),
    balances: Object.freeze(balances),
  });
}
