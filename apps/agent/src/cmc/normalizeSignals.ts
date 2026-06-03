import { hashPayload } from "../hash";
import type { SignalSnapshot, SkillExecutionResult } from "../types";

function textFromRaw(raw: unknown): string {
  return JSON.stringify(raw).toLowerCase();
}

export function normalizeSignal(result: SkillExecutionResult): SignalSnapshot {
  const text = textFromRaw(result.raw);
  const confidenceValue = typeof (result.raw as { confidence?: unknown }).confidence === "number" ? (result.raw as { confidence: number }).confidence : undefined;
  const explicitRegime = typeof (result.raw as { regime?: unknown }).regime === "string" ? String((result.raw as { regime: string }).regime).toLowerCase() : undefined;
  const riskOff = explicitRegime === "risk-off" || (!explicitRegime && /risk-off|high volatility|stress|unsafe/.test(text));
  const riskOn = explicitRegime === "risk-on" || (!explicitRegime && /risk-on|bullish|strong liquidity|positive/.test(text));
  const normalizedMarketRegime = riskOff ? "risk-off" : riskOn ? "risk-on" : "neutral";
  const confidenceScore = Math.max(0, Math.min(100, confidenceValue ?? (riskOff ? 58 : 72)));
  const universe = Array.isArray((result.raw as { universe?: unknown }).universe)
    ? ((result.raw as { universe: string[] }).universe)
    : ["WBNB", "USDT", "USDC", "CAKE", "TWT"];

  return {
    timestamp: new Date().toISOString(),
    skillName: result.uniqueName,
    rawResultHash: hashPayload(result.raw),
    normalizedMarketRegime,
    confidenceScore,
    volatilityRiskNotes: [
      riskOff ? "Market text contains risk-off or stress language." : "No severe volatility flag in normalized CMC result.",
      "Flash-route sizing remains bounded by quote depth and configured notional caps."
    ],
    invalidationCriteria: [
      "Quote age exceeds configured staleness limit.",
      "Gross spread falls below flash premium, DEX fees, slippage, and gas.",
      "CMC regime confidence falls below threshold."
    ],
    recommendedUniverse: universe,
    noTradeReasons: confidenceScore < 65 ? ["CMC confidence below strategy threshold."] : []
  };
}
