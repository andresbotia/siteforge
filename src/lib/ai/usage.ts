import { parseTicks, type Ticks } from "./money";

export type ParsedAiUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  toolCalls: number | null;
  costTicks: Ticks | null;
};

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

/** Parse xAI usage. cost_in_usd_ticks is the authoritative billed cost. */
export function parseProviderUsage(payload: unknown): ParsedAiUsage {
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const usage =
    root.usage && typeof root.usage === "object"
      ? (root.usage as Record<string, unknown>)
      : root;

  const promptDetails =
    usage.prompt_tokens_details && typeof usage.prompt_tokens_details === "object"
      ? (usage.prompt_tokens_details as Record<string, unknown>)
      : usage.input_tokens_details && typeof usage.input_tokens_details === "object"
        ? (usage.input_tokens_details as Record<string, unknown>)
        : {};

  const completionDetails =
    usage.completion_tokens_details &&
    typeof usage.completion_tokens_details === "object"
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : usage.output_tokens_details && typeof usage.output_tokens_details === "object"
        ? (usage.output_tokens_details as Record<string, unknown>)
        : {};

  const costRaw = usage.cost_in_usd_ticks;
  const costTicks =
    costRaw === undefined || costRaw === null ? null : parseTicks(costRaw);

  return {
    inputTokens: asInt(usage.prompt_tokens) ?? asInt(usage.input_tokens),
    cachedInputTokens: asInt(promptDetails.cached_tokens),
    outputTokens: asInt(usage.completion_tokens) ?? asInt(usage.output_tokens),
    reasoningTokens: asInt(completionDetails.reasoning_tokens),
    totalTokens: asInt(usage.total_tokens),
    toolCalls:
      asInt(usage.num_server_side_tools_used) ?? asInt(usage.num_sources_used),
    costTicks,
  };
}
