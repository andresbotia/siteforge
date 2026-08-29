import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  applyReservation,
  consumeReservation,
  evaluateReservation,
  type BudgetSnapshot,
} from "./budget";
import { estimateAiCost } from "./estimate";
import {
  GLOBAL_DAILY_LIMIT_TICKS,
  GLOBAL_MONTHLY_LIMIT_TICKS,
  PER_RUN_CEILING_TICKS,
} from "./limits";
import {
  formatTicksAsUsd,
  TICKS_PER_USD,
  ticksToUsd,
  usdToTicks,
} from "./money";
import { createMockAiProvider } from "./provider-core";
import { PaidAiRuntime, type RuntimeRun } from "./runtime";
import {
  assertTransition,
  canExecute,
  canTransition,
} from "./state-machine";
import { parseProviderUsage } from "./usage";

const mockRequest = {
  model: "grok-4.6",
  messages: [{ role: "user" as const, content: "fixture" }],
};

const mockUsage = {
  id: "mock-completion",
  model: "grok-4.6",
  usage: {
    prompt_tokens: 1200,
    completion_tokens: 400,
    total_tokens: 1600,
    prompt_tokens_details: { cached_tokens: 100 },
    completion_tokens_details: { reasoning_tokens: 50 },
    cost_in_usd_ticks: 250000000,
  },
};

function emptyBudget(): BudgetSnapshot {
  return {
    dailyLimitTicks: GLOBAL_DAILY_LIMIT_TICKS,
    monthlyLimitTicks: GLOBAL_MONTHLY_LIMIT_TICKS,
    dailyActualTicks: 0n,
    monthlyActualTicks: 0n,
    reservedTicks: 0n,
  };
}

function seedApproved(
  runtime: PaidAiRuntime,
  runId: string,
  approvalId: string,
  limit: bigint,
): void {
  runtime.runs.set(runId, {
    id: runId,
    agentId: "scout",
    status: "approved",
    approvedLimitTicks: limit,
    actualTicks: 0n,
    reservedTicks: 0n,
    reservationStatus: "none",
    usage: null,
  } satisfies RuntimeRun);
  runtime.approvals.set(approvalId, {
    id: approvalId,
    runId,
    status: "approved",
    type: "paid_ai_usage",
    approvedLimitTicks: limit,
  });
}

describe("money", () => {
  it("uses 10^10 ticks per USD", () => {
    assert.equal(TICKS_PER_USD, 10_000_000_000n);
    assert.equal(usdToTicks(1), TICKS_PER_USD);
    assert.equal(usdToTicks(0.1), 1_000_000_000n);
    assert.equal(usdToTicks(0.03), 300_000_000n);
  });

  it("converts ticks to USD for display", () => {
    assert.equal(ticksToUsd(37_756_000n), 0.0037756);
    assert.equal(formatTicksAsUsd(TICKS_PER_USD), "$1.00");
  });
});

describe("estimator", () => {
  it("returns a conservative max at or above the estimate", () => {
    const estimate = estimateAiCost({
      model: "grok-4.6",
      inputTokens: 1_200,
      maxOutputTokens: 800,
    });
    assert.equal(estimate.model, "grok-4.6");
    assert.ok(estimate.conservativeMaxTicks >= estimate.estimatedTicks);
    assert.equal(estimate.longContext, false);
  });

  it("uses long-context rates at 200k tokens", () => {
    const short = estimateAiCost({
      model: "grok-4.6",
      inputTokens: 1_000,
      maxOutputTokens: 100,
    });
    const long = estimateAiCost({
      model: "grok-4.6",
      inputTokens: 200_000,
      maxOutputTokens: 100,
    });
    assert.equal(long.longContext, true);
    assert.ok(long.conservativeMaxTicks > short.conservativeMaxTicks);
  });

  it("never lets an estimate override the approved ceiling", () => {
    const estimate = estimateAiCost({
      model: "grok-4.6",
      inputTokens: 50_000,
      maxOutputTokens: 8_000,
    });
    const approved = usdToTicks(0.1);
    const decision = evaluateReservation(emptyBudget(), {
      agentId: "scout",
      requestedTicks: estimate.conservativeMaxTicks,
      approvedLimitTicks: approved,
    });
    if (estimate.conservativeMaxTicks > approved) {
      assert.equal(decision.ok, false);
    }
  });
});

