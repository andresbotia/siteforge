import { parseProviderUsage, type ParsedAiUsage } from "./usage";

export type AiChatRequest = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxCompletionTokens?: number;
};

export type AiProviderResult = {
  ok: boolean;
  text: string | null;
  usage: ParsedAiUsage;
  raw: unknown;
  error?: string;
};

export type AiProvider = {
  complete(request: AiChatRequest): Promise<AiProviderResult>;
};

export function isLiveXaiEnabled(): boolean {
  return process.env.XAI_ALLOW_LIVE_INFERENCE === "true";
}

export function isXaiKeyConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export function createMockAiProvider(
  fixture: unknown,
  options?: { fail?: boolean; error?: string },
): AiProvider {
  return {
    async complete() {
      if (options?.fail) {
        return {
          ok: false,
          text: null,
          usage: parseProviderUsage(fixture),
          raw: fixture,
          error: options.error ?? "mock_provider_error",
        };
      }
      const usage = parseProviderUsage(fixture);
      return {
        ok: true,
        text: "mock response",
        usage,
        raw: fixture,
      };
    },
  };
}
