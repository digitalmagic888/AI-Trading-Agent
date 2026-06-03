import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RuntimeConfig } from "../types";
import { redactSecrets } from "../security/redact";

const execFileAsync = promisify(execFile);

export type TwakAction = "version" | "authStatus" | "chains" | "walletStatus" | "portfolio" | "risk" | "swapQuote";

export interface TwakCommandRequest {
  action: TwakAction;
  assetId?: string;
  amount?: string;
  fromAsset?: string;
  toAsset?: string;
  chain?: string;
}

export interface TwakCommandPlan {
  command: string;
  args: string[];
  safeToRun: boolean;
}

export function buildTwakCommand(request: TwakCommandRequest): TwakCommandPlan {
  switch (request.action) {
    case "version":
      return { command: "npx", args: ["@trustwallet/cli", "--version"], safeToRun: true };
    case "authStatus":
      return { command: "twak", args: ["auth", "status"], safeToRun: true };
    case "chains":
      return { command: "twak", args: ["chains"], safeToRun: true };
    case "walletStatus":
      return { command: "twak", args: ["wallet", "status"], safeToRun: true };
    case "portfolio":
      return { command: "twak", args: ["wallet", "portfolio", "--json"], safeToRun: true };
    case "risk":
      if (!request.assetId) throw new Error("TWAK risk check requires assetId");
      return { command: "twak", args: ["risk", request.assetId, "--json"], safeToRun: true };
    case "swapQuote":
      if (!request.amount || !request.fromAsset || !request.toAsset) throw new Error("TWAK swap quote requires amount, fromAsset, and toAsset");
      return {
        command: "twak",
        args: ["swap", request.amount, request.fromAsset, request.toAsset, "--chain", request.chain ?? "bnb", "--quote-only", "--json"],
        safeToRun: true
      };
  }
}

export class TwakClient {
  constructor(private readonly config: RuntimeConfig) {}

  async run(request: TwakCommandRequest): Promise<unknown> {
    const plan = buildTwakCommand(request);
    if (this.config.twakMode === "mock") {
      return redactSecrets({ mode: "mock", plan, status: "not-run", reason: "TWAK credentials are not required for dry-run demo." });
    }
    const { stdout, stderr } = await execFileAsync(plan.command, plan.args, { timeout: 30_000 });
    return redactSecrets({ stdout, stderr, plan });
  }
}
