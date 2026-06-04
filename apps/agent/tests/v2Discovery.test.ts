import { describe, expect, it } from "vitest";
import { applySlippage, premiumFor, routeQuoteHash } from "../src/live/v2Discovery";

describe("v2Discovery route math", () => {
  it("applies bps slippage deterministically", () => {
    expect(applySlippage(1_000_000n, 75)).toBe(992_500n);
  });

  it("computes Aave premium in bps", () => {
    expect(premiumFor(10_000_000n, 5)).toBe(5_000n);
  });

  it("creates stable route quote hashes", () => {
    const hash = routeQuoteHash({
      buyRouter: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      sellRouter: "0x0eB6949e725A295Ecb3BEacFc3766610BC970BEF",
      amountIn: 100n,
      leg1Out: 2n,
      finalOut: 101n,
      quoteBlock: 123,
      deadline: 456n
    });
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hash).toBe(routeQuoteHash({
      buyRouter: "0x10ed43c718714eb63d5aa57b78b54704e256024e",
      sellRouter: "0x0EB6949E725A295ECB3BEACFC3766610BC970BEF",
      amountIn: 100n,
      leg1Out: 2n,
      finalOut: 101n,
      quoteBlock: 123,
      deadline: 456n
    }));
  });
});
