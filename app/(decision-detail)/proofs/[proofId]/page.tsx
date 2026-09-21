import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ProofReceiptView } from "@/components/proofs/proof-receipt-view";
import { demoProof } from "@/fixtures/demo-proof";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { verifyProofReceipt } from "@/lib/proofs/receipt";
import { projectProofTimeline } from "@/lib/proofs/timeline";
import { loadProof } from "@/lib/services/decision-records";

export const metadata: Metadata = { title: "Proof receipt" };

const DEMO_NOTE =
  "This is a deterministic demo receipt, not an onchain transaction. It has no signature, paid fees, independent authorship attestation, or claim of financial performance.";

async function loadStoredProof(proofId: string) {
  if (!env.databaseUrl) return null;
  // Public Atlas receipts open without a session; owner receipts need the
  // owner's session and anything else is an indistinguishable 404.
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  return loadProof(proofId, { ownerWallet: session?.wallet }, getDatabase());
}

export default async function ProofDetailPage({
  params,
}: PageProps<"/proofs/[proofId]">) {
  const { proofId } = await params;

  if (proofId === demoProof.id) {
    return (
      <ProofReceiptView
        title={demoProof.title}
        document={demoProof.document}
        receiptHash={demoProof.receiptHash}
        verification={verifyProofReceipt(demoProof.document, demoProof.receiptHash)}
        timeline={demoProof.timeline}
        origin={{ label: "demo", note: DEMO_NOTE }}
      />
    );
  }

  const stored = await loadStoredProof(proofId);
  // This segment has no loading boundary above it, so this is a real HTTP 404.
  if (!stored) notFound();

  const { receipt } = stored;
  const timeline = projectProofTimeline({
    mode: receipt.mode,
    snapshot: {
      capturedAt: receipt.portfolio.document.capturedAt,
      hash: receipt.portfolio.hash,
      source: receipt.portfolio.document.source,
    },
    decision: {
      createdAt: receipt.decision.context.requestedAt,
      hash: receipt.decision.hash,
      action: receipt.decision.proposal.action,
    },
    evaluation: {
      evaluatedAt: receipt.generatedAt,
      approved: receipt.policyEvaluation.approved,
      inputHash: receipt.policyEvaluation.inputHash,
    },
    execution: {
      timestamp: stored.finalizedAt,
      state: receipt.execution.state,
      signature: receipt.execution.transactionSignature,
    },
  });

  return (
    <ProofReceiptView
      title={`${stored.agent.name} · ${receipt.decision.proposal.action} receipt`}
      document={receipt}
      receiptHash={stored.receiptHash}
      verification={stored.verification}
      timeline={timeline}
      origin={{
        label: `stored ${receipt.mode} simulation`,
        note:
          stored.visibility === "public"
            ? `Stored public Atlas receipt, generated ${stored.finalizedAt} and read back from the database. It is offchain integrity evidence only: no wallet signed anything, no fees were paid and no onchain transaction exists. The portfolio it references is a labelled demo fixture.`
            : `Stored demo simulation receipt for the connected wallet, generated ${stored.finalizedAt}. It is offchain integrity evidence only: no signature, no paid fees and no onchain transaction. The portfolio it references is a labelled demo fixture.`,
      }}
      links={{
        decisionHref: `/decisions/${stored.decisionId}`,
        agentHref: `/agents/${stored.agent.slug}`,
        agentName: stored.agent.name,
      }}
    />
  );
}
