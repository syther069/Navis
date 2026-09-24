export function describeClawPump(data: {configured: boolean; verification: any}) {
  if (!data.configured) return {
    value: "Provider not configured",
    detail: "Set CLAWPUMP_API_KEY, a cpk_ Partner key from clawpump.tech/developers, server-side only.",
  };
  const record = data.verification;
  if (!record) return {
    value: "Key present, not yet verified",
    detail: "No stored verification record. Open Markets to run a real read-only request.",
  };
  if (record.result === "connected") return {
    value: "Provider connected",
    detail: `GET ${record.endpoint} answered HTTP ${record.httpStatus} at ${record.providerTimestamp ?? record.checkedAt}, request ${record.requestId}. ${
      record.agentAccess === "forbidden"
        ? "GET /agents refused (HTTP 403): key not linked to an account, so agent operations are unavailable."
        : record.agentAccess === "unknown"
          ? "GET /agents did not answer; agent access not determined on this attempt."
          : `${record.agentCount} agent(s) under the key.`
    }`,
  };
  return {
    value: record.result === "unauthorised" ? "Key rejected" : "Provider unreachable",
    detail: `${record.safeError ?? "Verification failed."} Checked ${record.checkedAt}.`,
  };
}
const record = (value: unknown): Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const asString = (value: unknown) => typeof value === "string" ? value : null;
export function summarizeMeteoraLaunchEvidence(status: string, metadata: unknown) {
  const root = record(metadata);
  const source = status.startsWith("pool_") ? record(root.pool) : root;
  const confirmation = record(source.confirmation);
  if (Object.keys(confirmation).length === 0) return null;
  const signature = record(confirmation.signature);
  const protocol = record(confirmation.protocol);
  const checks = Array.isArray(protocol.checks) ? protocol.checks.map(record).map(check => ({
    field: String(check.field ?? ""), expected: asString(check.expected),
    actual: asString(check.actual), ok: check.ok === true,
  })) : [];
  const state = asString(confirmation.state) ?? "unknown";
  return {
    label: asString(confirmation.label) ?? state, state,
    checkedAt: asString(confirmation.checkedAt),
    slot: typeof signature.slot === "number" ? signature.slot : null,
    feeLamports: typeof signature.feeLamports === "number" ? signature.feeLamports : null,
    confirmedAt: asString(signature.confirmedAt), account: asString(protocol.address), checks,
  };
}