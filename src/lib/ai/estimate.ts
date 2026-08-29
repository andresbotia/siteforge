import { DEFAULT_XAI_MODEL } from "./limits";
import { type Ticks } from "./money";
import {
  isXaiModelId,
  PRICING_VERSION,
  ratesForPromptSize,
  TOOL_PRICING_TICKS_PER_THOUSAND,
  type XaiModelId,
} from "./pricing";

export type EstimateInput = {
  model?: string;
  inputTokens: number;
  maxOutputTokens: number;
  cachedInputTokens?: number;
  webSearchCalls?: number;
  xSearchCalls?: number;
  codeExecutionCalls?: number;
};

export type CostEstimate = {
  model: XaiModelId;
  pricingVersion: string;
  estimatedTicks: Ticks;
  conservativeMaxTicks: Ticks;
  longContext: boolean;
};

function tokensToTicks(tokens: number, ticksPerMillion: Ticks): Ticks {
  const safe = BigInt(Math.max(0, Math.ceil(tokens)));
  return (safe * ticksPerMillion) / 1_000_000n;
}

function callsToTicks(calls: number, ticksPerThousand: Ticks): Ticks {
  const safe = BigInt(Math.max(0, Math.ceil(calls)));
  return (safe * ticksPerThousand) / 1000n;
}

/**
 * Conservative estimator. Approved spend ceilings must use conservativeMaxTicks,
 * never the optimistic estimate. Provider-reported cost is authoritative after
 * execution.
 */
export function estimateAiCost(input: EstimateInput): CostEstimate {
  const requested = input.model ?? DEFAULT_XAI_MODEL;
  const model: XaiModelId = isXaiModelId(requested)
    ? requested
    : DEFAULT_XAI_MODEL;
  const promptTokens = Math.max(0, Math.ceil(input.inputTokens));
  const cached = Math.min(
    promptTokens,
    Math.max(0, Math.ceil(input.cachedInputTokens ?? 0)),
  );
  const uncached = promptTokens - cached;
  const maxOutput = Math.max(0, Math.ceil(input.maxOutputTokens));
  const rates = ratesForPromptSize(model, promptTokens);

  const toolTicks =
    callsToTicks(input.webSearchCalls ?? 0, TOOL_PRICING_TICKS_PER_THOUSAND.webSearch) +
    callsToTicks(input.xSearchCalls ?? 0, TOOL_PRICING_TICKS_PER_THOUSAND.xSearch) +
    callsToTicks(
      input.codeExecutionCalls ?? 0,
      TOOL_PRICING_TICKS_PER_THOUSAND.codeExecution,
    );

  const estimated =
    tokensToTicks(uncached, rates.inputTicksPerMillion) +
    tokensToTicks(cached, rates.cachedInputTicksPerMillion) +
    tokensToTicks(Math.ceil(maxOutput * 0.35), rates.outputTicksPerMillion) +
    toolTicks;

  const conservativeMax =
    tokensToTicks(uncached, rates.inputTicksPerMillion) +
    tokensToTicks(cached, rates.cachedInputTicksPerMillion) +
    tokensToTicks(maxOutput, rates.outputTicksPerMillion) +
    toolTicks;

  return {
    model,
    pricingVersion: PRICING_VERSION,
    estimatedTicks: estimated,
    conservativeMaxTicks: conservativeMax,
    longContext: promptTokens >= 200_000,
  };
}
