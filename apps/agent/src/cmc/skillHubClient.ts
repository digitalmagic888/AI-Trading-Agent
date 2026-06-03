import fs from "node:fs/promises";
import type { RuntimeConfig, SkillCandidate, SkillExecutionResult } from "../types";

export interface SkillHubClient {
  findSkill(query: string): Promise<SkillCandidate[]>;
  executeSkill(uniqueName: string, parameters: Record<string, unknown>): Promise<SkillExecutionResult>;
}

const mockSkills: SkillCandidate[] = [
  {
    uniqueName: "btc_cross_asset_correlation",
    title: "BTC Cross Asset Correlation",
    description: "Preview of BTC correlation stress, major asset beta, and market risk context.",
    source: "mock"
  },
  {
    uniqueName: "crypto_macro_overview",
    title: "Crypto Macro Overview",
    description: "Broad market regime overview for crypto majors and liquidity conditions.",
    source: "mock"
  },
  {
    uniqueName: "daily_market_overview",
    title: "Daily Market Overview",
    description: "Daily market snapshot with momentum, volatility, and headline risk notes.",
    source: "mock"
  }
];

class MockSkillHubClient implements SkillHubClient {
  async findSkill(query: string): Promise<SkillCandidate[]> {
    const lower = query.toLowerCase();
    if (lower.includes("btc")) return mockSkills.filter((skill) => skill.uniqueName.includes("btc") || skill.uniqueName.includes("macro"));
    if (lower.includes("market") || lower.includes("risk")) return mockSkills;
    return mockSkills.slice(0, 2);
  }

  async executeSkill(uniqueName: string, parameters: Record<string, unknown>): Promise<SkillExecutionResult> {
    return {
      uniqueName,
      ok: true,
      raw: {
        preview: parameters.preview === true,
        market: "BNB Chain liquidity remains active while BTC correlation risk is moderate.",
        regime: "neutral",
        confidence: 72,
        volatility: "medium",
        invalidation: ["BTC downside break with rising realized volatility", "DEX quotes older than 45 seconds"],
        universe: ["WBNB", "USDT", "USDC", "CAKE", "TWT"],
        notes: ["Mock CMC Skill Hub result because native MCP is not configured in this shell."]
      }
    };
  }
}

class FileSkillHubClient implements SkillHubClient {
  constructor(private readonly filePath: string) {}

  private async readFixture(): Promise<Record<string, unknown>> {
    return JSON.parse(await fs.readFile(this.filePath, "utf8")) as Record<string, unknown>;
  }

  async findSkill(query: string): Promise<SkillCandidate[]> {
    const fixture = await this.readFixture();
    const skills = fixture.skills as SkillCandidate[] | undefined;
    return skills?.filter((skill) => `${skill.uniqueName} ${skill.title} ${skill.description}`.toLowerCase().includes(query.split(" ")[0]?.toLowerCase() ?? "")) ?? [];
  }

  async executeSkill(uniqueName: string, parameters: Record<string, unknown>): Promise<SkillExecutionResult> {
    const fixture = await this.readFixture();
    return {
      uniqueName,
      ok: true,
      raw: {
        parameters,
        result: (fixture.executions as Record<string, unknown> | undefined)?.[uniqueName] ?? fixture
      }
    };
  }
}

class RealSkillHubClient implements SkillHubClient {
  async findSkill(): Promise<SkillCandidate[]> {
    throw new Error("Real CMC Skill Hub calls must be invoked through the local Codex MCP tool namespace after cmc-skill-hub is configured and Codex is reloaded.");
  }

  async executeSkill(): Promise<SkillExecutionResult> {
    throw new Error("Real CMC Skill Hub calls must be invoked through the local Codex MCP tool namespace after cmc-skill-hub is configured and Codex is reloaded.");
  }
}

export function createSkillHubClient(config: RuntimeConfig): SkillHubClient {
  if (config.cmcMode === "file") {
    if (!config.cmcSkillResultsFile) throw new Error("CMC_MODE=file requires CMC_SKILL_RESULTS_FILE");
    return new FileSkillHubClient(config.cmcSkillResultsFile);
  }
  if (config.cmcMode === "real") return new RealSkillHubClient();
  return new MockSkillHubClient();
}
