import "server-only";

import { getAuthConfig } from "@/lib/auth/config";
import {
  getEmailConnectionStatus as getEmailConnectionStatusCore,
  getEmailProviderStatus as getEmailProviderStatusCore,
  isSafeInternalTestRecipient as isSafeInternalTestRecipientCore,
  type EmailConfig,
} from "./config-core";

export type { EmailConfig };

export function getEmailConfig(): EmailConfig {
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || null;
  const from = process.env.SITEFORGE_EMAIL_FROM?.trim() || null;
  const replyTo = process.env.SITEFORGE_EMAIL_REPLY_TO?.trim() || null;
  const allowLiveEmail = process.env.SITEFORGE_ALLOW_LIVE_EMAIL === "true";
  const internalTestRecipient =
    process.env.SITEFORGE_INTERNAL_TEST_EMAIL?.trim() ||
    getAuthConfig()?.adminEmail ||
    null;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim() || null;

  return {
    provider: allowLiveEmail ? "resend" : "mock",
    resendApiKey,
    from,
    replyTo,
    allowLiveEmail,
    internalTestRecipient,
    webhookSecret,
  };
}

export function getEmailProviderStatus(config = getEmailConfig()) {
  return getEmailProviderStatusCore(config);
}

export function getEmailConnectionStatus(config = getEmailConfig()) {
  return getEmailConnectionStatusCore(getEmailProviderStatus(config));
}

export function isSafeInternalTestRecipient(recipient: string, config = getEmailConfig()) {
  return isSafeInternalTestRecipientCore(recipient, config);
}
