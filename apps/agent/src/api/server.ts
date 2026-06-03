import http from "node:http";
import { createSkillHubClient } from "../cmc/skillHubClient";
import { normalizeSignal } from "../cmc/normalizeSignals";
import { loadConfig } from "../config";
import { defaultDemoQuotes, evaluateFlashOpportunity } from "../flash/opportunityEngine";
import { getRun, listRuns, recordDecision } from "../ledger/sqlite";
import { createStrategyDecision } from "../strategy/decisionEngine";

function sendJson(res: http.ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(value, null, 2));
}

async function runDecision() {
  const config = loadConfig();
  const client = createSkillHubClient(config);
  const skills = await client.findSkill("crypto market overview");
  const selected = skills[0];
  if (!selected) throw new Error("No CMC skill candidate available.");
  const result = await client.executeSkill(selected.uniqueName, { preview: true });
  const signal = normalizeSignal(result);
  const opportunity = evaluateFlashOpportunity({ quotes: defaultDemoQuotes(), amountUsd: 10_000, borrowAsset: "USDT", maxQuoteAgeMs: config.quoteStalenessMs });
  const decision = createStrategyDecision(config, signal, opportunity);
  recordDecision(config.dbPath, decision);
  return decision;
}

export function createAgentServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const config = loadConfig();
      if (req.method === "OPTIONS") return sendJson(res, 204, {});
      if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true, service: "tristack-alpha-agent" });
      if (req.method === "GET" && url.pathname === "/api/sponsor-proof") {
        return sendJson(res, 200, {
          cmc: "CMC MCP adapter with mock/file mode and real HTTP MCP mode.",
          trustWallet: "TWAK command wrapper for wallet, risk, portfolio, and quote-only flows.",
          bnbAgent: "Python service exposes manifest and ERC-8183-style status endpoint.",
          aave: "Flash-loan opportunity engine and Solidity proof receiver are dry-run-first.",
          mode: config.mode,
          killSwitch: config.killSwitch
        });
      }
      if (req.method === "GET" && url.pathname === "/api/runs") return sendJson(res, 200, listRuns(config.dbPath));
      if (req.method === "GET" && url.pathname.startsWith("/api/runs/")) {
        const run = getRun(config.dbPath, url.pathname.split("/").pop() ?? "");
        return run ? sendJson(res, 200, run) : sendJson(res, 404, { error: "run not found" });
      }
      if (req.method === "POST" && url.pathname === "/api/run-dry-decision") return sendJson(res, 200, await runDecision());
      if (req.method === "POST" && url.pathname === "/api/quote-only") return sendJson(res, 200, await runDecision());
      if (req.method === "POST" && url.pathname === "/api/kill-switch") return sendJson(res, 200, { killSwitch: config.killSwitch, note: "Set KILL_SWITCH=false only in a controlled environment after all execution gates are configured." });
      return sendJson(res, 404, { error: "not found" });
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}
