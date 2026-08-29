export const AI_ACTIVITY_EVENTS = [
  "ai_run_requested",
  "paid_ai_approval_created",
  "paid_ai_approved",
  "paid_ai_rejected",
  "budget_reserved",
  "ai_run_started",
  "ai_run_completed",
  "ai_run_failed",
  "budget_blocked",
] as const;

export type AiActivityEvent = (typeof AI_ACTIVITY_EVENTS)[number];
