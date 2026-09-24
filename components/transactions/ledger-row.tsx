import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

import { AddressValue } from "@/components/shared/address-value";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { InfoHint } from "@/components/shared/info-hint";
import { TransactionStateBadge } from "@/components/shared/transaction-state";
import { assuranceForExecution } from "@/lib/assurance";
import type { executionAttempts, marketLaunches } from "@/lib/db/schema";
import type { TradeProposal } from "@/lib/domain";
import { summarizeMeteoraLaunchEvidence } from "@/lib/services/meteora-reconciliation";

import { transactionStateForRecord } from "./transaction-presentation";

type Execution = typeof executionAttempts.$inferSelect;
type Launch = typeof marketLaunches.$inferSelect;

export type ExecutionLedgerRecord = Pick<
  Execution,
  | "id"
  | "state"
  | "cluster"
  | "transactionSignature"
  | "submittedAt"
  | "confirmedAt"
  | "slot"
  | "feeLamports"
  | "errorCode"
  | "safeError"
  | "createdAt"
> & {
  decisionHash: string;
  proposal: TradeProposal;
  agentMode: "demo" | "devnet" | "mainnet";
};

export type LaunchLedgerRecord = Pick<
  Launch,
  | "id"
  | "provider"
  | "status"
  | "cluster"
  | "providerRequestId"
  | "baseMint"
  | "quoteMint"
  | "poolAddress"
  | "payoutWallet"
  | "transactionSignature"
  | "metadata"
  | "createdAt"
  | "updatedAt"
> & { agentName: string; agentSlug: string };

function date(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(value)
    : null;
}

function explorer(signature: string, cluster: Execution["cluster"]) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}

function Unavailable({ reason }: { reason: string }) {
  return (
    <span className="unavailable" aria-label={`Unavailable: ${reason}`} title={reason}>
      —
    </span>
  );
}

function SignatureField({
  signature,
  cluster,
  submitted,
}: {
  signature: string | null;
  cluster: Execution["cluster"];
  submitted: boolean;
}) {
  if (!signature) return <Unavailable reason="No transaction signature recorded" />;
  return (
    <span className="transaction-signature">
      <AddressValue
        value={signature}
        label="transaction signature"
        href={submitted ? explorer(signature, cluster) : undefined}
      />
      {submitted ? (
        <a
          className="transaction-explorer"
          href={explorer(signature, cluster)}
          target="_blank"
          rel="noreferrer"
        >
          Explorer <ArrowSquareOut aria-hidden="true" size={13} />
        </a>
      ) : null}
    </span>
  );
}

