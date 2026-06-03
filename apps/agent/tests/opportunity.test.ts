import { describe, expect, it } from "vitest";
import { defaultDemoQuotes, evaluateFlashOpportunity } from "../src/flash/opportunityEngine";

describe("evaluateFlashOpportunity", () => {
  it("computes positive dry-run route economics", () => {
    const opportunity = evaluateFlashOpportunity({ quotes: defaultDemoQuotes(new Date("2026-06-03T00:00:00Z")), amountUsd: 10000, borrowAsset: "USDT", maxQuoteAgeMs: 45000, now: new Date("2026-06-03T00:00:01Z") });
    expect(opportunity.isProfitable).toBe(true);
    expect(opportunity.buyDex).toBe("PancakeSwap");
    expect(opportunity.expectedProfitUsd).toBeGreaterThan(0);
  });

  it("rejects stale quotes", () => {
    const opportunity = evaluateFlashOpportunity({ quotes: defaultDemoQuotes(new Date("2026-06-03T00:00:00Z")), amountUsd: 10000, borrowAsset: "USDT", maxQuoteAgeMs: 1000, now: new Date("2026-06-03T00:01:00Z") });
    expect(opportunity.stale).toBe(true);
    expect(opportunity.isProfitable).toBe(false);
  });
});
