import { describe, expect, it } from "vitest";

interface RouteCase {
  callerIsPool: boolean;
  initiatorIsReceiver: boolean;
  borrowed: bigint;
  premium: bigint;
  minProfit: bigint;
  finalBalance: bigint;
  executorAllowed: boolean;
  assetAllowed: boolean;
  approvalOk: boolean;
}

function simulateExecuteOperation(route: RouteCase): { ok: true; profit: bigint } | { ok: false; error: string } {
  if (!route.callerIsPool) return { ok: false, error: "UnauthorizedPoolCaller" };
  if (!route.initiatorIsReceiver) return { ok: false, error: "InvalidInitiator" };
  if (!route.assetAllowed) return { ok: false, error: "AssetNotAllowed" };
  if (!route.executorAllowed) return { ok: false, error: "ExecutorNotAllowed" };
  if (!route.approvalOk) return { ok: false, error: "ApprovalFailed" };
  const required = route.borrowed + route.premium + route.minProfit;
  if (route.finalBalance < required) return { ok: false, error: "UnprofitableRoute" };
  return { ok: true, profit: route.finalBalance - route.borrowed - route.premium };
}

describe("FlashPoolBalancer model", () => {
  it("repays profitable routes atomically", () => {
    const result = simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 10_000n, premium: 5n, minProfit: 50n, finalBalance: 10_080n, executorAllowed: true, assetAllowed: true, approvalOk: true });
    expect(result).toEqual({ ok: true, profit: 75n });
  });

  it("reverts unprofitable routes", () => {
    const result = simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 10_000n, premium: 5n, minProfit: 50n, finalBalance: 10_020n, executorAllowed: true, assetAllowed: true, approvalOk: true });
    expect(result).toEqual({ ok: false, error: "UnprofitableRoute" });
  });

  it("rejects unauthorized callers, allowlist misses, and missing approvals", () => {
    expect(simulateExecuteOperation({ callerIsPool: false, initiatorIsReceiver: true, borrowed: 1n, premium: 1n, minProfit: 1n, finalBalance: 3n, executorAllowed: true, assetAllowed: true, approvalOk: true })).toEqual({ ok: false, error: "UnauthorizedPoolCaller" });
    expect(simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 1n, premium: 1n, minProfit: 1n, finalBalance: 3n, executorAllowed: false, assetAllowed: true, approvalOk: true })).toEqual({ ok: false, error: "ExecutorNotAllowed" });
    expect(simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 1n, premium: 1n, minProfit: 1n, finalBalance: 3n, executorAllowed: true, assetAllowed: false, approvalOk: true })).toEqual({ ok: false, error: "AssetNotAllowed" });
    expect(simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 1n, premium: 1n, minProfit: 1n, finalBalance: 3n, executorAllowed: true, assetAllowed: true, approvalOk: false })).toEqual({ ok: false, error: "ApprovalFailed" });
  });
});
