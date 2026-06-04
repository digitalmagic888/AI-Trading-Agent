import fs from "node:fs/promises";
import path from "node:path";
import { AbiCoder, Contract, formatUnits, getAddress, Interface, keccak256, parseUnits, toUtf8Bytes, Wallet } from "ethers";
import { runDecision } from "../runtime/runDecision";
import { repoRoot } from "../paths";
import { flashPoolBalancerAbi, erc20Abi } from "./abis";
import { boolEnv, loadDotEnv, numberEnv, requireEnv, updateDotEnv } from "./env";
import { configuredGasPrice, createCheckedProvider } from "./rpc";
import type { StrategyDecision } from "../types";

interface BuiltRoute {
  receiverAddress: string;
  executorAddress: string;
  assetAddress: string;
  amount: bigint;
  minProfit: bigint;
  deadline: bigint;
  routeHash: string;
  routeData: string;
  calldata: string;
}

interface WorkerResult {
  generatedAt: string;
  decision: StrategyDecision;
  route?: {
    receiverAddress: string;
    executorAddress: string;
    assetAddress: string;
    amount: string;
    minProfit: string;
    deadline: string;
    routeHash: string;
  };
  simulation: {
    attempted: boolean;
    passed: boolean;
    error?: string;
    decodedError?: string;
    gasEstimate?: string;
  };
  submission: {
    allowed: boolean;
    submitted: boolean;
    txHash?: string;
    reason?: string;
  };
}

function errorData(error: unknown): string | undefined {
  const value = error as { data?: unknown; info?: { error?: { data?: unknown } }; error?: { data?: unknown } };
  const data = value.data ?? value.info?.error?.data ?? value.error?.data;
  return typeof data === "string" ? data : undefined;
}

function decodeContractError(error: unknown, iface: Interface): string | undefined {
  const data = errorData(error);
  if (!data) return undefined;
  try {
    const parsed = iface.parseError(data);
    return parsed ? `${parsed.name}(${parsed.args.map((arg) => String(arg)).join(",")})` : undefined;
  } catch {
    return undefined;
  }
}

async function tokenDecimals(asset: Contract): Promise<number> {
  const decimals = await asset.getFunction("decimals")();
  return Number(decimals);
}

async function buildRoute(decision: StrategyDecision, worker: Wallet): Promise<BuiltRoute> {
  const receiverAddress = getAddress(requireEnv("FLASH_RECEIVER_ADDRESS"));
  const executorAddress = getAddress(requireEnv("FLASH_ROUTE_EXECUTOR_ADDRESS"));
  const tokenKey = `TOKEN_${decision.opportunity.borrowAsset.toUpperCase()}`;
  const assetAddress = getAddress(requireEnv(tokenKey));
  const asset = new Contract(assetAddress, erc20Abi, worker.provider);
  const decimals = await tokenDecimals(asset);
  const amount = parseUnits(String(decision.opportunity.amountUsd), decimals);
  const minProfitUsd = Math.max(0, numberEnv("MIN_PROFIT_USD", 0));
  const minProfit = parseUnits(String(minProfitUsd), decimals);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + numberEnv("FLASH_ROUTE_DEADLINE_SECONDS", 75));
  const routeData = AbiCoder.defaultAbiCoder().encode(
    ["string", "string", "string", "uint256"],
    [decision.opportunity.buyDex, decision.opportunity.sellDex, decision.opportunity.id, BigInt(Math.round(decision.opportunity.expectedProfitUsd * 10_000))]
  );
  const routeHash = keccak256(toUtf8Bytes(`${decision.decisionHash}:${routeData}`));
  const plan = [executorAddress, minProfit, deadline, routeHash, routeData] as const;
  const receiver = new Contract(receiverAddress, flashPoolBalancerAbi, worker);
  const calldata = receiver.interface.encodeFunctionData("requestFlashRoute", [assetAddress, amount, plan]);
  return { receiverAddress, executorAddress, assetAddress, amount, minProfit, deadline, routeHash, routeData, calldata };
}

async function persistResult(result: WorkerResult): Promise<void> {
  const artifactPath = path.join(repoRoot, "artifacts", "live-execution-worker-latest.json");
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`);
}

export async function runExecutionWorkerOnce(): Promise<WorkerResult> {
  loadDotEnv();
  const provider = await createCheckedProvider();
  const worker = new Wallet(requireEnv("HOT_WALLET_PRIVATE_KEY"), provider);
  const decision = await runDecision();
  const submitAllowed = boolEnv("ALLOW_LIVE_FLASH_SUBMIT", false);

  const base: WorkerResult = {
    generatedAt: new Date().toISOString(),
    decision,
    simulation: { attempted: false, passed: false },
    submission: { allowed: submitAllowed, submitted: false }
  };

  if (decision.finalAction !== "ready_for_manual_review") {
    const result = { ...base, submission: { ...base.submission, reason: `decision finalAction=${decision.finalAction}` } };
    await persistResult(result);
    return result;
  }

  const route = await buildRoute(decision, worker);
  const receiverInterface = new Interface(flashPoolBalancerAbi);
  const routeSummary = {
    receiverAddress: route.receiverAddress,
    executorAddress: route.executorAddress,
    assetAddress: route.assetAddress,
    amount: route.amount.toString(),
    minProfit: route.minProfit.toString(),
    deadline: route.deadline.toString(),
    routeHash: route.routeHash
  };

  try {
    await provider.call({ from: worker.address, to: route.receiverAddress, data: route.calldata });
    const gas = await worker.estimateGas({ to: route.receiverAddress, data: route.calldata });
    if (!submitAllowed) {
      const result = {
        ...base,
        route: routeSummary,
        simulation: { attempted: true, passed: true, gasEstimate: gas.toString() },
        submission: { allowed: false, submitted: false, reason: "Set ALLOW_LIVE_FLASH_SUBMIT=true to broadcast after simulation." }
      };
      await persistResult(result);
      return result;
    }
    const tx = await worker.sendTransaction({ to: route.receiverAddress, data: route.calldata, gasLimit: (gas * 120n) / 100n, gasPrice: configuredGasPrice() });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`Submitted flash route reverted: ${tx.hash}`);
    updateDotEnv({ LAST_FLASH_ROUTE_TX: tx.hash, LAST_FLASH_ROUTE_TX_AT: new Date().toISOString() });
    const result = {
      ...base,
      route: routeSummary,
      simulation: { attempted: true, passed: true, gasEstimate: gas.toString() },
      submission: { allowed: true, submitted: true, txHash: tx.hash }
    };
    await persistResult(result);
    return result;
  } catch (error) {
    const result = {
      ...base,
      route: routeSummary,
      simulation: {
        attempted: true,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        decodedError: decodeContractError(error, receiverInterface)
      },
      submission: { allowed: submitAllowed, submitted: false, reason: "eth_call or gas estimate failed; no transaction broadcast." }
    };
    await persistResult(result);
    return result;
  }
}

export async function runExecutionWorkerLoop(): Promise<void> {
  const once = process.argv.includes("--once");
  const intervalMs = numberEnv("WORKER_INTERVAL_MS", 15_000);
  do {
    const result = await runExecutionWorkerOnce();
    console.log(JSON.stringify({
      generatedAt: result.generatedAt,
      finalAction: result.decision.finalAction,
      simulationPassed: result.simulation.passed,
      decodedError: result.simulation.decodedError,
      submitted: result.submission.submitted,
      reason: result.submission.reason
    }, null, 2));
    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runExecutionWorkerLoop();
}
