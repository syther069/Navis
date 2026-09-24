import { verifyProofReceipt } from "@/lib/proofs/receipt";
import type { DecisionRunResult } from "./types";

export type ReceiptIntegrity = ReturnType<typeof verifyProofReceipt>;

/**
 * Use the same complete verifier as the proof page. Its canonical SHA-256
 * implementation is browser-safe; no server crypto or partial verification
 * algorithm is needed. Keep the asynchronous interface used by the UI.
 */
export async function checkReceiptIntegrity(run: Pick<DecisionRunResult, "receipt" | "receiptHash">): Promise<ReceiptIntegrity> {
  return verifyProofReceipt(run.receipt, run.receiptHash);
}