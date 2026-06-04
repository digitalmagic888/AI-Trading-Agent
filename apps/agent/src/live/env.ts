import fs from "node:fs";
import path from "node:path";
import { Wallet } from "ethers";
import { repoRoot } from "../paths";

export const envPath = path.join(repoRoot, ".env");

export function readDotEnv(filePath = envPath): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function loadDotEnv(filePath = envPath): Record<string, string> {
  const env = readDotEnv(filePath);
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return env;
}

function formatEnvValue(value: string): string {
  if (/^[A-Za-z0-9_./:@,=+\-]*$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function updateDotEnv(updates: Record<string, string>, filePath = envPath): void {
  const existingText = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = existingText.split(/\r?\n/);
  const seen = new Set<string>();
  const output = lines.map((line) => {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) return line;
    const key = line.slice(0, line.indexOf("=")).trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${formatEnvValue(updates[key] ?? "")}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) output.push(`${key}=${formatEnvValue(value)}`);
  }
  fs.writeFileSync(filePath, `${output.filter((line, index) => line.length > 0 || index < output.length - 1).join("\n").trimEnd()}\n`);
  fs.chmodSync(filePath, 0o600);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function boolEnv(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes";
}

export function numberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function splitEnv(name: string): string[] {
  const value = process.env[name];
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function walletAddressFromEnv(name: string): string {
  return new Wallet(requireEnv(name)).address;
}
