import { hashPayload, newRunId } from "../hash";
import { blockingReasons, evaluateRiskGates } from "./riskRules";
import type { FlashOpportunity, RuntimeConfig, SignalSnapshot, StrategyDecision } from "../types";

export function createStrategyDecision(config: RuntimeConfig, signal: SignalSnapshot, opportunity: FlashOpportunity): StrategyDecision {
  const gates = evaluateRiskGates(config, signal, opportunity);
  const blockers = blockingReasons(gates);
  const runId = newRunId("flash");
  const confidence = Math.min(100, Math.round((signal.confidenceScore * 0.65) + (Math.max(-20, Math.min(40, opportunity.expectedProfitBps)) * 0.35) + 10));

  let type: StrategyDecision["type"] = "SIMULATE_ONLY";
  let finalAction: StrategyDecision["finalAction"] = "record_only";
  let reason = "Flash-route simulation recorded for judge demo.";

  if (signal.confidenceScore < config.minConfidence) {
    type = "NO_TRADE";
    finalAction = "blocked";
    reason = "CMC signal confidence is below threshold.";
  } else if (!opportunity.isProfitable) {
    type = "NO_OPPORTUNITY";
    finalAction = "blocked";
    reason = "No profitable pool-balancing route after flash premium, fees, slippage, and gas.";
  } else if (blockers.length > 0) {
    type = "EXECUTE_FLASH_ROUTE_BLOCKED";
    finalAction = "quote_only";
    reason = `Profitable dry-run route found, but execution is blocked: ${blockers.slice(0, 3).join("; ")}.`;
  } else {
    type = "QUOTE_FLASH_ROUTE";
    finalAction = "ready_for_manual_review";
    reason = "All configured gates pass; route is ready for manual review before any live transaction.";
  }

  const unsigned = {
    runId,
    timestamp: new Date().toISOString(),
    type,
    confidence,
    reason,
    finalAction,
    signal,
    opportunity,
    gates
  };

  return {
    ...unsigned,
    decisionHash: hashPayload(unsigned)
  };
}
