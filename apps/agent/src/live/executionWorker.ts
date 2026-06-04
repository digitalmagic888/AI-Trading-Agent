import fs from "node:fs/promises";
import path from "node:path";
import { AbiCoder, Contract, formatUnits, getAddress, Interface, keccak256, JsonRpcProvider, toUtf8Bytes, Wallet } from "ethers";
import { runDecision } from "../runtime/runDecision";
import { repoRoot } from "../paths";
import { flashPoolBalancerAbi } from "./abis";
import { boolEnv, loadDotEnv, numberEnv, optionalEnv, requireEnv, updateDotEnv } from "./env";
import { configuredGasPrice, createCheckedProvider } from "./rpc";
import { discoverBestV2Route, summarizeCandidate, type V2DiscoveryResult, type V2LiveRouteCandidate } from "./v2Discovery";
import type { StrategyDecision } from "../types";

interface BuiltRoute {
  receiverAddress: string;
  executorAddress: string;
  assetAddress: string;
  amount: bigint;
  minProfit: bigint;
  deadline: bigint;
  routeHash: string;
  quoteHash: string;
  routeData: string;
  calldata: string;
  candidate: V2LiveRouteCandidate;
}

interface WorkerResult {
  generatedAt: string;
  decision: StrategyDecision;
  discovery: {
    blockNumber: number;
    disabledVenues: V2DiscoveryResult["disabledVenues"];
    candidateCount: number;
    best?: Record<string, unknown>;
  };
  route?: {
    receiverAddress: string;
    executorAddress: string;
    assetAddress: string;
    amount: string;
    minProfit: string;
    deadline: string;
    routeHash: string;
    quoteHash: string;
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

function encodeV2Route(candidate: V2LiveRouteCandidate): string {
  return AbiCoder.defaultAbiCoder().encode(
    ["tuple(address buyRouter,address sellRouter,address[] buyPath,address[] sellPath,uint256 amountOutMinBuy,uint256 amountOutMinSell,uint256 deadline,bytes32 quoteHash)"],
    [[
      candidate.buyVenue.router,
      candidate.sellVenue.router,
      [candidate.asset, candidate.middleAsset],
      [candidate.middleAsset, candidate.asset],
      candidate.amountOutMinBuy,
      candidate.amountOutMinSell,
      candidate.deadline,
      candidate.quoteHash
    ]]
  );
}

function routeHashFor(candidate: V2LiveRouteCandidate, routeData: string): string {
  return keccak256(toUtf8Bytes([
    candidate.quoteHash,
    candidate.asset,
    candidate.amountIn.toString(),
    candidate.premium.toString(),
    routeData
  ].join(":")));
}

async function buildRoute(candidate: V2LiveRouteCandidate, worker: Wallet): Promise<BuiltRoute> {
  const receiverAddress = getAddress(requireEnv("FLASH_RECEIVER_ADDRESS"));
  const executorAddress = getAddress(requireEnv("FLASH_ROUTE_EXECUTOR_ADDRESS"));
  const routeData = encodeV2Route(candidate);
  const routeHash = routeHashFor(candidate, routeData);
  const plan = [executorAddress, candidate.minProfit, candidate.deadline, routeHash, routeData] as const;
  const receiver = new Contract(receiverAddress, flashPoolBalancerAbi, worker);
  const calldata = receiver.interface.encodeFunctionData("requestFlashRoute", [candidate.asset, candidate.amountIn, plan]);
  return {
    receiverAddress,
    executorAddress,
    assetAddress: candidate.asset,
    amount: candidate.amountIn,
    minProfit: candidate.minProfit,
    deadline: candidate.deadline,
    routeHash,
    quoteHash: candidate.quoteHash,
    routeData,
    calldata,
    candidate
  };
}

async function persistResult(result: WorkerResult): Promise<void> {
  const artifactPath = path.join(repoRoot, "artifacts", "live-execution-worker-latest.json");
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`);
}

async function runDecisionWithCmcFallback(): Promise<StrategyDecision> {
  try {
    return await runDecision();
  } catch (error) {
    console.error(`cmc_decision_fallback=${error instanceof Error ? error.message : String(error)}`);
    return runDecision({ cmcMode: "mock" });
  }
}

async function assertRpcQuorum(primary: JsonRpcProvider, route: BuiltRoute): Promise<void> {
  if (!boolEnv("REQUIRE_RPC_QUORUM", true)) return;
  const secondaryUrl = optionalEnv("SECONDARY_BSC_RPC_URL");
  if (!secondaryUrl) throw new Error("REQUIRE_RPC_QUORUM=true but SECONDARY_BSC_RPC_URL is missing.");
  const secondary = new JsonRpcProvider(secondaryUrl);
  const [primaryNetwork, secondaryNetwork, primaryBlock, secondaryBlock] = await Promise.all([
    primary.getNetwork(),
    secondary.getNetwork(),
    primary.getBlockNumber(),
    secondary.getBlockNumber()
  ]);
  if (primaryNetwork.chainId !== 56n || secondaryNetwork.chainId !== 56n) {
    throw new Error(`RPC quorum chain mismatch primary=${primaryNetwork.chainId} secondary=${secondaryNetwork.chainId}`);
  }
  const maxLag = numberEnv("RPC_QUORUM_MAX_BLOCK_LAG", 3);
  if (Math.abs(primaryBlock - secondaryBlock) > maxLag) {
    throw new Error(`RPC quorum block lag too high primary=${primaryBlock} secondary=${secondaryBlock}`);
  }
  await secondary.call({ from: new Wallet(requireEnv("HOT_WALLET_PRIVATE_KEY")).address, to: route.receiverAddress, data: route.calldata });
}

async function disableBroadcast(reason: string): Promise<void> {
  updateDotEnv({
    ALLOW_LIVE_FLASH_SUBMIT: "false",
    ALLOW_LIVE_FLASH_ONESHOT: "false",
    BROADCAST_ROUTE_HASH: "",
    LAST_BROADCAST_DISABLED_AT: new Date().toISOString(),
    LAST_BROADCAST_DISABLED_REASON: reason
  });
}

async function pauseReceiverIfConfigured(reason: string): Promise<void> {
  if (!boolEnv("AUTO_PAUSE_ON_FAILURE", true)) return;
  try {
    const provider = await createCheckedProvider();
    const admin = new Wallet(requireEnv("PRIVATE_KEY"), provider);
    const receiver = new Contract(requireEnv("FLASH_RECEIVER_ADDRESS"), flashPoolBalancerAbi, admin);
    const paused = Boolean(await receiver.getFunction("paused")());
    if (paused) return;
    const tx = await receiver.getFunction("setPaused")(true, { gasPrice: configuredGasPrice() });
    console.log(`auto_pause_tx=${tx.hash} reason=${reason}`);
    await tx.wait();
  } catch (error) {
    console.error(`auto_pause_failed=${error instanceof Error ? error.message : String(error)}`);
  }
}

function receiptHasRouteSettled(receipt: { logs: readonly { topics: readonly string[]; data: string }[] }, routeHash: string): boolean {
  const iface = new Interface(flashPoolBalancerAbi);
  return receipt.logs.some((log) => {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      return parsed?.name === "RouteSettled" && String(parsed.args.routeHash).toLowerCase() === routeHash.toLowerCase();
    } catch {
      return false;
    }
  });
}

export async function runExecutionWorkerOnce(): Promise<WorkerResult> {
  loadDotEnv();
  const provider = await createCheckedProvider();
  const worker = new Wallet(requireEnv("HOT_WALLET_PRIVATE_KEY"), provider);
  const decision = await runDecisionWithCmcFallback();
  const discovery = await discoverBestV2Route(provider);
  const submitAllowed = boolEnv("ALLOW_LIVE_FLASH_SUBMIT", false);
  const requiredBroadcastRouteHash = optionalEnv("BROADCAST_ROUTE_HASH");

  const base: WorkerResult = {
    generatedAt: new Date().toISOString(),
    decision,
    discovery: {
      blockNumber: discovery.blockNumber,
      disabledVenues: discovery.disabledVenues,
      candidateCount: discovery.candidateCount,
      best: summarizeCandidate(discovery.best)
    },
    simulation: { attempted: false, passed: false },
    submission: { allowed: submitAllowed, submitted: false }
  };

  if (decision.finalAction !== "ready_for_manual_review") {
    const result = { ...base, submission: { ...base.submission, reason: `decision finalAction=${decision.finalAction}` } };
    await persistResult(result);
    return result;
  }
  if (!discovery.best) {
    const result = { ...base, submission: { ...base.submission, reason: "No live profitable USDT/WBNB V2 route after Aave premium, gas, slippage, and profit buffer." } };
    await persistResult(result);
    return result;
  }

  const route = await buildRoute(discovery.best, worker);
  const receiverInterface = new Interface(flashPoolBalancerAbi);
  const routeSummary = {
    receiverAddress: route.receiverAddress,
    executorAddress: route.executorAddress,
    assetAddress: route.assetAddress,
    amount: route.amount.toString(),
    minProfit: route.minProfit.toString(),
    deadline: route.deadline.toString(),
    routeHash: route.routeHash,
    quoteHash: route.quoteHash
  };

  try {
    if (requiredBroadcastRouteHash && requiredBroadcastRouteHash.toLowerCase() !== route.routeHash.toLowerCase()) {
      throw new Error(`BROADCAST_ROUTE_HASH mismatch expected=${requiredBroadcastRouteHash} actual=${route.routeHash}`);
    }
    await assertRpcQuorum(provider, route);
    await provider.call({ from: worker.address, to: route.receiverAddress, data: route.calldata });
    const gas = await worker.estimateGas({ to: route.receiverAddress, data: route.calldata });
    if (!submitAllowed) {
      const result = {
        ...base,
        route: routeSummary,
        simulation: { attempted: true, passed: true, gasEstimate: gas.toString() },
        submission: { allowed: false, submitted: false, reason: "Set one-shot broadcast for this route hash to submit." }
      };
      await persistResult(result);
      return result;
    }
    const tx = await worker.sendTransaction({ to: route.receiverAddress, data: route.calldata, gasLimit: (gas * 120n) / 100n, gasPrice: configuredGasPrice() });
    const receipt = await tx.wait();
    await disableBroadcast("one-shot consumed");
    if (!receipt || receipt.status !== 1 || !receiptHasRouteSettled(receipt, route.routeHash)) {
      await pauseReceiverIfConfigured("missing RouteSettled or failed receipt");
      throw new Error(`Submitted flash route failed post-check: ${tx.hash}`);
    }
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
    if (submitAllowed) {
      await disableBroadcast("simulation_or_submission_failure");
      await pauseReceiverIfConfigured("simulation_or_submission_failure");
    }
    const result = {
      ...base,
      route: routeSummary,
      simulation: {
        attempted: true,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        decodedError: decodeContractError(error, receiverInterface)
      },
      submission: { allowed: submitAllowed, submitted: false, reason: "eth_call, quorum, gas estimate, or receipt check failed; no continuing broadcast." }
    };
    await persistResult(result);
    return result;
  }
}

export async function runExecutionWorkerLoop(): Promise<void> {
  const once = process.argv.includes("--once");
  const intervalMs = numberEnv("WORKER_INTERVAL_MS", 15_000);
  do {
    try {
      const result = await runExecutionWorkerOnce();
      console.log(JSON.stringify({
        generatedAt: result.generatedAt,
        finalAction: result.decision.finalAction,
        candidate: result.discovery.best,
        simulationPassed: result.simulation.passed,
        decodedError: result.simulation.decodedError,
        submitted: result.submission.submitted,
        reason: result.submission.reason
      }, null, 2));
    } catch (error) {
      console.error(`worker_loop_error=${error instanceof Error ? error.message : String(error)}`);
    }
    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runExecutionWorkerLoop();
}
