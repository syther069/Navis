"use client";

import { Check, FileText, Play, ShieldCheck, SealCheck } from "@phosphor-icons/react";
import { useState } from "react";

const steps = [
  { label: "Review proposal", detail: "Inspect Atlas’s deterministic proposal and the bounded trade amount.", icon: FileText },
  { label: "Evaluate policy", detail: "Run the policy checks before any wallet authority is involved.", icon: ShieldCheck },
  { label: "Simulate execution", detail: "Record the outcome in demo mode. No transaction is built or sent.", icon: Play },
  { label: "Verify receipt", detail: "Open the hash-verifiable receipt and confirm the full decision trail.", icon: SealCheck },
] as const;

export function DemoWorkflow() {
  const [currentStep, setCurrentStep] = useState(0);
  const complete = currentStep === steps.length - 1;
  const CurrentIcon = steps[currentStep].icon;

  return (
    <section className="demo-workflow" aria-labelledby="demo-workflow-title">
      <div className="demo-workflow-heading">
        <div>
          <span className="section-kicker">Guided demo</span>
          <h2 id="demo-workflow-title">Test the Navis control loop</h2>
          <p>Walk through a complete decision without connecting a wallet or moving funds.</p>
        </div>
        <span className="demo-workflow-badge">Local simulation</span>
      </div>
      <ol className="demo-workflow-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <li key={step.label} data-active={active || undefined} data-done={done || undefined}>
              <button type="button" onClick={() => setCurrentStep(index)} aria-current={active ? "step" : undefined}>
                <span className="demo-workflow-step-icon">
                  {done ? <Check size={15} weight="bold" /> : <Icon size={15} />}
                </span>
                <span>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="demo-workflow-status" data-complete={complete || undefined}>
        <span className="demo-workflow-status-icon"><CurrentIcon size={18} /></span>
        <div>
          <strong>{complete ? "Receipt verified" : steps[currentStep].label}</strong>
          <p>{complete ? "The deterministic demo is complete. Review the prepared record or run it again." : steps[currentStep].detail}</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => setCurrentStep(complete ? 0 : currentStep + 1)}>
          {complete ? "Run again" : "Continue"}
        </button>
      </div>
    </section>
  );
}