describe("state machine", () => {
  it("documents legal transitions", () => {
    assert.equal(canTransition("awaiting_approval", "approved"), true);
    assert.equal(canTransition("approved", "running"), true);
    assert.equal(canTransition("running", "succeeded"), true);
    assert.equal(canTransition("succeeded", "running"), false);
    assert.equal(canTransition("rejected", "approved"), false);
    assert.throws(() => assertTransition("failed", "running"));
  });

  it("only approved runs can execute", () => {
    assert.equal(canExecute("approved"), true);
    assert.equal(canExecute("awaiting_approval"), false);
    assert.equal(canExecute("rejected"), false);
    assert.equal(canExecute("budget_blocked"), false);
    assert.equal(canExecute("running"), false);
    assert.equal(canExecute("succeeded"), false);
  });
});

describe("usage parsing", () => {
  it("reads cost_in_usd_ticks as the actual billed cost", () => {
    const usage = parseProviderUsage(mockUsage);
    assert.equal(usage.costTicks, 250000000n);
    assert.equal(usage.inputTokens, 1200);
    assert.equal(usage.cachedInputTokens, 100);
    assert.equal(usage.outputTokens, 400);
    assert.equal(usage.reasoningTokens, 50);
  });

  it("tolerates missing optional fields", () => {
    const usage = parseProviderUsage({ usage: {} });
    assert.equal(usage.costTicks, null);
    assert.equal(usage.inputTokens, null);
  });
});

describe("budget calculations", () => {
  it("available budget subtracts actual and reserved", () => {
    const snapshot = applyReservation(
      {
        ...emptyBudget(),
        dailyActualTicks: usdToTicks(0.4),
      },
      usdToTicks(0.25),
    );
    assert.equal(
      snapshot.dailyLimitTicks - snapshot.dailyActualTicks - snapshot.reservedTicks,
      usdToTicks(0.35),
    );
    const after = consumeReservation(snapshot, usdToTicks(0.25), usdToTicks(0.05));
    assert.equal(after.reservedTicks, 0n);
    assert.equal(after.dailyActualTicks, usdToTicks(0.45));
  });
});

