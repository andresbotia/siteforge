import { PER_RUN_CEILING_TICKS, type AiAgentId } from "./limits";
import { type Ticks } from "./money";

export type BudgetSnapshot = {
  dailyLimitTicks: Ticks;
  monthlyLimitTicks: Ticks;
  dailyActualTicks: Ticks;
  monthlyActualTicks: Ticks;
  reservedTicks: Ticks;
};

export type ReservationRequest = {
  agentId: AiAgentId;
  requestedTicks: Ticks;
  approvedLimitTicks: Ticks;
};

export type ReservationDecision =
  | { ok: true }
  | { ok: false; reason: string };

export function availableTicks(
  snapshot: BudgetSnapshot,
  period: "daily" | "monthly",
): Ticks {
  const limit =
    period === "daily" ? snapshot.dailyLimitTicks : snapshot.monthlyLimitTicks;
  const actual =
    period === "daily" ? snapshot.dailyActualTicks : snapshot.monthlyActualTicks;
  const remaining = limit - actual - snapshot.reservedTicks;
  return remaining > 0n ? remaining : 0n;
}

export function evaluateReservation(
  snapshot: BudgetSnapshot,
  request: ReservationRequest,
): ReservationDecision {
  if (request.approvedLimitTicks <= 0n) {
    return { ok: false, reason: "approved_cost_limit must be greater than zero" };
  }
  if (request.requestedTicks <= 0n) {
    return { ok: false, reason: "requested maximum must be greater than zero" };
  }
  if (request.requestedTicks > request.approvedLimitTicks) {
    return {
      ok: false,
      reason: "requested maximum exceeds approved cost limit",
    };
  }
  const ceiling = PER_RUN_CEILING_TICKS[request.agentId];
  if (request.requestedTicks > ceiling) {
    return { ok: false, reason: "requested maximum exceeds agent per-run ceiling" };
  }
  if (request.requestedTicks > availableTicks(snapshot, "daily")) {
    return { ok: false, reason: "daily budget exhausted" };
  }
  if (request.requestedTicks > availableTicks(snapshot, "monthly")) {
    return { ok: false, reason: "monthly budget exhausted" };
  }
  return { ok: true };
}

export function applyReservation(
  snapshot: BudgetSnapshot,
  ticks: Ticks,
): BudgetSnapshot {
  return {
    ...snapshot,
    reservedTicks: snapshot.reservedTicks + ticks,
  };
}

export function consumeReservation(
  snapshot: BudgetSnapshot,
  reserved: Ticks,
  actual: Ticks,
): BudgetSnapshot {
  const nextReserved =
    snapshot.reservedTicks >= reserved
      ? snapshot.reservedTicks - reserved
      : 0n;
  return {
    ...snapshot,
    reservedTicks: nextReserved,
    dailyActualTicks: snapshot.dailyActualTicks + actual,
    monthlyActualTicks: snapshot.monthlyActualTicks + actual,
  };
}

export function releaseReservation(
  snapshot: BudgetSnapshot,
  reserved: Ticks,
): BudgetSnapshot {
  return {
    ...snapshot,
    reservedTicks:
      snapshot.reservedTicks >= reserved
        ? snapshot.reservedTicks - reserved
        : 0n,
  };
}
