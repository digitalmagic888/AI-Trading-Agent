import { hashPayload } from "../hash";
import type { DexPoolQuote, FlashOpportunity } from "../types";

export interface OpportunityInput {
  quotes: DexPoolQuote[];
  amountUsd: number;
  borrowAsset: string;
  maxQuoteAgeMs: number;
  now?: Date;
  flashLoanPremiumBps?: number;
  gasCostUsd?: number;
  slippageBps?: number;
}

function newestPair(quotes: DexPoolQuote[]): [DexPoolQuote, DexPoolQuote] {
  if (quotes.length < 2) throw new Error("At least two DEX quotes are required to compare pool balance.");
  const sorted = [...quotes].sort((a, b) => a.price - b.price);
  return [sorted[0]!, sorted[sorted.length - 1]!];
}

export function defaultDemoQuotes(now = new Date()): DexPoolQuote[] {
  const timestamp = now.toISOString();
  return [
    { dex: "PancakeSwap", chain: "bnb", baseAsset: "WBNB", quoteAsset: "USDT", price: 600.0, reserveUsd: 8_500_000, feeBps: 25, timestamp },
    { dex: "Biswap", chain: "bnb", baseAsset: "WBNB", quoteAsset: "USDT", price: 606.8, reserveUsd: 2_200_000, feeBps: 20, timestamp }
  ];
}

export function evaluateFlashOpportunity(input: OpportunityInput): FlashOpportunity {
  const now = input.now ?? new Date();
  const [buy, sell] = newestPair(input.quotes);
  const grossSpreadBps = ((sell.price - buy.price) / buy.price) * 10_000;
  const dexFeeBps = buy.feeBps + sell.feeBps;
  const flashLoanPremiumBps = input.flashLoanPremiumBps ?? 9;
  const slippageBps = input.slippageBps ?? Math.min(120, Math.max(15, (input.amountUsd / Math.min(buy.reserveUsd, sell.reserveUsd)) * 10_000));
  const gasCostUsd = input.gasCostUsd ?? 3.5;
  const totalCostBps = dexFeeBps + flashLoanPremiumBps + slippageBps;
  const expectedProfitUsd = input.amountUsd * ((grossSpreadBps - totalCostBps) / 10_000) - gasCostUsd;
  const quoteAges = input.quotes.map((quote) => now.getTime() - new Date(quote.timestamp).getTime());
  const stale = quoteAges.some((age) => age > input.maxQuoteAgeMs || age < -5_000);
  const notes = [
    `Borrow ${input.borrowAsset}, buy ${buy.baseAsset} on ${buy.dex}, sell on ${sell.dex}.`,
    `Gross spread ${grossSpreadBps.toFixed(2)} bps; cost estimate ${totalCostBps.toFixed(2)} bps plus $${gasCostUsd.toFixed(2)} gas.`,
    stale ? "At least one quote is stale." : "Quotes are within freshness window."
  ];

  const payload = { buy, sell, amountUsd: input.amountUsd, borrowAsset: input.borrowAsset, grossSpreadBps, expectedProfitUsd, stale };
  return {
    id: `opp_${hashPayload(payload).slice(0, 16)}`,
    chain: "bnb",
    borrowAsset: input.borrowAsset,
    amountUsd: input.amountUsd,
    buyDex: buy.dex,
    sellDex: sell.dex,
    buyPrice: buy.price,
    sellPrice: sell.price,
    grossSpreadBps: Number(grossSpreadBps.toFixed(4)),
    dexFeeBps,
    flashLoanPremiumBps,
    slippageBps: Number(slippageBps.toFixed(4)),
    gasCostUsd,
    expectedProfitUsd: Number(expectedProfitUsd.toFixed(4)),
    expectedProfitBps: Number(((expectedProfitUsd / input.amountUsd) * 10_000).toFixed(4)),
    isProfitable: expectedProfitUsd > 0 && !stale,
    stale,
    notes
  };
}
