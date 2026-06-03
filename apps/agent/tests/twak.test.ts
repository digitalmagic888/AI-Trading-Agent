import { describe, expect, it } from "vitest";
import { buildTwakCommand } from "../src/trustwallet/twakClient";

describe("buildTwakCommand", () => {
  it("builds quote-only swap commands", () => {
    const command = buildTwakCommand({ action: "swapQuote", amount: "100", fromAsset: "USDT", toAsset: "WBNB", chain: "bnb" });
    expect(command.command).toBe("twak");
    expect(command.args).toContain("--quote-only");
    expect(command.args).toContain("bnb");
  });
});
