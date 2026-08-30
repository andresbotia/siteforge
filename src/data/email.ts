import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { getEmailConfig, getEmailProviderStatus, isSafeInternalTestRecipient } from "@/lib/email/config";
import { liveEmailAllowed } from "@/lib/email/delivery-policy";
import { getEmailProvider, isValidEmail } from "@/lib/email/provider";

export type InternalEmailTestResult =
  | { ok: true; messageId?: string; simulated?: boolean }
  | { ok: false; error: string };

export async function sendInternalTestEmail(input: {
  recipient: string;
}): Promise<InternalEmailTestResult> {
  const recipient = input.recipient.trim();
  if (!isValidEmail(recipient)) return { ok: false, error: "A valid internal recipient is required." };

  const config = getEmailConfig();
  if (!isSafeInternalTestRecipient(recipient, config)) {
    return { ok: false, error: "Internal test sends are limited to the configured operator recipient." };
  }

  const status = getEmailProviderStatus(config);
  const liveAllowed = liveEmailAllowed({
    allowLiveEmail: config.allowLiveEmail,
    providerKeyPresent: status.providerKeyPresent,
    fromConfigured: status.fromConfigured,
    replyToConfigured: true,
  });
  if (!liveAllowed.ok) return liveAllowed;

  const provider = getEmailProvider();
  if (provider.id !== "resend") {
    return { ok: false, error: "Internal delivery test requires the real email provider." };
  }

  const result = await provider.sendEmail({
    to: recipient,
    from: config.from ?? "",
    replyTo: config.replyTo ?? undefined,
    subject: "[TEST] SiteForge M9.5C internal email delivery check",
    text: [
      "TEST email from SiteForge M9.5C.",
      "This message verifies operator-only delivery infrastructure.",
      "It is not prospect outreach and does not mutate lead funnel state.",
    ].join("\n"),
    metadata: {
      idempotency_key: `internal-test/${recipient.toLowerCase()}`,
      internal_test: "true",
    },
  });

  await recordActivityEvent({
    eventType: result.ok ? "internal_email_test_sent" : "internal_email_test_failed",
    title: result.ok ? "Internal email test sent" : "Internal email test failed",
    description: "M9.5C operator-only email delivery test. No prospect funnel state changed.",
    actorType: "admin",
    metadata: {
      provider: result.provider,
      message_id: result.messageId ?? "",
      simulated: result.simulated ?? false,
      recipient_allowed: true,
    },
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Internal email test failed." };
  return { ok: true, messageId: result.messageId, simulated: result.simulated };
}
