import { TICKS_PER_USD, type Ticks, usdToTicks } from "./money";

export const AI_AGENT_IDS = [
  "scout",
  "auditor",
  "builder",
  "sales",
  "manager",
] as const;

export type AiAgentId = (typeof AI_AGENT_IDS)[number];

export const AI_PROVIDER = "xai" as const;
export const XAI_API_BASE_URL = "https://api.x.ai/v1";
export const DEFAULT_XAI_MODEL = "grok-4.6";

/** Development default: $1.00 / UTC day. */
export const GLOBAL_DAILY_LIMIT_TICKS: Ticks = 1n * TICKS_PER_USD;
/** Development default: $10.00 / UTC month. */
export const GLOBAL_MONTHLY_LIMIT_TICKS: Ticks = 10n * TICKS_PER_USD;

export const PER_RUN_CEILING_TICKS: Record<AiAgentId, Ticks> = {
  scout: usdToTicks(0.25),
  auditor: usdToTicks(0.1),
  builder: usdToTicks(0.5),
  sales: usdToTicks(0.1),
  manager: usdToTicks(0.1),
};

export const LONG_CONTEXT_TOKEN_THRESHOLD = 200_000;
