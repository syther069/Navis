import type { Metadata } from "next";

import { getPublicCapabilities } from "@/lib/env";

import { StartJourney } from "./start-journey";

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Eight optional steps to explore the NAVIS workspace, Atlas decisions, policy checks and proof receipts.",
};

export default function StartPage() {
  const capabilities = getPublicCapabilities();
  return (
    <StartJourney
      cluster={capabilities.cluster}
      authenticationConfigured={
        capabilities.walletAuthenticationConfigured &&
        capabilities.persistenceConfigured
      }
    />
  );
}
