import { LONG_CONTEXT_TOKEN_THRESHOLD } from "./limits";
import { TICKS_PER_USD, type Ticks } from "./money";

export type XaiModelId = "grok-4.6" | "grok-build-0.1";

export type TokenRates = {
  inputTicksPerMillion: Ticks;
  cachedInputTicksPerMillion: Ticks;
  outputTicksPerMillion: Ticks;
};

export type ModelPricing = {
  id: XaiModelId;
  contextWindow: number;
  short: TokenRates;
  long: TokenRates;
};

function usdPerMillionToTicks(usd: number): Ticks {
  return (BigInt(Math.round(usd * 100)) * TICKS_PER_USD) / 100n;
}

function rates(input: number, cached: number, output: number): TokenRates {
  return {
    inputTicksPerMillion: usdPerMillionToTicks(input),
    cachedInputTicksPerMillion: usdPerMillionToTicks(cached),
    outputTicksPerMillion: usdPerMillionToTicks(output),
  };
}

export const XAI_MODEL_PRICING: Record<XaiModelId, ModelPricing> = {
  "grok-4.6": {
    id: "grok-4.6",
    contextWindow: 500_000,
    short: rates(2, 0.5, 6),
    long: rates(4, 1, 12),
  },
  "grok-build-0.1": {
    id: "grok-build-0.1",
    contextWindow: 256_000,
    short: rates(1, 0.2, 2),
    long: rates(2, 0.4, 4),
  },
};

/** Server-side tools are not enabled in Milestone 3. Stored for estimates only. */
export const TOOL_PRICING_TICKS_PER_THOUSAND = {
  webSearch: (5n * TICKS_PER_USD) / 1000n,
  xSearch: (5n * TICKS_PER_USD) / 1000n,
  codeExecution: (5n * TICKS_PER_USD) / 1000n,
};

export const PRICING_VERSION = "2026-08-xai-docs";

export function isXaiModelId(value: string): value is XaiModelId {
  return value === "grok-4.6" || value === "grok-build-0.1";
}

export function ratesForPromptSize(
  model: XaiModelId,
  promptTokens: number,
): TokenRates {
  const pricing = XAI_MODEL_PRICING[model];
  return promptTokens >= LONG_CONTEXT_TOKEN_THRESHOLD
    ? pricing.long
    : pricing.short;
}
