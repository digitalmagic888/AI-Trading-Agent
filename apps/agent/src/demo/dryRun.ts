import fs from "node:fs/promises";
import path from "node:path";
import { createSkillHubClient } from "../cmc/skillHubClient";
import { normalizeSignal } from "../cmc/normalizeSignals";
import { loadConfig } from "../config";
import { defaultDemoQuotes, evaluateFlashOpportunity } from "../flash/opportunityEngine";
import { recordDecision } from "../ledger/sqlite";
import { repoRoot } from "../paths";
import { createStrategyDecision } from "../strategy/decisionEngine";
import { TwakClient } from "../trustwallet/twakClient";

export async function runDryDemo() {
  const config = loadConfig();
  const cmc = createSkillHubClient(config);
  const skills = await cmc.findSkill("btc price");
  const selectedSkill = skills.find((skill) => skill.uniqueName === "btc_cross_asset_correlation") ?? skills[0];
  if (!selectedSkill) throw new Error("No CMC skill candidates available in mock/file mode.");
  const skillResult = await cmc.executeSkill(selectedSkill.uniqueName, { preview: true });
  const signal = normalizeSignal(skillResult);
  const opportunity = evaluateFlashOpportunity({
    quotes: defaultDemoQuotes(),
    amountUsd: 10_000,
    borrowAsset: "USDT",
    maxQuoteAgeMs: config.quoteStalenessMs
  });
  const decision = createStrategyDecision(config, signal, opportunity);
  recordDecision(config.dbPath, decision);

  const twak = new TwakClient(config);
  const twakQuote = await twak.run({ action: "swapQuote", amount: "10000", fromAsset: "USDT", toAsset: "WBNB", chain: "bnb" });
  const artifact = {
    generatedAt: new Date().toISOString(),
    mode: config.mode,
    cmc: { mode: config.cmcMode, skills, selectedSkill, skillResult },
    flashLoan: {
      provider: "Aave V3 on BNB Chain",
      executionEnabled: config.flashLoanExecution,
      route: opportunity
    },
    trustWallet: twakQuote,
    decision,
    safety: {
      liveTrading: config.liveTrading,
      killSwitch: config.killSwitch,
      maxTradeUsd: config.maxTradeUsd,
      statement: "No transaction was signed, broadcast, or executed."
    }
  };
  const artifactPath = path.join(repoRoot, "artifacts", "demo-run-latest.json");
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifact = await runDryDemo();
  console.log(JSON.stringify({ ok: true, artifact: "artifacts/demo-run-latest.json", decision: artifact.decision.type, expectedProfitUsd: artifact.decision.opportunity.expectedProfitUsd }, null, 2));
}
