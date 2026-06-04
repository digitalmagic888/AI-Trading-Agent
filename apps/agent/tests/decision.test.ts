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

  it("treats zero notional caps as unbounded for no-fixed-cap production sizing", () => {
    const config = loadConfig({ maxTradeUsd: 0, maxDailyNotionalUsd: 0, killSwitch: false, liveTrading: true, flashLoanExecution: true });
    const signal = normalizeSignal({ uniqueName: "btc_cross_asset_correlation", ok: true, raw: { confidence: 80, universe: ["WBNB", "USDT"] } });
    const opportunity = evaluateFlashOpportunity({ quotes: defaultDemoQuotes(), amountUsd: 10000, borrowAsset: "USDT", maxQuoteAgeMs: config.quoteStalenessMs });
    const decision = createStrategyDecision(config, signal, opportunity);
    expect(decision.gates.some((gate) => gate.name === "Trade notional cap" && gate.passed && gate.detail.includes("unbounded"))).toBe(true);
    expect(decision.gates.some((gate) => gate.name === "Daily notional cap" && gate.passed && gate.detail.includes("unbounded"))).toBe(true);
    expect(decision.type).toBe("QUOTE_FLASH_ROUTE");
  });

  it("enforces positive notional caps when configured", () => {
    const config = loadConfig({ maxTradeUsd: 5000, maxDailyNotionalUsd: 5000, killSwitch: false, liveTrading: true, flashLoanExecution: true });
    const signal = normalizeSignal({ uniqueName: "btc_cross_asset_correlation", ok: true, raw: { confidence: 80, universe: ["WBNB", "USDT"] } });
    const opportunity = evaluateFlashOpportunity({ quotes: defaultDemoQuotes(), amountUsd: 10000, borrowAsset: "USDT", maxQuoteAgeMs: config.quoteStalenessMs });
    const decision = createStrategyDecision(config, signal, opportunity);
    expect(decision.gates.some((gate) => gate.name === "Trade notional cap" && !gate.passed)).toBe(true);
    expect(decision.gates.some((gate) => gate.name === "Daily notional cap" && !gate.passed)).toBe(true);
    expect(decision.type).toBe("EXECUTE_FLASH_ROUTE_BLOCKED");
  });

});
