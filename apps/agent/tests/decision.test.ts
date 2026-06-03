import { describe, expect, it } from "vitest";
import { normalizeSignal } from "../src/cmc/normalizeSignals";
import { loadConfig } from "../src/config";
import { defaultDemoQuotes, evaluateFlashOpportunity } from "../src/flash/opportunityEngine";
import { createStrategyDecision } from "../src/strategy/decisionEngine";

describe("createStrategyDecision", () => {
  it("blocks live execution by default while preserving quote-only route evidence", () => {
    const config = loadConfig({ maxTradeUsd: 0, killSwitch: true, liveTrading: false, flashLoanExecution: false });
    const signal = normalizeSignal({ uniqueName: "btc_cross_asset_correlation", ok: true, raw: { confidence: 80, universe: ["WBNB", "USDT"] } });
    const opportunity = evaluateFlashOpportunity({ quotes: defaultDemoQuotes(), amountUsd: 10000, borrowAsset: "USDT", maxQuoteAgeMs: config.quoteStalenessMs });
    const decision = createStrategyDecision(config, signal, opportunity);
    expect(decision.type).toBe("EXECUTE_FLASH_ROUTE_BLOCKED");
    expect(decision.gates.some((gate) => gate.name === "Live trading flag" && !gate.passed)).toBe(true);
    expect(decision.decisionHash).toHaveLength(64);
  });
});
