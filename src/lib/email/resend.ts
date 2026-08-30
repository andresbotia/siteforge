import type { EmailConfig } from "./config-core";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";
import { isValidEmail } from "./validation";

export type ResendTransport = (
  url: string,
  init: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class ResendEmailProvider implements EmailProvider {
  readonly id = "resend";

  constructor(
    private readonly config: EmailConfig,
    private readonly transport: ResendTransport = fetch,
  ) {}

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.config.allowLiveEmail) {
      return { ok: false, provider: this.id, error: "Live email gate is disabled." };
    }
    if (!this.config.resendApiKey) {
      return { ok: false, provider: this.id, error: "RESEND_API_KEY is not configured." };
    }
    if (!input.to || !isValidEmail(input.to)) {
      return { ok: false, provider: this.id, error: "Invalid recipient email address format." };
    }
    if (!input.from) {
      return { ok: false, provider: this.id, error: "SITEFORGE_EMAIL_FROM is not configured." };
    }

    const idempotencyKey = input.metadata?.idempotency_key;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.resendApiKey}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);

    const response = await this.transport("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
        tags: [
          { name: "source", value: "siteforge" },
          ...(input.metadata?.outreach_id
            ? [{ name: "outreach_id", value: input.metadata.outreach_id }]
            : []),
        ],
      }),
    });
    const payload = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      return {
        ok: false,
        provider: this.id,
        error: String(asRecord(payload.error).message ?? payload.message ?? `Resend HTTP ${response.status}`),
      };
    }

    const messageId = typeof payload.id === "string" ? payload.id : undefined;
    return { ok: true, provider: this.id, messageId, simulated: false };
  }
}

export function createResendEmailProvider(
  config: EmailConfig,
  transport?: ResendTransport,
): EmailProvider {
  return new ResendEmailProvider(config, transport);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
