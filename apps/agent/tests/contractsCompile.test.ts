import { describe, expect, it } from "vitest";
import { compileContract } from "../src/live/compiler";

describe("live Solidity contracts", () => {
  it("compile the receiver and V2 executor", () => {
    const receiver = compileContract("FlashPoolBalancer.sol", "FlashPoolBalancer");
    const executor = compileContract("V2TwoLegFlashExecutor.sol", "V2TwoLegFlashExecutor");
    expect(receiver.bytecode.length).toBeGreaterThan(1000);
    expect(executor.bytecode.length).toBeGreaterThan(1000);
  });
});
