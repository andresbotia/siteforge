/**
 * Agent run lifecycle.
 *
 * Legal transitions:
 *   queued            → draft | awaiting_approval | cancelled
 *   draft             → awaiting_approval | cancelled
 *   awaiting_approval → approved | rejected | budget_blocked | cancelled
 *   approved          → running | budget_blocked | rejected | cancelled
 *   running           → succeeded | completed | failed
 *   succeeded         → (terminal)
 *   completed         → (terminal, legacy alias of succeeded)
 *   failed            → (terminal)
 *   rejected          → (terminal)
 *   budget_blocked    → awaiting_approval | cancelled
 *   cancelled         → (terminal)
 *
 * Execution rules:
 *   awaiting_approval, rejected, budget_blocked, running, and all terminal
 *   states cannot start provider execution.
 *   approved may execute only after a fresh budget reservation.
 *   completed/succeeded/failed rows are immutable except usage metadata
 *   written by finalize.
 */
export const AGENT_RUN_STATES = [
  "queued",
  "draft",
  "awaiting_approval",
  "approved",
  "running",
  "succeeded",
  "completed",
  "failed",
  "rejected",
  "budget_blocked",
  "cancelled",
] as const;

export type AgentRunLifecycle = (typeof AGENT_RUN_STATES)[number];

const TRANSITIONS: Record<AgentRunLifecycle, AgentRunLifecycle[]> = {
  queued: ["draft", "awaiting_approval", "cancelled"],
  draft: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["approved", "rejected", "budget_blocked", "cancelled"],
  approved: ["running", "budget_blocked", "rejected", "cancelled"],
  running: ["succeeded", "completed", "failed"],
  succeeded: [],
  completed: [],
  failed: [],
  rejected: [],
  budget_blocked: ["awaiting_approval", "cancelled"],
  cancelled: [],
};

export function canTransition(
  from: AgentRunLifecycle,
  to: AgentRunLifecycle,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: AgentRunLifecycle,
  to: AgentRunLifecycle,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal agent_run transition: ${from} -> ${to}`);
  }
}

export function canExecute(status: AgentRunLifecycle): boolean {
  return status === "approved";
}

export const TERMINAL_RUN_STATES: AgentRunLifecycle[] = [
  "succeeded",
  "completed",
  "failed",
  "rejected",
  "cancelled",
];
