import path from "node:path";
import { repoRoot } from "./paths";
import type { RuntimeConfig, RuntimeMode } from "./types";

function boolEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function numberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function listEnv(name: string, defaultValue: string[]): string[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function modeFromEnv(liveTrading: boolean): RuntimeMode {
  if (liveTrading) return "live";
  const network = (process.env.NETWORK ?? "bsc-testnet").toLowerCase();
  return network.includes("testnet") ? "testnet" : "dry-run";
}

export function loadConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  const liveTrading = boolEnv("LIVE_TRADING", false);
  const config: RuntimeConfig = {
    mode: modeFromEnv(liveTrading),
    liveTrading,
    flashLoanExecution: boolEnv("FLASH_LOAN_EXECUTION", false),
    maxTradeUsd: numberEnv("MAX_TRADE_USD", 0),
    maxDailyNotionalUsd: numberEnv("MAX_DAILY_NOTIONAL_USD", 0),
    minConfidence: numberEnv("MIN_CONFIDENCE", 65),
    maxSlippageBps: numberEnv("MAX_SLIPPAGE_BPS", 75),
    maxSpreadBps: numberEnv("MAX_SPREAD_BPS", 500),
    quoteStalenessMs: numberEnv("QUOTE_STALENESS_MS", 45_000),
    killSwitch: boolEnv("KILL_SWITCH", true),
    chainAllowlist: listEnv("CHAIN_ALLOWLIST", ["bnb"]),
    tokenAllowlist: listEnv("TOKEN_ALLOWLIST", ["WBNB", "BNB", "USDT", "USDC", "CAKE", "TWT"]),
    dbPath: process.env.AGENT_DB_PATH || path.join(repoRoot, "artifacts", "agent-ledger.sqlite3"),
    cmcMode: (process.env.CMC_MODE as RuntimeConfig["cmcMode"]) || "mock",
    cmcSkillResultsFile: process.env.CMC_SKILL_RESULTS_FILE || undefined,
    twakMode: (process.env.TWAK_MODE as RuntimeConfig["twakMode"]) || "mock"
  };
  return { ...config, ...overrides };
}
