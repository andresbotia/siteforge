import type { EmailProviderStatus } from "@/types";
import { isValidEmail } from "./validation";

export type EmailConfig = {
  provider: "mock" | "resend";
  resendApiKey: string | null;
  from: string | null;
  replyTo: string | null;
  allowLiveEmail: boolean;
  internalTestRecipient: string | null;
  webhookSecret: string | null;
};

export function getEmailProviderStatus(config: EmailConfig): EmailProviderStatus {
  const providerKeyPresent = Boolean(config.resendApiKey);
  const fromConfigured = Boolean(config.from && isValidEmailAddressLike(config.from));
  const replyToConfigured = Boolean(config.replyTo && isValidEmail(config.replyTo));
  const internalTestRecipientConfigured = Boolean(
    config.internalTestRecipient && isValidEmail(config.internalTestRecipient),
  );
  const readyForInternalTest =
    config.allowLiveEmail && providerKeyPresent && fromConfigured && internalTestRecipientConfigured;

  return {
    provider: "resend",
    providerKeyPresent,
    liveEmailGateEnabled: config.allowLiveEmail,
    fromConfigured,
    replyToConfigured,
    internalTestRecipientConfigured,
    webhookSecretPresent: Boolean(config.webhookSecret),
    readyForInternalTest,
    readyForProspectSend: readyForInternalTest && replyToConfigured,
  };
}

export function isSafeInternalTestRecipient(
  recipient: string,
  config: EmailConfig,
): boolean {
  const normalized = recipient.trim().toLowerCase();
  return Boolean(
    normalized &&
      config.internalTestRecipient &&
      normalized === config.internalTestRecipient.trim().toLowerCase() &&
      isValidEmail(normalized),
  );
}

function isValidEmailAddressLike(value: string): boolean {
  const angleMatch = value.match(/<([^<>]+)>/);
  return isValidEmail(angleMatch?.[1] ?? value);
}
