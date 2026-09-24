"use client";

import { useEffect, useState } from "react";

type SlotResponse =
  | { status: "ok"; cluster: string; slot: number; checkedAt: string }
  | { status: "not_configured"; cluster: string }
  | { status: "unreachable"; cluster: string };

type PulseState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; slot: number }
  | { kind: "error"; message: string };

export function DevnetPulse({
  configured,
  cluster,
}: {
  configured: boolean;
  cluster: string;
}) {
  const [state, setState] = useState<PulseState>(
    configured ? { kind: "loading" } : { kind: "idle" },
  );

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();

    fetch("/api/solana/slot", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as SlotResponse;
        if (body.status === "ok") {
          setState({ kind: "ok", slot: body.slot });
        } else if (body.status === "unreachable") {
          setState({ kind: "error", message: "RPC unreachable" });
        } else {
          setState({ kind: "idle" });
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setState({ kind: "error", message: "RPC read failed" });
      });

    return () => controller.abort();
  }, [configured]);

  const label = `${cluster} RPC`;

  if (state.kind === "idle") {
    return (
      <p className="navis-intro-pulse" data-state="idle">
        <span>{label}</span> not configured on this deployment. Read-only slot check is
        off.
      </p>
    );
  }

  if (state.kind === "loading") {
    return (
      <p className="navis-intro-pulse" data-state="loading" aria-live="polite">
        <span>{label}</span> reading current slot...
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <p className="navis-intro-pulse" data-state="error" aria-live="polite">
        <span>{label}</span> {state.message}. Nothing else on this page depends on it.
      </p>
    );
  }

  return (
    <p className="navis-intro-pulse" data-state="ok" aria-live="polite">
      <span>{label}</span> live read: slot {state.slot.toLocaleString("en-US")}. Read
      only, no transaction sent.
    </p>
  );
}
