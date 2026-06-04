import { Contract, formatUnits, getAddress, JsonRpcProvider, keccak256, parseUnits, toUtf8Bytes } from "ethers";
import { erc20Abi, v2RouterAbi } from "./abis";
import { configuredGasPrice } from "./rpc";
import { numberEnv, optionalEnv, requireEnv } from "./env";

export interface V2Venue {
  name: string;
  router: string;
}

export interface V2LiveRouteCandidate {
  buyVenue: V2Venue;
  sellVenue: V2Venue;
  asset: string;
  middleAsset: string;
  amountIn: bigint;
  leg1Out: bigint;
  finalOut: bigint;
  amountOutMinBuy: bigint;
  amountOutMinSell: bigint;
  premium: bigint;
  minProfit: bigint;
  estimatedGasCostAsset: bigint;
  netProfitAsset: bigint;
  deadline: bigint;
  quoteHash: string;
  quoteBlock: number;
  gasPriceWei: bigint;
}

export interface V2DiscoveryResult {
  blockNumber: number;
  disabledVenues: Array<{ name: string; router: string; reason: string }>;
  candidateCount: number;
  best?: V2LiveRouteCandidate;
}

export function applySlippage(value: bigint, slippageBps: number): bigint {
  return (value * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function premiumFor(amount: bigint, premiumBps: number): bigint {
  return (amount * BigInt(premiumBps)) / 10_000n;
}

export function routeQuoteHash(parts: {
  buyRouter: string;
  sellRouter: string;
  amountIn: bigint;
  leg1Out: bigint;
  finalOut: bigint;
  quoteBlock: number;
  deadline: bigint;
}): string {
  return keccak256(toUtf8Bytes([
    getAddress(parts.buyRouter),
    getAddress(parts.sellRouter),
    parts.amountIn.toString(),
    parts.leg1Out.toString(),
    parts.finalOut.toString(),
    String(parts.quoteBlock),
    parts.deadline.toString()
  ].join(":")));
}

function getVenue(name: string, envName: string): V2Venue {
  return { name, router: getAddress(requireEnv(envName)) };
}

function optionalVenue(name: string, envName: string): V2Venue | undefined {
  const value = optionalEnv(envName);
  return value ? { name, router: getAddress(value) } : undefined;
}

function dedupeVenues(venues: V2Venue[]): V2Venue[] {
  const seen = new Set<string>();
  const deduped: V2Venue[] = [];
  for (const venue of venues) {
    const key = venue.router.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(venue);
  }
  return deduped;
}

function uniqueBigints(values: bigint[]): bigint[] {
  return [...new Set(values.map((value) => value.toString()))].map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

function parseUsdGrid(decimals: number): bigint[] {
  const grid = (process.env.DISCOVERY_SIZE_USD_GRID || "10,25,50,100,250,500,1000,2500,5000,10000,25000,50000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return grid.map((value) => parseUnits(value, decimals));
}

function parseLiquidityBps(): number[] {
  return (process.env.DISCOVERY_LIQUIDITY_BPS || "1,2,5,10,20,50,100,200")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 10_000);
}

async function getAmountsOut(provider: JsonRpcProvider, router: string, amountIn: bigint, path: string[]): Promise<bigint[]> {
  const contract = new Contract(router, v2RouterAbi, provider);
  const amounts = await contract.getFunction("getAmountsOut")(amountIn, path);
  return (amounts as bigint[]).map(BigInt);
}

async function probeVenue(provider: JsonRpcProvider, venue: V2Venue, usdt: string, wbnb: string): Promise<string | undefined> {
  try {
    await getAmountsOut(provider, venue.router, parseUnits("1", 18), [usdt, wbnb]);
    await getAmountsOut(provider, venue.router, parseUnits("0.001", 18), [wbnb, usdt]);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
  }
}

async function estimateGasCostInAsset(provider: JsonRpcProvider, pancakeRouter: string, wbnb: string, usdt: string, gasPriceWei: bigint): Promise<bigint> {
  const gasUnits = BigInt(Math.round(numberEnv("LIVE_ROUTE_GAS_UNITS", 950_000)));
  const gasBnb = gasPriceWei * gasUnits;
  try {
    const amounts = await getAmountsOut(provider, pancakeRouter, gasBnb, [wbnb, usdt]);
    return amounts[amounts.length - 1] ?? 0n;
  } catch {
    return parseUnits(String(numberEnv("LIVE_ROUTE_FALLBACK_GAS_USD", 1.25)), 18);
  }
}

export async function discoverBestV2Route(provider: JsonRpcProvider): Promise<V2DiscoveryResult> {
  const blockNumber = await provider.getBlockNumber();
  const usdt = getAddress(requireEnv("TOKEN_USDT"));
  const wbnb = getAddress(requireEnv("TOKEN_WBNB"));
  const aavePool = getAddress(requireEnv("AAVE_POOL_ADDRESS"));
  const venues = dedupeVenues([
    getVenue("PancakeSwapV2", "PANCAKESWAP_ROUTER"),
    getVenue("BiswapSmart", "BISWAP_ROUTER"),
    optionalVenue("BiswapV2", "BISWAP_V2_ROUTER"),
    getVenue("UniswapV2BNB", "UNISWAP_V2_ROUTER")
  ].filter((venue): venue is V2Venue => Boolean(venue)));
  const disabledVenues: V2DiscoveryResult["disabledVenues"] = [];
  const activeVenues: V2Venue[] = [];
  for (const venue of venues) {
    const reason = await probeVenue(provider, venue, usdt, wbnb);
    if (reason) disabledVenues.push({ ...venue, reason });
    else activeVenues.push(venue);
  }
  if (activeVenues.length < 2) return { blockNumber, disabledVenues, candidateCount: 0 };

  const usdtContract = new Contract(usdt, erc20Abi, provider);
  const decimals = Number(await usdtContract.getFunction("decimals")());
  const aaveLiquidity = BigInt(await usdtContract.getFunction("balanceOf")(aavePool));
  const minBorrow = parseUnits(String(numberEnv("DISCOVERY_MIN_BORROW_USD", 10)), decimals);
  const liquiditySizes = parseLiquidityBps().map((bps) => (aaveLiquidity * BigInt(bps)) / 10_000n);
  const sizes = uniqueBigints([...parseUsdGrid(decimals), ...liquiditySizes]).filter((amount) => amount >= minBorrow && amount <= aaveLiquidity);
  const slippageBps = numberEnv("MAX_SLIPPAGE_BPS", 75);
  const premiumBps = numberEnv("AAVE_FLASH_PREMIUM_BPS", 5);
  const minProfit = parseUnits(String(numberEnv("MIN_PROFIT_USD", 0)), decimals);
  const profitBuffer = parseUnits(String(numberEnv("LIVE_PROFIT_BUFFER_USD", 0.25)), decimals);
  const gasPriceWei = configuredGasPrice();
  const gasCost = await estimateGasCostInAsset(provider, requireEnv("PANCAKESWAP_ROUTER"), wbnb, usdt, gasPriceWei);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + numberEnv("FLASH_ROUTE_DEADLINE_SECONDS", 75));

  let best: V2LiveRouteCandidate | undefined;
  let candidateCount = 0;
  for (const amountIn of sizes) {
    for (const buyVenue of activeVenues) {
      for (const sellVenue of activeVenues) {
        if (buyVenue.router.toLowerCase() === sellVenue.router.toLowerCase()) continue;
        try {
          const buyAmounts = await getAmountsOut(provider, buyVenue.router, amountIn, [usdt, wbnb]);
          const leg1Out = buyAmounts[buyAmounts.length - 1] ?? 0n;
          if (leg1Out <= 0n) continue;
          const sellAmounts = await getAmountsOut(provider, sellVenue.router, leg1Out, [wbnb, usdt]);
          const finalOut = sellAmounts[sellAmounts.length - 1] ?? 0n;
          const premium = premiumFor(amountIn, premiumBps);
          const netProfitAsset = finalOut - amountIn - premium - minProfit - gasCost - profitBuffer;
          candidateCount++;
          if (netProfitAsset <= 0n) continue;
          const candidate: V2LiveRouteCandidate = {
            buyVenue,
            sellVenue,
            asset: usdt,
            middleAsset: wbnb,
            amountIn,
            leg1Out,
            finalOut,
            amountOutMinBuy: applySlippage(leg1Out, slippageBps),
            amountOutMinSell: applySlippage(finalOut, slippageBps),
            premium,
            minProfit,
            estimatedGasCostAsset: gasCost,
            netProfitAsset,
            deadline,
            quoteHash: routeQuoteHash({ buyRouter: buyVenue.router, sellRouter: sellVenue.router, amountIn, leg1Out, finalOut, quoteBlock: blockNumber, deadline }),
            quoteBlock: blockNumber,
            gasPriceWei
          };
          if (!best || candidate.netProfitAsset > best.netProfitAsset) best = candidate;
        } catch {
          // Some size/venue combinations legitimately fail due to missing liquidity.
        }
      }
    }
  }
  return { blockNumber, disabledVenues, candidateCount, best };
}

export function summarizeCandidate(candidate: V2LiveRouteCandidate | undefined): Record<string, unknown> | undefined {
  if (!candidate) return undefined;
  return {
    buyVenue: candidate.buyVenue.name,
    sellVenue: candidate.sellVenue.name,
    amountIn: formatUnits(candidate.amountIn, 18),
    leg1OutWbnb: formatUnits(candidate.leg1Out, 18),
    finalOut: formatUnits(candidate.finalOut, 18),
    premium: formatUnits(candidate.premium, 18),
    estimatedGasCostUsd: formatUnits(candidate.estimatedGasCostAsset, 18),
    netProfitUsd: formatUnits(candidate.netProfitAsset, 18),
    quoteBlock: candidate.quoteBlock,
    quoteHash: candidate.quoteHash
  };
}
