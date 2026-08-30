import { createHash } from "node:crypto";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

export class MockEmailProvider implements EmailProvider {
  readonly id = "mock";

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!input.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to.trim())) {
      return {
        ok: false,
        provider: this.id,
        error: "Invalid recipient email address format.",
        simulated: true,
      };
    }

    const messageId = `msg_mock_${createHash("sha256")
      .update([input.to.trim().toLowerCase(), input.subject, input.text].join("|"))
      .digest("hex")
      .slice(0, 16)}`;
    return {
      ok: true,
      provider: this.id,
      messageId,
      simulated: true,
    };
  }
}

export const mockEmailProvider = new MockEmailProvider();
