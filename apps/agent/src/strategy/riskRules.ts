import type { FlashOpportunity, RiskGate, RuntimeConfig, SignalSnapshot } from "../types";

function includesNormalized(values: string[], expected: string): boolean {
  return values.map((value) => value.toLowerCase()).includes(expected.toLowerCase());
}

function passesUsdCap(amountUsd: number, capUsd: number): boolean {
  return capUsd <= 0 || amountUsd <= capUsd;
}

function capDetail(amountUsd: number, capName: string, capUsd: number): string {
  if (capUsd <= 0) return `amountUsd=${amountUsd}, ${capName}=unbounded`;
  return `amountUsd=${amountUsd}, ${capName}=${capUsd}`;
}

export function evaluateRiskGates(config: RuntimeConfig, signal: SignalSnapshot, opportunity: FlashOpportunity): RiskGate[] {
  const tokens = [opportunity.borrowAsset, "WBNB", "USDT"];
  const tokenAllowlistPassed = tokens.every((token) => includesNormalized(config.tokenAllowlist, token));

  return [
    {
      name: "CMC confidence threshold",
      passed: signal.confidenceScore >= config.minConfidence,
      detail: `confidence=${signal.confidenceScore}, threshold=${config.minConfidence}`,
      severity: "blocker"
    },
    {
      name: "Opportunity is profitable after costs",
      passed: opportunity.isProfitable,
      detail: `expectedProfitUsd=${opportunity.expectedProfitUsd}`,
      severity: "blocker"
    },
    {
      name: "Quote freshness",
      passed: !opportunity.stale,
      detail: `stalenessLimitMs=${config.quoteStalenessMs}`,
      severity: "blocker"
    },
    {
      name: "Chain allowlist",
      passed: includesNormalized(config.chainAllowlist, opportunity.chain),
      detail: `chain=${opportunity.chain}`,
      severity: "blocker"
    },
    {
      name: "Token allowlist",
      passed: tokenAllowlistPassed,
      detail: `tokens=${tokens.join(",")}`,
      severity: "blocker"
    },
    {
      name: "Trade notional cap",
      passed: passesUsdCap(opportunity.amountUsd, config.maxTradeUsd),
      detail: capDetail(opportunity.amountUsd, "maxTradeUsd", config.maxTradeUsd),
      severity: "blocker"
    },
    {
      name: "Daily notional cap",
      passed: passesUsdCap(opportunity.amountUsd, config.maxDailyNotionalUsd),
      detail: capDetail(opportunity.amountUsd, "maxDailyNotionalUsd", config.maxDailyNotionalUsd),
      severity: "blocker"
    },
    {
      name: "Kill switch",
      passed: !config.killSwitch,
      detail: config.killSwitch ? "kill switch enabled" : "kill switch disabled by operator",
      severity: "blocker"
    },
    {
      name: "Live trading flag",
      passed: config.liveTrading,
      detail: `LIVE_TRADING=${config.liveTrading}`,
      severity: "blocker"
    },
    {
      name: "Flash-loan execution flag",
      passed: config.flashLoanExecution,
      detail: `FLASH_LOAN_EXECUTION=${config.flashLoanExecution}`,
      severity: "blocker"
    }
  ];
}

export function blockingReasons(gates: RiskGate[]): string[] {
  return gates.filter((gate) => !gate.passed && gate.severity === "blocker").map((gate) => `${gate.name}: ${gate.detail}`);
}
