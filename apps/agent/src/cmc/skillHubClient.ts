import fs from "node:fs/promises";
import type { RuntimeConfig, SkillCandidate, SkillExecutionResult } from "../types";

export interface SkillHubClient {
  findSkill(query: string): Promise<SkillCandidate[]>;
  executeSkill(uniqueName: string, parameters: Record<string, unknown>): Promise<SkillExecutionResult>;
}

const mockSkills: SkillCandidate[] = [
  {
    uniqueName: "cmc-mcp:search_cryptos",
    title: "CMC MCP Crypto Search",
    description: "Search CoinMarketCap assets by symbol, name, or slug before requesting market data.",
    source: "cmc-mcp"
  },
  {
    uniqueName: "cmc-mcp:get_crypto_quotes_latest",
    title: "CMC MCP Latest Quotes",
    description: "Latest CMC quote data for BTC, BNB, and other assets used by the strategy engine.",
    source: "cmc-mcp"
  },
  {
    uniqueName: "cmc-mcp:get_global_metrics_latest",
    title: "CMC MCP Global Market Metrics",
    description: "Global market cap, dominance, fear and greed, and broad market state.",
    source: "cmc-mcp"
  }
];

function extractJsonContent(body: unknown): unknown {
  const result = (body as { result?: unknown }).result;
  if (!result || typeof result !== "object") return body;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return result;
  const text = content.map((item) => typeof item === "object" && item && "text" in item ? String((item as { text: unknown }).text) : "").join("\n").trim();
  if (!text) return result;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

class MockSkillHubClient implements SkillHubClient {
  async findSkill(query: string): Promise<SkillCandidate[]> {
    const lower = query.toLowerCase();
    if (lower.includes("btc") || lower.includes("price")) return mockSkills.slice(0, 2);
    if (lower.includes("market") || lower.includes("risk")) return mockSkills;
    return mockSkills.slice(0, 2);
  }

  async executeSkill(uniqueName: string, parameters: Record<string, unknown>): Promise<SkillExecutionResult> {
    return {
      uniqueName,
      ok: true,
      raw: {
        preview: parameters.preview === true,
        provider: "CoinMarketCap default MCP",
        tools: ["search_cryptos", "get_crypto_quotes_latest", "get_global_metrics_latest"],
        market: "BNB Chain liquidity remains active while BTC correlation risk is moderate.",
        regime: "neutral",
        confidence: 72,
        volatility: "medium",
        invalidation: ["BTC downside break with rising realized volatility", "DEX quotes older than 45 seconds"],
        universe: ["WBNB", "USDT", "USDC", "CAKE", "TWT"],
        notes: ["Mock CMC MCP result. Set CMC_MODE=real and CMC_MCP_API_KEY outside the repo for live CMC MCP calls."]
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

class RealCmcMcpClient implements SkillHubClient {
  constructor(private readonly config: RuntimeConfig) {}

  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const key = process.env.CMC_MCP_API_KEY?.trim();
    if (!key) throw new Error("CMC_MODE=real requires CMC_MCP_API_KEY in the process environment.");
    const response = await fetch(this.config.cmcMcpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
        "X-CMC-MCP-API-KEY": key
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`CMC MCP ${name} failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
    const body = JSON.parse(text) as { result?: { isError?: boolean }; error?: unknown };
    if (body.error) throw new Error(`CMC MCP ${name} error: ${JSON.stringify(body.error)}`);
    if (body.result?.isError) throw new Error(`CMC MCP ${name} tool error: ${text.slice(0, 500)}`);
    return extractJsonContent(body);
  }

  async findSkill(query: string): Promise<SkillCandidate[]> {
    const search = await this.callTool("search_cryptos", { query, limit: 3 });
    return [
      ...mockSkills,
      {
        uniqueName: "cmc-mcp:live-search-result",
        title: `Live CMC search for ${query}`,
        description: JSON.stringify(search).slice(0, 240),
        source: "cmc-mcp"
      }
    ];
  }

  async executeSkill(uniqueName: string, parameters: Record<string, unknown>): Promise<SkillExecutionResult> {
    const query = typeof parameters.query === "string" ? parameters.query : "btc";
    const search = await this.callTool("search_cryptos", { query, limit: 3 });
    const id = Array.isArray(search) && search[0] && typeof search[0] === "object" && "id" in search[0]
      ? String((search[0] as { id: unknown }).id)
      : "1";
    const [quotes, globalMetrics] = await Promise.all([
      this.callTool("get_crypto_quotes_latest", { id }),
      this.callTool("get_global_metrics_latest", {})
    ]);
    return {
      uniqueName,
      ok: true,
      raw: {
        provider: "CoinMarketCap default MCP",
        tools: ["search_cryptos", "get_crypto_quotes_latest", "get_global_metrics_latest"],
        search,
        quotes,
        globalMetrics,
        regime: "neutral",
        confidence: 72,
        universe: ["WBNB", "USDT", "USDC", "CAKE", "TWT"]
      }
    };
  }
}

export function createSkillHubClient(config: RuntimeConfig): SkillHubClient {
  if (config.cmcMode === "file") {
    if (!config.cmcSkillResultsFile) throw new Error("CMC_MODE=file requires CMC_SKILL_RESULTS_FILE");
    return new FileSkillHubClient(config.cmcSkillResultsFile);
  }
  if (config.cmcMode === "real") return new RealCmcMcpClient(config);
  return new MockSkillHubClient();
}
