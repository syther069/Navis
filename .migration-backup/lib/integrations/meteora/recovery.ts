export type MeteoraRecoveryVerification =
  "protocol_verified" | "signature_confirmed" | "evidence_incomplete";

export type SavedMeteoraLaunch = {
  id: string;
  agentId: string;
  cluster: string;
  status: string;
  phase: "config" | "pool";
  transactionSignature: string | null;
  configSignature: string | null;
  configAddress: string | null;
  baseMint: string | null;
  poolAddress: string | null;
  configVerification: MeteoraRecoveryVerification | null;
  poolVerification: MeteoraRecoveryVerification | null;
};

export type MeteoraRecoveryLaunchRow = {
  id: string;
  agentId: string;
  cluster: string;
  status: string;
  transactionSignature: string | null;
  baseMint: string | null;
  poolAddress: string | null;
  metadata: unknown;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function verificationLabel(value: unknown): MeteoraRecoveryVerification | null {
  const label = objectValue(value)?.label;
  return label === "protocol_verified" ||
    label === "signature_confirmed" ||
    label === "evidence_incomplete"
    ? label
    : null;
}

export function projectSavedMeteoraLaunch(
  row: MeteoraRecoveryLaunchRow,
): SavedMeteoraLaunch {
  const metadata = objectValue(row.metadata);
  const poolValue = metadata?.pool;
  const pool = objectValue(poolValue);
  const phase =
    (metadata !== null && Object.prototype.hasOwnProperty.call(metadata, "pool")) ||
    row.status.startsWith("pool_")
      ? "pool"
      : "config";

  return {
    id: row.id,
    agentId: row.agentId,
    cluster: row.cluster,
    status: row.status,
    phase,
    transactionSignature: row.transactionSignature,
    configSignature:
      phase === "pool"
        ? nullableString(metadata?.configTransactionSignature)
        : row.transactionSignature,
    configAddress: nullableString(metadata?.config),
    baseMint: row.baseMint,
    poolAddress: row.poolAddress,
    configVerification: verificationLabel(metadata?.confirmation),
    poolVerification: verificationLabel(pool?.confirmation),
  };
}
