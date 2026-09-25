import type { Metadata } from "next";

import { FaqSection } from "@/components/landing/faq-section";
import { RouteHeader } from "@/components/route-primitives";
import { getPublicCapabilities } from "@/lib/env";

export const metadata: Metadata = {
  title: "Frequently Asked Questions · Navis",
  description:
    "Plain-language, honest answers about NAVIS: core architecture, deterministic policy constraints, non-custodial wallet authority, simulation boundaries, and proof verification.",
};

export default function FaqPage() {
  const capabilities = getPublicCapabilities();

  return (
    <>
      <RouteHeader
        eyebrow="Questions & Safety Invariants"
        title="Frequently Asked Questions"
        description="Clear, honest answers about NAVIS architecture, real versus simulated integrations, zero-custody wallet boundaries, and cryptographic proof verification."
        meta={`${capabilities.mode} mode · ${capabilities.cluster}`}
      />

      <section className="route-panel faq-page-panel" aria-label="FAQ Knowledge Base">
        <FaqSection defaultFilter="all" />
      </section>
    </>
  );
}
