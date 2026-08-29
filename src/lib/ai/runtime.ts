import {
  applyReservation,
  consumeReservation,
  evaluateReservation,
  releaseReservation,
  type BudgetSnapshot,
} from "./budget";
import { type AiAgentId } from "./limits";
import { type Ticks } from "./money";
import {
  isLiveXaiEnabled,
  isXaiKeyConfigured,
  type AiChatRequest,
  type AiProvider,
} from "./provider-core";
import { canExecute, type AgentRunLifecycle } from "./state-machine";

export type RuntimeRun = {
  id: string;
  agentId: AiAgentId;
  status: AgentRunLifecycle;
  approvedLimitTicks: Ticks;
  actualTicks: Ticks;
  reservedTicks: Ticks;
  reservationStatus: "none" | "reserved" | "consumed" | "released";
  usage: unknown;
};

export type RuntimeApproval = {
  id: string;
  runId: string;
  status: "pending" | "approved" | "rejected" | "executed";
  type: "paid_ai_usage";
  approvedLimitTicks: Ticks;
};

export type RuntimeResult =
  | {
      ok: true;
      actualTicks: Ticks;
      reservationStatus: RuntimeRun["reservationStatus"];
    }
  | { ok: false; reason: string };

/**
 * In-memory paid-AI runtime used by deterministic tests.
 * Mirrors production: lock around reserve and finalize only, not the
 * provider call, so two in-flight runs cannot oversubscribe the cap.
 */
export class PaidAiRuntime {
  runs = new Map<string, RuntimeRun>();
  approvals = new Map<string, RuntimeApproval>();
  snapshot: BudgetSnapshot;
  events: string[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor(snapshot: BudgetSnapshot) {
    this.snapshot = snapshot;
  }

  approve(approvalId: string, limit: Ticks) {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== "pending") {
      return { ok: false as const, reason: "approval_not_pending" };
    }
    approval.status = "approved";
    approval.approvedLimitTicks = limit;
    const run = this.runs.get(approval.runId);
    if (run && run.status === "awaiting_approval") {
      run.status = "approved";
      run.approvedLimitTicks = limit;
    }
    this.events.push("paid_ai_approved");
    return { ok: true as const };
  }

  reject(approvalId: string) {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== "pending") {
      return { ok: false as const, reason: "approval_not_pending" };
    }
    approval.status = "rejected";
    const run = this.runs.get(approval.runId);
    if (run) run.status = "rejected";
    this.events.push("paid_ai_rejected");
    return { ok: true as const };
  }

  async execute(
    runId: string,
    request: AiChatRequest,
    provider: AiProvider,
    requestedTicks: Ticks,
    options?: { requireLiveKey?: boolean },
  ): Promise<RuntimeResult> {
    if (options?.requireLiveKey && !isXaiKeyConfigured()) {
      return { ok: false, reason: "XAI_API_KEY is not configured" };
    }
    if (options?.requireLiveKey && !isLiveXaiEnabled()) {
      return { ok: false, reason: "Live xAI inference is disabled" };
    }

    const reserved = await this.withLock(() => this.reserve(runId, requestedTicks));
    if (!reserved.ok) return reserved;

    const run = this.runs.get(runId);
    const approval = [...this.approvals.values()].find(
      (item) => item.runId === runId && item.status === "approved",
    );
    if (!run) return { ok: false, reason: "run_not_found" };

    const result = await provider.complete(request);
    const actual = result.usage.costTicks ?? 0n;

    return this.withLock(() => {
      if (result.ok) {
        this.snapshot = consumeReservation(this.snapshot, requestedTicks, actual);
        run.status = "succeeded";
        run.actualTicks = actual;
        run.reservationStatus = actual > 0n ? "consumed" : "released";
        run.usage = result.raw;
        if (approval) approval.status = "executed";
        this.events.push("ai_run_completed");
        return {
          ok: true as const,
          actualTicks: actual,
          reservationStatus: run.reservationStatus,
        };
      }

      if (actual > 0n) {
        this.snapshot = consumeReservation(this.snapshot, requestedTicks, actual);
        run.reservationStatus = "consumed";
      } else {
        this.snapshot = releaseReservation(this.snapshot, requestedTicks);
        run.reservationStatus = "released";
      }
      run.status = "failed";
      run.actualTicks = actual;
      this.events.push("ai_run_failed");
      return { ok: false as const, reason: result.error ?? "provider_failed" };
    });
  }

  private reserve(runId: string, requestedTicks: Ticks): RuntimeResult {
    const run = this.runs.get(runId);
    if (!run) return { ok: false, reason: "run_not_found" };
    if (!canExecute(run.status)) {
      return { ok: false, reason: `cannot_execute_${run.status}` };
    }

    const approval = [...this.approvals.values()].find(
      (item) => item.runId === runId && item.status === "approved",
    );
    if (!approval) return { ok: false, reason: "approval_missing" };

    const decision = evaluateReservation(this.snapshot, {
      agentId: run.agentId,
      requestedTicks,
      approvedLimitTicks: approval.approvedLimitTicks,
    });
    if (!decision.ok) {
      run.status = "budget_blocked";
      this.events.push("budget_blocked");
      return { ok: false, reason: decision.reason };
    }

    this.snapshot = applyReservation(this.snapshot, requestedTicks);
    run.status = "running";
    run.reservedTicks = requestedTicks;
    run.reservationStatus = "reserved";
    this.events.push("budget_reserved", "ai_run_started");
    return { ok: true, actualTicks: 0n, reservationStatus: "reserved" };
  }

  private async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    let release!: () => void;
    const wait = this.chain;
    this.chain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await wait;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
