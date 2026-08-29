import "server-only";

import { XAI_API_BASE_URL } from "./limits";
import {
  isLiveXaiEnabled,
  isXaiKeyConfigured,
  type AiChatRequest,
  type AiProvider,
  type AiProviderResult,
} from "./provider-core";
import { parseProviderUsage } from "./usage";

export {
  createMockAiProvider,
  isLiveXaiEnabled,
  isXaiKeyConfigured,
  type AiChatRequest,
  type AiProvider,
  type AiProviderResult,
} from "./provider-core";

/**
 * Live xAI Chat Completions caller.
 * Must not be used unless XAI_ALLOW_LIVE_INFERENCE=true and a key is present.
 * Callers must still go through executeApprovedAiRun — this is not a public
 * "callXai(prompt)" helper.
 */
export function createLiveXaiProvider(): AiProvider {
  return {
    async complete(request: AiChatRequest): Promise<AiProviderResult> {
      const apiKey = process.env.XAI_API_KEY?.trim();
      if (!apiKey) {
        return {
          ok: false,
          text: null,
          usage: parseProviderUsage(null),
          raw: null,
          error: "XAI_API_KEY is not configured",
        };
      }
      if (!isLiveXaiEnabled()) {
        return {
          ok: false,
          text: null,
          usage: parseProviderUsage(null),
          raw: null,
          error: "Live xAI inference is disabled",
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(`${XAI_API_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            max_completion_tokens: request.maxCompletionTokens,
          }),
          signal: controller.signal,
        });
        const raw: unknown = await response.json().catch(() => null);
        const usage = parseProviderUsage(raw);
        if (!response.ok) {
          return {
            ok: false,
            text: null,
            usage,
            raw: summarizeRaw(raw),
            error: `xAI HTTP ${response.status}`,
          };
        }
        const record =
          raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        const choices = Array.isArray(record.choices) ? record.choices : [];
        const first =
          choices[0] && typeof choices[0] === "object"
            ? (choices[0] as Record<string, unknown>)
            : {};
        const message =
          first.message && typeof first.message === "object"
            ? (first.message as Record<string, unknown>)
            : {};
        return {
          ok: true,
          text: typeof message.content === "string" ? message.content : null,
          usage,
          raw: summarizeRaw(raw),
        };
      } catch (error) {
        return {
          ok: false,
          text: null,
          usage: parseProviderUsage(null),
          raw: null,
          error: error instanceof Error ? error.name : "xai_request_failed",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function summarizeRaw(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  return {
    id: record.id ?? null,
    model: record.model ?? null,
    usage: record.usage ?? null,
  };
}

export { isXaiKeyConfigured as xaiKeyConfigured };
