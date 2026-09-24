import { LockKey, ShieldCheck, WarningCircle } from "@phosphor-icons/react/dist/ssr";

import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import type { MeteoraCurvePreview } from "@/lib/integrations/meteora/config";

import type { MeteoraQuoteProfileAvailability } from "@/lib/integrations/meteora/quote-profiles";

import { MeteoraConfigPrepare } from "./meteora-config-prepare";
import { MeteoraPoolMonitor } from "./meteora-pool-monitor";

export function MeteoraCurvePanel({
  previews,
  profiles,
  prestocksSymbols,
  rpcConfigured,
  executionEnabled,
  cluster,
  broadcastAvailable,
  broadcastBlockedReason,
  agents,
}: {
  /** One preview per server-approved quote profile for the active cluster. */
  previews: readonly MeteoraCurvePreview[];
  profiles: readonly MeteoraQuoteProfileAvailability[];
  prestocksSymbols: readonly { symbol: string; name: string }[];
  rpcConfigured: boolean;
  executionEnabled: boolean;
  /** Active cluster; used for wallet readiness copy and explorer links. */
  cluster: string;
  /** Server-side broadcast gate result for this deployment. */
  broadcastAvailable: boolean;
  broadcastBlockedReason: string;
  agents: readonly {
    id: string;
    name: string;
    mode: string;
    cluster: string;
  }[];
}) {
  const preview = previews[0];
  if (!preview) return null;
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
        Navis prepares DBC configs only from server-approved quote profiles. Clients
        pick a profile id; the server resolves and verifies the quote mint. This preview
        is configuration evidence only; it is not a claim that any token represents
        legal equity, and no config, mint, pool, or transaction signature exists until
        wallet execution confirms onchain.
      </p>

      <div className="meteora-profiles">
        {previews.map((item) => (
          <article
            key={item.profileId}
            className="meteora-profile-card"
            aria-labelledby={`meteora-profile-${item.profileId}`}
          >
            <div className="meteora-profile-heading">
              <div>
                <span className="route-eyebrow">{item.profileLabel}</span>
                <h3 id={`meteora-profile-${item.profileId}`}>
                  <code>{item.profileId}</code>
                </h3>
              </div>
              <StatusBadge
                tone={
                  item.availability.status === "available" ? "active" : "simulation"
                }
              >
                {item.availability.status === "available"
                  ? `Available on ${item.cluster}`
                  : item.availability.status === "gated"
                    ? `Gated on ${item.cluster}`
                    : `Unavailable on ${item.cluster}`}
              </StatusBadge>
            </div>
            <p className="route-copy">{item.rationale.summary}</p>
            <p className="form-note">{item.availability.reason}</p>
            <dl className="meteora-rationale">
              <div>
                <dt>Price band</dt>
                <dd>
                  {item.rationale.priceBand} Threshold{" "}
                  {item.pricing.migrationQuoteThreshold} {item.quoteUnit} (
                  {item.pricing.migrationQuoteThresholdRaw} raw units,{" "}
                  {item.token.quoteDecimals} quote decimals).
                </dd>
              </div>
              <div>
                <dt>Fee schedule</dt>
                <dd>{item.rationale.feeSchedule}</dd>
              </div>
              <div>
                <dt>Graduation</dt>
                <dd>{item.rationale.graduation}</dd>
              </div>
              <div>
                <dt>Locked liquidity</dt>
                <dd>{item.rationale.lockedLiquidity}</dd>
              </div>
              <div>
                <dt>Issuer and treasury</dt>
                <dd>{item.rationale.issuerAndTreasury}</dd>
              </div>
              <div>
                <dt>Quote mint</dt>
                <dd>
                  {item.quoteMint ? (
                    <AddressValue value={item.quoteMint} label="wrapped SOL mint" />
                  ) : (
                    "Resolved per request from the live PreStocks catalogue and checked onchain (token program, decimals, Meteora token badge); never a constant and never a substitute mint."
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="meteora-metrics">
        <article>
          <span>Market cap path</span>
          <strong>
            {preview.pricing.initialMarketCapQuote} {preview.quoteUnit} to{" "}
            {preview.pricing.migrationMarketCapQuote} {preview.quoteUnit}
          </strong>
          <small>DBC launch to migration ({preview.profileId})</small>
        </article>
        <article>
          <span>Migration threshold</span>
          <strong>
            {preview.pricing.migrationQuoteThreshold} {preview.quoteUnit}
          </strong>
          <small>{preview.pricing.migrationQuoteThresholdRaw} raw quote units</small>
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
          {preview.quoteMint ? (
            <AddressValue value={preview.quoteMint} label="wrapped SOL mint" />
          ) : (
            <code>resolved per request</code>
          )}
          <span>Profiles</span>
          <code>{previews.map((item) => item.profileId).join(", ")}</code>
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
        <MeteoraConfigPrepare
          executionEnabled={executionEnabled}
          cluster={cluster}
          broadcastAvailable={broadcastAvailable}
          broadcastBlockedReason={broadcastBlockedReason}
          agents={agents}
          profiles={profiles}
          prestocksSymbols={prestocksSymbols}
        />
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
