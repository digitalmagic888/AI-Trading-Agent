import { createSkillHubClient } from "../cmc/skillHubClient";
import { normalizeSignal } from "../cmc/normalizeSignals";
import { loadConfig } from "../config";
import { defaultDemoQuotes, evaluateFlashOpportunity } from "../flash/opportunityEngine";
import { recordDecision } from "../ledger/sqlite";
import { createStrategyDecision } from "../strategy/decisionEngine";
import type { RuntimeConfig, StrategyDecision } from "../types";

export async function runDecision(overrides: Partial<RuntimeConfig> = {}): Promise<StrategyDecision> {
  const config = loadConfig(overrides);
  const client = createSkillHubClient(config);
  const skills = await client.findSkill("crypto market overview");
  const selected = skills[0];
  if (!selected) throw new Error("No CMC skill candidate available.");
  const result = await client.executeSkill(selected.uniqueName, { preview: true });
  const signal = normalizeSignal(result);
  const opportunity = evaluateFlashOpportunity({
    quotes: defaultDemoQuotes(),
    amountUsd: 10_000,
    borrowAsset: "USDT",
    maxQuoteAgeMs: config.quoteStalenessMs
  });
  const decision = createStrategyDecision(config, signal, opportunity);
  recordDecision(config.dbPath, decision);
  return decision;
}
