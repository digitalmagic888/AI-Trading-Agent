import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ledgerSchema } from "./schema";
import type { StrategyDecision } from "../types";
import { redactSecrets } from "../security/redact";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function runSql(dbPath: string, sql: string): string {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return execFileSync("sqlite3", [dbPath], { input: sql, encoding: "utf8" });
}

export function initializeLedger(dbPath: string): void {
  runSql(dbPath, ledgerSchema);
}

export function recordDecision(dbPath: string, decision: StrategyDecision): void {
  initializeLedger(dbPath);
  const redacted = redactSecrets(decision);
  const payload = JSON.stringify(redacted);
  const sql = `
INSERT OR REPLACE INTO runs (id, created_at, decision_hash, mode, payload_json)
VALUES (${sqlString(decision.runId)}, ${sqlString(decision.timestamp)}, ${sqlString(decision.decisionHash)}, ${sqlString(decision.finalAction)}, ${sqlString(payload)});
INSERT INTO events (run_id, created_at, event_type, payload_json)
VALUES (${sqlString(decision.runId)}, ${sqlString(new Date().toISOString())}, 'decision.recorded', ${sqlString(payload)});
`;
  runSql(dbPath, sql);
}

export function listRuns(dbPath: string): unknown[] {
  initializeLedger(dbPath);
  const output = runSql(dbPath, "SELECT payload_json FROM runs ORDER BY created_at DESC;\n");
  return output.trim() ? output.trim().split("\n").map((line) => JSON.parse(line)) : [];
}

export function getRun(dbPath: string, runId: string): unknown | undefined {
  initializeLedger(dbPath);
  const output = runSql(dbPath, `SELECT payload_json FROM runs WHERE id = ${sqlString(runId)} LIMIT 1;\n`);
  return output.trim() ? JSON.parse(output.trim()) : undefined;
}
