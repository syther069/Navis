import Link from "next/link";

import { DemoWorkflow } from "@/components/agent/demo-workflow";

export default function DemoWorkflowPage() {
  return (
    <main className="demo-page">
      <style>{`
        .demo-page{min-height:100dvh;background:var(--canvas);color:var(--text-primary);padding:64px 24px;font-family:var(--font-ui)}
        .demo-page-inner{max-width:920px;margin:0 auto}.demo-page .text-link{display:inline-block;margin-bottom:32px}
        .demo-workflow{display:grid;gap:20px;border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:24px}
        .demo-workflow-heading,.demo-workflow-status{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .demo-workflow-heading h2{margin:8px 0 4px;font-size:1.25rem;letter-spacing:-.02em}.demo-workflow-heading p,.demo-workflow-status p{margin:0;color:var(--text-secondary);font-size:.875rem;line-height:1.55}
        .demo-workflow-badge{border:1px solid #806fe0;border-radius:999px;background:#27203f;color:#c4bbf0;padding:5px 10px;font-size:.75rem;font-weight:600;white-space:nowrap}
        .demo-workflow-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}.demo-workflow-steps button{display:flex;width:100%;align-items:center;gap:8px;border:0;border-top:2px solid var(--border);background:transparent;color:var(--text-muted);padding:12px 0 0;font:inherit;font-size:.8rem;text-align:left}.demo-workflow-steps li[data-active] button,.demo-workflow-steps li[data-done] button{border-color:var(--accent);color:var(--text-primary)}.demo-workflow-step-icon{display:grid;width:24px;height:24px;flex:0 0 auto;place-items:center;border:1px solid currentColor;border-radius:50%}
        .demo-workflow-status{align-items:center;border:1px solid var(--border-strong);border-radius:10px;background:var(--canvas-subtle);padding:12px 16px}.demo-workflow-status-icon{display:grid;width:32px;height:32px;flex:0 0 auto;place-items:center;border-radius:50%;background:#172f4b;color:#91c2ff}.demo-workflow-status>div{min-width:0;flex:1}.demo-workflow-status strong{display:block;margin-bottom:3px;font-size:.8rem}.secondary-button{min-height:40px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface-raised);color:var(--text-primary);padding:0 14px;font-weight:600}
        @media(max-width:700px){.demo-workflow-heading,.demo-workflow-status{align-items:stretch;flex-direction:column}.demo-workflow-steps{grid-template-columns:1fr 1fr}.demo-workflow-status .secondary-button{width:100%}}
      `}</style>
      <div className="demo-page-inner">
        <Link href="/agents/atlas" className="text-link">Back to Atlas</Link>
        <DemoWorkflow />
      </div>
    </main>
  );
}
