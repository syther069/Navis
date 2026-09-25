import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { RouteHeader } from "@/components/route-primitives";
import { getPublicCapabilities } from "@/lib/env";

export const metadata: Metadata = {
  title: "Onboarding Orientation · Navis",
  description:
    "Lightweight orientation guide for NAVIS: connect wallet, understand workspace, inspect markets, view Atlas decisions, review policy, and verify proof receipts.",
};

export default function OnboardingPage() {
  const capabilities = getPublicCapabilities();

  return (
    <>
      <RouteHeader
        eyebrow="Orientation Guide"
        title="NAVIS Operational Walkthrough"
        description="A lightweight 8-step orientation explaining how mandates, risk policies, user authorization, and cryptographic proofs interact."
        meta={`${capabilities.mode} mode · ${capabilities.cluster}`}
      />

      <section className="onboarding-page-section" aria-label="Onboarding flow">
        <OnboardingFlow />
      </section>
    </>
  );
}
