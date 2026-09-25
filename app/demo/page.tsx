import Link from "next/link";

import { DemoWorkflow } from "@/components/agent/demo-workflow";

export default function DemoPage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "64px 24px" }}>
      <Link href="/agents/atlas" className="text-link">
        Back to Atlas
      </Link>
      <div style={{ marginTop: 32 }}>
        <DemoWorkflow />
      </div>
    </main>
  );
}
