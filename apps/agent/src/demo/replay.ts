import fs from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "../paths";

const artifactPath = path.join(repoRoot, "artifacts", "demo-run-latest.json");
const artifact = JSON.parse(await fs.readFile(artifactPath, "utf8"));
console.log(JSON.stringify({
  generatedAt: artifact.generatedAt,
  decision: artifact.decision.type,
  decisionHash: artifact.decision.decisionHash,
  expectedProfitUsd: artifact.decision.opportunity.expectedProfitUsd,
  finalAction: artifact.decision.finalAction
}, null, 2));
