import { readFile } from "node:fs/promises";

const requiredFiles = [
  "LICENSE",
  "package.json",
  "README.md",
  "docs/EVIDENCE.md",
  "docs/INTEGRATIONS.md",
  "docs/DEMO_SCRIPT.md",
  "docs/SECURITY_REVIEW.md",
  "docs/DEPLOYMENT_RUNBOOK.md",
  "docs/SUBMISSION_DRAFT.md",
  "docs/ATTRIBUTIONS.md",
];

const evidenceRequiredLabels = [
  "Deployed demo URL",
  "Repository URL",
  "Demo video URL",
  "Live launch mint",
  "Live launch transaction",
  "Config transaction",
  "Pool transaction",
];

const requiredDisclosureText = [
  "not a brokerage",
  "economic exposure",
  "Demo receipts are simulations",
  "Risk, privacy, and eligibility disclosures are visible at `/disclosures`",
  "No live ClawPump or Meteora address should be claimed",
  "Open-source and sponsor resources are credited",
];

async function readRequiredFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    throw new Error(`Required submission file is missing or unreadable: ${path}`);
  }
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

const files = new Map();
for (const file of requiredFiles) {
  files.set(file, await readRequiredFile(file));
}

const evidence = files.get("docs/EVIDENCE.md");
const submissionDraft = files.get("docs/SUBMISSION_DRAFT.md");
const attributions = files.get("docs/ATTRIBUTIONS.md");

const warnings = [];
const passes = [];

for (const label of evidenceRequiredLabels) {
  if (evidence.includes(label)) {
    passes.push(`Evidence manifest contains row: ${label}`);
  } else {
    warnings.push(`Evidence manifest is missing row: ${label}`);
  }
}

for (const text of requiredDisclosureText) {
  if (submissionDraft.includes(text) || attributions.includes(text)) {
    passes.push(`Disclosure present: ${text}`);
  } else {
    warnings.push(`Disclosure missing: ${text}`);
  }
}

const licence = files.get("LICENSE");
const packageLicence = JSON.parse(files.get("package.json")).license;
if (licence.startsWith("MIT License") && packageLicence === "MIT") {
  passes.push("Project licence: MIT in LICENSE and package.json.");
} else {
  warnings.push(
    `Project licence mismatch: LICENSE starts with "${licence.split("\n")[0]}", package.json license is "${packageLicence}".`,
  );
}

const todoCount = countMatches(submissionDraft, /\bTODO\b/g);
if (todoCount > 0) {
  warnings.push(
    `Submission draft still contains ${todoCount} TODO marker(s); this is expected until deployment, repository, video, and live evidence are available.`,
  );
} else {
  passes.push("Submission draft has no TODO markers.");
}

const forbiddenLiveClaimPatterns = [
  /A live ClawPump launch has been submitted/i,
  /ClawPump launch transaction confirmed/i,
  /live Meteora .* has been confirmed/i,
  /mainnet execution is enabled/i,
];

for (const pattern of forbiddenLiveClaimPatterns) {
  const matches = [...files.values()].some((text) => pattern.test(text));
  if (matches) {
    warnings.push(`Review possible unsupported live claim: ${pattern}`);
  } else {
    passes.push(`No unsupported live claim matched: ${pattern}`);
  }
}

console.log("Navis submission audit");
console.log("======================");
for (const pass of passes) console.log(`✓ ${pass}`);
for (const warning of warnings) console.log(`! ${warning}`);

console.log("");
console.log(
  warnings.length === 0
    ? "Submission package has no local audit warnings."
    : `Submission package has ${warnings.length} warning(s). Warnings can be acceptable when they honestly represent missing external evidence.`,
);
