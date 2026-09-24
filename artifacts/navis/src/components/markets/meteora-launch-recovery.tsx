"use client";

import { useState } from "react";

import type { SavedMeteoraLaunch } from "@/lib/integrations/meteora/recovery";

export function MeteoraLaunchRecovery({
  disabled,
  cluster,
  onResume,
}: {
  disabled: boolean;
  cluster: string;
  onResume: (launch: SavedMeteoraLaunch) => void;
}) {
  const [launches, setLaunches] = useState<SavedMeteoraLaunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/meteora/launches", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Saved launches could not be loaded.");
      }
      if (!Array.isArray(body.launches)) {
        throw new Error("The saved launch response was invalid.");
      }
      setLaunches(
        body.launches.filter((row: SavedMeteoraLaunch) => row.cluster === cluster),
      );
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recovery failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="meteora-submit-review"
      aria-label="Recover a saved Meteora launch"
    >
      <h3>Continue an existing launch</h3>
      <p className="form-note">
        After a refresh, expiry or uncertain submission, load your saved launch before
        creating another config. Recovery never signs or broadcasts a transaction.
      </p>
      <button
        type="button"
        className="secondary-button"
        disabled={disabled || loading}
        onClick={() => void load()}
      >
        {loading ? "Loading saved launches" : "Load saved launches"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loaded && launches.length === 0 ? (
        <p className="form-note">
          No saved Meteora launches for this signed-in wallet.
        </p>
      ) : null}
      {launches.map((launch) => (
        <div className="meteora-submit-review" key={launch.id}>
          <p>
            {launch.status} · {launch.cluster}
          </p>
          <p className="form-note">Config: {launch.configAddress ?? "Not recorded"}</p>
          <button
            type="button"
            className="secondary-button"
            disabled={disabled || loading}
            onClick={() => onResume(launch)}
          >
            {launch.phase === "config" &&
            launch.status === "confirmed" &&
            launch.configVerification === "protocol_verified"
              ? "Resume pool creation"
              : "Resume confirmation"}
          </button>
        </div>
      ))}
    </section>
  );
}
