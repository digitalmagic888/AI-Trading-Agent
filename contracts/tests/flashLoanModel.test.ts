import { describe, expect, it } from "vitest";

interface RouteCase {
  callerIsPool: boolean;
  initiatorIsReceiver: boolean;
  borrowed: bigint;
  premium: bigint;
  minProfit: bigint;
  finalBalance: bigint;
  approvalOk: boolean;
}

function simulateExecuteOperation(route: RouteCase): { ok: true; profit: bigint } | { ok: false; error: string } {
  if (!route.callerIsPool) return { ok: false, error: "UnauthorizedPoolCaller" };
  if (!route.initiatorIsReceiver) return { ok: false, error: "InvalidInitiator" };
  const required = route.borrowed + route.premium + route.minProfit;
  if (route.finalBalance < required) return { ok: false, error: "UnprofitableRoute" };
  if (!route.approvalOk) return { ok: false, error: "ApprovalFailed" };
  return { ok: true, profit: route.finalBalance - route.borrowed - route.premium };
}

describe("FlashPoolBalancer model", () => {
  it("repays profitable routes atomically", () => {
    const result = simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 10_000n, premium: 9n, minProfit: 50n, finalBalance: 10_080n, approvalOk: true });
    expect(result).toEqual({ ok: true, profit: 71n });
  });

  it("reverts unprofitable routes", () => {
    const result = simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 10_000n, premium: 9n, minProfit: 50n, finalBalance: 10_020n, approvalOk: true });
    expect(result).toEqual({ ok: false, error: "UnprofitableRoute" });
  });

  it("rejects unauthorized callers and missing approvals", () => {
    expect(simulateExecuteOperation({ callerIsPool: false, initiatorIsReceiver: true, borrowed: 1n, premium: 1n, minProfit: 1n, finalBalance: 3n, approvalOk: true })).toEqual({ ok: false, error: "UnauthorizedPoolCaller" });
    expect(simulateExecuteOperation({ callerIsPool: true, initiatorIsReceiver: true, borrowed: 1n, premium: 1n, minProfit: 1n, finalBalance: 3n, approvalOk: false })).toEqual({ ok: false, error: "ApprovalFailed" });
  });
});
