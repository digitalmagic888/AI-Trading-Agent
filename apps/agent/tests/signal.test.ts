import { describe, expect, it } from "vitest";
import { normalizeSignal } from "../src/cmc/normalizeSignals";

describe("normalizeSignal", () => {
  it("creates deterministic signal fields from mocked CMC output", () => {
    const signal = normalizeSignal({ uniqueName: "crypto_macro_overview", ok: true, raw: { confidence: 74, regime: "neutral", universe: ["WBNB", "USDT"] } });
    expect(signal.skillName).toBe("crypto_macro_overview");
    expect(signal.confidenceScore).toBe(74);
    expect(signal.recommendedUniverse).toContain("WBNB");
    expect(signal.rawResultHash).toHaveLength(64);
  });
});