describe("paid AI runtime cases A–K", () => {
  const previousKey = process.env.XAI_API_KEY;
  const previousLive = process.env.XAI_ALLOW_LIVE_INFERENCE;

  before(() => {
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_ALLOW_LIVE_INFERENCE;
  });

  after(() => {
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
    if (previousLive === undefined) delete process.env.XAI_ALLOW_LIVE_INFERENCE;
    else process.env.XAI_ALLOW_LIVE_INFERENCE = previousLive;
  });

  it("A. no approval → provider cannot execute", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    runtime.runs.set("run-a", {
      id: "run-a",
      agentId: "scout",
      status: "awaiting_approval",
      approvedLimitTicks: 0n,
      actualTicks: 0n,
      reservedTicks: 0n,
      reservationStatus: "none",
      usage: null,
    });
    const result = await runtime.execute(
      "run-a",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.1),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /cannot_execute_awaiting_approval/);
  });

  it("B. rejected approval → provider cannot execute", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    runtime.runs.set("run-b", {
      id: "run-b",
      agentId: "scout",
      status: "awaiting_approval",
      approvedLimitTicks: 0n,
      actualTicks: 0n,
      reservedTicks: 0n,
      reservationStatus: "none",
      usage: null,
    });
    runtime.approvals.set("appr-b", {
      id: "appr-b",
      runId: "run-b",
      status: "pending",
      type: "paid_ai_usage",
      approvedLimitTicks: 0n,
    });
    runtime.reject("appr-b");
    const result = await runtime.execute(
      "run-b",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.1),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /cannot_execute_rejected/);
  });

  it("C. approved $0.10 → requested max $0.11 → blocked", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    seedApproved(runtime, "run-c", "appr-c", usdToTicks(0.1));
    const result = await runtime.execute(
      "run-c",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.11),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /exceeds approved cost limit/);
    }
    assert.equal(runtime.runs.get("run-c")?.status, "budget_blocked");
  });

  it("D. daily cap exhausted → blocked", async () => {
    const runtime = new PaidAiRuntime({
      ...emptyBudget(),
      dailyActualTicks: GLOBAL_DAILY_LIMIT_TICKS,
    });
    seedApproved(runtime, "run-d", "appr-d", usdToTicks(0.1));
    const result = await runtime.execute(
      "run-d",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.1),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /daily budget exhausted/);
  });

  it("E. monthly cap exhausted → blocked", async () => {
    const runtime = new PaidAiRuntime({
      ...emptyBudget(),
      monthlyLimitTicks: usdToTicks(0.2),
      monthlyActualTicks: usdToTicks(0.2),
      dailyLimitTicks: usdToTicks(10),
    });
    seedApproved(runtime, "run-e", "appr-e", usdToTicks(0.1));
    const result = await runtime.execute(
      "run-e",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.1),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /monthly budget exhausted/);
  });

  it("F. concurrent reservations cannot exceed the cap", async () => {
    const runtime = new PaidAiRuntime({
      ...emptyBudget(),
      dailyLimitTicks: usdToTicks(0.15),
    });
    seedApproved(runtime, "run-f1", "appr-f1", usdToTicks(0.1));
    seedApproved(runtime, "run-f2", "appr-f2", usdToTicks(0.1));
    const provider = createMockAiProvider(mockUsage);
    const [first, second] = await Promise.all([
      runtime.execute("run-f1", mockRequest, provider, usdToTicks(0.1)),
      runtime.execute("run-f2", mockRequest, provider, usdToTicks(0.1)),
    ]);
    const oks = [first.ok, second.ok];
    assert.equal(oks.filter(Boolean).length, 1);
    assert.equal(oks.filter((ok) => !ok).length, 1);
    const blocked = [first, second].find((item) => !item.ok);
    if (blocked && !blocked.ok) {
      assert.match(blocked.reason, /daily budget exhausted/);
    }
  });

  it("G. missing XAI_API_KEY fails closed without spending", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    seedApproved(runtime, "run-g", "appr-g", usdToTicks(0.1));
    const result = await runtime.execute(
      "run-g",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.1),
      { requireLiveKey: true },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /XAI_API_KEY is not configured/);
    assert.equal(runtime.snapshot.dailyActualTicks, 0n);
    assert.equal(runtime.snapshot.reservedTicks, 0n);
  });

  it("H. mock provider actual cost is persisted", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    seedApproved(runtime, "run-h", "appr-h", usdToTicks(0.1));
    const result = await runtime.execute(
      "run-h",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.1),
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.actualTicks, 250000000n);
    assert.equal(runtime.runs.get("run-h")?.actualTicks, 250000000n);
    assert.equal(runtime.runs.get("run-h")?.status, "succeeded");
  });

  it("I. actual cost lower than reservation releases the unused hold", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    seedApproved(runtime, "run-i", "appr-i", usdToTicks(0.1));
    await runtime.execute(
      "run-i",
      mockRequest,
      createMockAiProvider(mockUsage),
      usdToTicks(0.1),
    );
    assert.equal(runtime.snapshot.reservedTicks, 0n);
    assert.equal(runtime.snapshot.dailyActualTicks, 250000000n);
    assert.equal(runtime.runs.get("run-i")?.reservationStatus, "consumed");
  });

  it("J. provider error marks the run failed and releases the reservation", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    seedApproved(runtime, "run-j", "appr-j", usdToTicks(0.1));
    const result = await runtime.execute(
      "run-j",
      mockRequest,
      createMockAiProvider(null, { fail: true, error: "upstream" }),
      usdToTicks(0.1),
    );
    assert.equal(result.ok, false);
    assert.equal(runtime.runs.get("run-j")?.status, "failed");
    assert.equal(runtime.runs.get("run-j")?.reservationStatus, "released");
    assert.equal(runtime.snapshot.reservedTicks, 0n);
    assert.equal(runtime.snapshot.dailyActualTicks, 0n);
  });

  it("K. double execution is blocked", async () => {
    const runtime = new PaidAiRuntime(emptyBudget());
    seedApproved(runtime, "run-k", "appr-k", usdToTicks(0.1));
    const provider = createMockAiProvider(mockUsage);
    const first = await runtime.execute(
      "run-k",
      mockRequest,
      provider,
      usdToTicks(0.1),
    );
    const second = await runtime.execute(
      "run-k",
      mockRequest,
      provider,
      usdToTicks(0.1),
    );
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (!second.ok) assert.match(second.reason, /cannot_execute_succeeded/);
  });
});

describe("development defaults", () => {
  it("keeps centralized per-run ceilings", () => {
    assert.equal(PER_RUN_CEILING_TICKS.scout, usdToTicks(0.25));
    assert.equal(PER_RUN_CEILING_TICKS.auditor, usdToTicks(0.1));
    assert.equal(PER_RUN_CEILING_TICKS.builder, usdToTicks(0.5));
    assert.equal(PER_RUN_CEILING_TICKS.sales, usdToTicks(0.1));
    assert.equal(PER_RUN_CEILING_TICKS.manager, usdToTicks(0.1));
  });
});