export function ExecutionLedgerRow({ row }: { row: ExecutionLedgerRecord }) {
  const state = transactionStateForRecord("execution", row.state);
  const submitted =
    row.state === "submitted" ||
    row.state === "unknown_pending" ||
    row.state === "confirmed" ||
    (row.submittedAt !== null && row.state === "failed");
  const proposal = row.proposal;
  return (
    <article className="transaction-entry" data-testid="execution-ledger-row">
      <div className="transaction-entry-main">
        <div className="transaction-entry-identity">
          <span className="transaction-entry-date">{date(row.createdAt)}</span>
          <h3>{proposal.action.replaceAll("_", " ")}</h3>
          <span className="transaction-entry-sub">
            Execution attempt · {row.cluster}
          </span>
        </div>
        <div className="transaction-entry-status">
          {state ? (
            <TransactionStateBadge state={state} />
          ) : (
            <span className="transaction-unmapped">Recorded: {row.state}</span>
          )}
          <AssuranceBadge
            assurance={assuranceForExecution({
              state: row.state,
              transactionSignature: row.transactionSignature,
              mode: row.agentMode,
            })}
          />
        </div>
        <div className="transaction-entry-measure">
          <span>Asset / amount</span>
          {proposal.action !== "HOLD" ? (
            <strong className="num">
              {proposal.inputAmount.uiAmount}{" "}
              <AddressValue value={proposal.inputMint} label="input asset mint" />
            </strong>
          ) : (
            <Unavailable reason="No value-moving asset or amount in this proposal" />
          )}
        </div>
        <div className="transaction-entry-measure">
          <span>Fee</span>
          {row.feeLamports !== null ? (
            <strong className="num">{row.feeLamports} lamports</strong>
          ) : (
            <Unavailable reason="No network fee recorded" />
          )}
        </div>
      </div>
      {row.safeError ? (
        <p className="transaction-entry-error">{row.safeError}</p>
      ) : null}
      <details className="tech-disclosure transaction-details">
        <summary>Record details</summary>
        <div className="tech-disclosure-body">
          <dl className="transaction-detail-grid">
            <div>
              <dt>Network</dt>
              <dd>{row.cluster}</dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>
                <Unavailable reason="Execution attempt does not store a wallet address" />
              </dd>
            </div>
            <div>
              <dt>
                Signature <InfoHint topic="signature" />
              </dt>
              <dd>
                <SignatureField
                  signature={row.transactionSignature}
                  cluster={row.cluster}
                  submitted={submitted}
                />
              </dd>
            </div>
            <div>
              <dt>Decision ID</dt>
              <dd>
                <AddressValue value={row.decisionHash} label="decision hash" />
              </dd>
            </div>
            <div>
              <dt>Attempt ID</dt>
              <dd>
                <AddressValue value={row.id} label="attempt ID" />
              </dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>
                {date(row.submittedAt) ?? (
                  <Unavailable reason="Not submitted or submission time not recorded" />
                )}
              </dd>
            </div>
            <div>
              <dt>Confirmed</dt>
              <dd>
                {date(row.confirmedAt) ?? (
                  <Unavailable reason="No confirmation time recorded" />
                )}
              </dd>
            </div>
            <div>
              <dt>Slot</dt>
              <dd>
                {row.slot !== null ? (
                  row.slot.toString()
                ) : (
                  <Unavailable reason="No confirmed slot recorded" />
                )}
              </dd>
            </div>
            {row.errorCode ? (
              <div>
                <dt>Error code</dt>
                <dd>{row.errorCode}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </details>
    </article>
  );
}

export function LaunchLedgerRow({ row }: { row: LaunchLedgerRecord }) {
  const state = transactionStateForRecord("launch", row.status);
  const evidence = summarizeMeteoraLaunchEvidence(row.status, row.metadata);
  const submitted = [
    "submitted",
    "pool_submitted",
    "unknown_pending",
    "pool_unknown_pending",
    "signature_confirmed",
    "pool_signature_confirmed",
    "confirmed",
    "pool_confirmed",
  ].includes(row.status);
  return (
    <article className="transaction-entry" data-testid="launch-ledger-row">
      <div className="transaction-entry-main">
        <div className="transaction-entry-identity">
          <span className="transaction-entry-date">{date(row.createdAt)}</span>
          <h3>
            {row.provider} · {row.agentSlug}
          </h3>
          <span className="transaction-entry-sub">Market launch · {row.cluster}</span>
        </div>
        <div className="transaction-entry-status">
          {state ? (
            <TransactionStateBadge state={state} />
          ) : (
            <span className="transaction-unmapped">Recorded: {row.status}</span>
          )}
          <small>Provider status: {row.status.replaceAll("_", " ")}</small>
        </div>
        <div className="transaction-entry-measure">
          <span>Asset</span>
          {row.baseMint ? (
            <AddressValue value={row.baseMint} label="base mint" />
          ) : (
            <Unavailable reason="Base mint not recorded" />
          )}
        </div>
        <div className="transaction-entry-measure">
          <span>Fee</span>
          {evidence?.feeLamports != null ? (
            <strong className="num">{evidence.feeLamports} lamports</strong>
          ) : (
            <Unavailable reason="Network fee not recorded" />
          )}
        </div>
      </div>
      <details className="tech-disclosure transaction-details">
        <summary>Record details</summary>
        <div className="tech-disclosure-body">
          <dl className="transaction-detail-grid">
            <div>
              <dt>Network</dt>
              <dd>{row.cluster}</dd>
            </div>
            <div>
              <dt>Payout wallet</dt>
              <dd>
                {row.payoutWallet ? (
                  <AddressValue value={row.payoutWallet} label="payout wallet" />
                ) : (
                  <Unavailable reason="Payout wallet not recorded" />
                )}
              </dd>
            </div>
            <div>
              <dt>
                Signature <InfoHint topic="signature" />
              </dt>
              <dd>
                <SignatureField
                  signature={row.transactionSignature}
                  cluster={row.cluster}
                  submitted={submitted}
                />
              </dd>
            </div>
            <div>
              <dt>Launch ID</dt>
              <dd>
                <AddressValue value={row.id} label="launch ID" />
              </dd>
            </div>
            {row.providerRequestId ? (
              <div>
                <dt>Provider request</dt>
                <dd>
                  <AddressValue
                    value={row.providerRequestId}
                    label="provider request ID"
                  />
                </dd>
              </div>
            ) : null}
            {row.quoteMint ? (
              <div>
                <dt>Quote mint</dt>
                <dd>
                  <AddressValue value={row.quoteMint} label="quote mint" />
                </dd>
              </div>
            ) : null}
            {row.poolAddress ? (
              <div>
                <dt>Pool</dt>
                <dd>
                  <AddressValue value={row.poolAddress} label="pool address" />
                </dd>
              </div>
            ) : null}
            {evidence?.slot != null ? (
              <div>
                <dt>Evidence slot</dt>
                <dd>{evidence.slot}</dd>
              </div>
            ) : null}
            {evidence?.label ? (
              <div>
                <dt>Confirmation evidence</dt>
                <dd>{evidence.label.replaceAll("_", " ")}</dd>
              </div>
            ) : null}
            <div>
              <dt>Amount</dt>
              <dd>
                <Unavailable reason="Market launch record does not store a transaction amount" />
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </article>
  );
}
