import { LockKey, ShieldCheck, WarningCircle } from "@phosphor-icons/react/dist/ssr";

import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import type { MeteoraCurvePreview } from "@/lib/integrations/meteora/config";

import { MeteoraConfigPrepare } from "./meteora-config-prepare";
import { MeteoraPoolMonitor } from "./meteora-pool-monitor";

export function MeteoraCurvePanel({
  preview,
  rpcConfigured,
  executionEnabled,
  agents,
}: {
  preview: MeteoraCurvePreview;
  rpcConfigured: boolean;
  executionEnabled: boolean;
  agents: readonly {
    id: string;
    name: string;
    mode: string;
    cluster: string;
  }[];
}) {
  return (
    <section className="route-panel meteora-panel" aria-labelledby="meteora-title">
      <div className="meteora-panel-heading">
        <div className="panel-heading">
          <ShieldCheck aria-hidden="true" size={20} />
          <div>
            <span>Meteora DBC</span>
            <h2 id="meteora-title">Validated bonding curve profile</h2>
          </div>
        </div>
        <div className="meteora-heading-stamps">
          <StatusBadge tone="simulation">Not deployed</StatusBadge>
          <SourceStamp source={`SDK ${preview.sdkVersion}`} state="available" />
        </div>
      </div>

      <p className="route-copy">
        Navis can prepare a conservative SOL-quoted DBC profile for equity-themed
        community assets. This preview is configuration evidence only; it is not a claim
        that the token represents legal equity, and no config, mint, pool, or
        transaction signature exists until wallet execution confirms onchain.
      </p>

      <div className="meteora-metrics">
        <article>
          <span>Market cap path</span>
          <strong>
            {preview.pricing.initialMarketCapSol} SOL to{" "}
            {preview.pricing.migrationMarketCapSol} SOL
          </strong>
          <small>DBC launch to migration</small>
        </article>
        <article>
          <span>Migration threshold</span>
          <strong>{preview.pricing.migrationQuoteThresholdSol} SOL</strong>
          <small>{preview.pricing.migrationQuoteThresholdLamports} lamports</small>
        </article>
        <article>
          <span>Trading fee</span>
          <strong>{preview.fees.baseTradingFeeBps / 100}%</strong>
          <small>
            {preview.fees.dynamicFeeEnabled ? "Dynamic fee enabled" : "Static fee"}
          </small>
        </article>
        <article>
          <span>Permanent LP lock</span>
          <strong>{preview.migration.totalPermanentlyLockedPercent}%</strong>
          <small>{preview.migration.destination}</small>
        </article>
      </div>

      <div className="meteora-config-grid">
        <dl>
          <div>
            <dt>Token standard</dt>
            <dd>{preview.token.standard}</dd>
          </div>
          <div>
            <dt>Supply</dt>
            <dd>{preview.token.totalSupply}</dd>
          </div>
          <div>
            <dt>Leftover supply</dt>
            <dd>{preview.token.leftover}</dd>
          </div>
          <div>
            <dt>Decimals</dt>
            <dd>
              {preview.token.baseDecimals} base / {preview.token.quoteDecimals} quote
            </dd>
          </div>
          <div>
            <dt>Authority</dt>
            <dd>{preview.token.authority}</dd>
          </div>
          <div>
            <dt>Creator trading share</dt>
            <dd>{preview.fees.creatorTradingFeeSharePercent}%</dd>
          </div>
          <div>
            <dt>Base fee schedule</dt>
            <dd>
              {preview.fees.baseFeeMode}: {preview.fees.baseTradingFeeBps} to{" "}
              {preview.fees.endingTradingFeeBps} bps over {preview.fees.feePeriods}{" "}
              periods / {preview.fees.feeDurationSeconds} seconds
            </dd>
          </div>
          <div>
            <dt>Fee collection</dt>
            <dd>
              {preview.fees.collectedIn}; pool creation fee{" "}
              {preview.fees.poolCreationFeeLamports} lamports; first-swap minimum{" "}
              {preview.fees.firstSwapMinimumFeeEnabled ? "enabled" : "disabled"}
            </dd>
          </div>
          <div>
            <dt>Migration fee</dt>
            <dd>
              {preview.fees.migrationFeePercent}% with{" "}
              {preview.fees.creatorMigrationFeeSharePercent}% creator share
            </dd>
          </div>
          <div>
            <dt>LP distribution</dt>
            <dd>
              Partner {preview.migration.partnerClaimablePercent}% claimable /{" "}
              {preview.migration.partnerPermanentlyLockedPercent}% locked, creator{" "}
              {preview.migration.creatorClaimablePercent}% claimable /{" "}
              {preview.migration.creatorPermanentlyLockedPercent}% locked
            </dd>
          </div>
          <div>
            <dt>Activation</dt>
            <dd>{preview.activation.type}</dd>
          </div>
          <div>
            <dt>Locked vesting</dt>
            <dd>
              {preview.vesting.totalLockedAmount} locked /{" "}
              {preview.vesting.cliffUnlockAmount} cliff unlock /{" "}
              {preview.vesting.periods} periods / {preview.vesting.totalDurationSeconds}
              s duration / {preview.vesting.cliffDurationSeconds}s cliff
            </dd>
          </div>
        </dl>

        <div className="meteora-addresses">
          <span>Program evidence</span>
          <AddressValue value={preview.programId} label="Meteora DBC program" />
          <span>Quote mint</span>
          <AddressValue value={preview.quoteMint} label="wrapped SOL mint" />
          <span>Profile</span>
          <code>{preview.profileId}</code>
        </div>
      </div>

      <div className="meteora-execution-gate">
        <LockKey aria-hidden="true" size={18} />
        <div>
          <strong>Transaction builder is review-first.</strong>
          <p>
            Navis prepares an unsigned config transaction for review before any wallet
            signature. Pool creation, simulation, submission, and persistence stay
            separate.
          </p>
        </div>
        <MeteoraConfigPrepare executionEnabled={executionEnabled} agents={agents} />
      </div>

      <div className="meteora-monitor-section">
        <div>
          <span className="route-eyebrow">Onchain read</span>
          <h3>Pool monitor</h3>
          <p>
            Paste a confirmed DBC base mint to read pool progress from the configured
            RPC. Missing pools stay explicit.
          </p>
        </div>
        <MeteoraPoolMonitor rpcConfigured={rpcConfigured} />
      </div>

      {!executionEnabled ? (
        <div className="form-error" role="status">
          <WarningCircle aria-hidden="true" size={16} />
          <span>
            Execution mode, RPC, and wallet funding must be ready before Navis enables
            Meteora transaction preparation.
          </span>
        </div>
      ) : null}
    </section>
  );
}
