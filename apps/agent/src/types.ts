export type RuntimeMode = "dry-run" | "testnet" | "live";
export type DecisionType =
  | "NO_TRADE"
  | "NO_OPPORTUNITY"
  | "SIMULATE_ONLY"
  | "QUOTE_FLASH_ROUTE"
  | "EXECUTE_FLASH_ROUTE_BLOCKED"
  | "REDUCE_RISK";

export interface RuntimeConfig {
  mode: RuntimeMode;
  liveTrading: boolean;
  flashLoanExecution: boolean;
  maxTradeUsd: number;
  maxDailyNotionalUsd: number;
  minConfidence: number;
  maxSlippageBps: number;
  maxSpreadBps: number;
  quoteStalenessMs: number;
  killSwitch: boolean;
  chainAllowlist: string[];
  tokenAllowlist: string[];
  dbPath: string;
  cmcMode: "mock" | "file" | "real";
  cmcSkillResultsFile?: string;
  cmcMcpUrl: string;
  twakMode: "mock" | "real";
}

export interface SkillCandidate {
  uniqueName: string;
  title: string;
  description: string;
  source: "cmc-mcp" | "mock";
}

export interface SkillExecutionResult {
  uniqueName: string;
  ok: boolean;
  raw: unknown;
}

export interface SignalSnapshot {
  timestamp: string;
  skillName: string;
  rawResultHash: string;
  normalizedMarketRegime: "risk-on" | "neutral" | "risk-off";
  confidenceScore: number;
  volatilityRiskNotes: string[];
  invalidationCriteria: string[];
  recommendedUniverse: string[];
  noTradeReasons: string[];
}

export interface DexPoolQuote {
  dex: string;
  chain: "bnb";
  baseAsset: string;
  quoteAsset: string;
  price: number;
  reserveUsd: number;
  feeBps: number;
  timestamp: string;
}

export interface FlashOpportunity {
  id: string;
  chain: "bnb";
  borrowAsset: string;
  amountUsd: number;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  grossSpreadBps: number;
  dexFeeBps: number;
  flashLoanPremiumBps: number;
  slippageBps: number;
  gasCostUsd: number;
  expectedProfitUsd: number;
  expectedProfitBps: number;
  isProfitable: boolean;
  stale: boolean;
  notes: string[];
}

export interface RiskGate {
  name: string;
  passed: boolean;
  detail: string;
  severity: "info" | "warn" | "blocker";
}

export interface StrategyDecision {
  runId: string;
  timestamp: string;
  type: DecisionType;
  confidence: number;
  reason: string;
  finalAction: "record_only" | "quote_only" | "blocked" | "ready_for_manual_review";
  signal: SignalSnapshot;
  opportunity: FlashOpportunity;
  gates: RiskGate[];
  decisionHash: string;
}
