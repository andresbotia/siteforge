import { centsToUsd } from "@/lib/payments/money";
import type { SendEmailInput } from "@/lib/email/types";

/**
 * M10 fulfillment follow-up. A plain, internal, operator-only notification
 * -- not prospect outreach. It carries none of the outreach-specific
 * machinery in `src/lib/email/delivery-policy.ts` (approval binding,
 * content-hash, attribution tokens, unsubscribe language, suppression,
 * duplicate-send blocking): none of that applies to a message SiteForge
 * sends to its own founder about its own payment event. It still goes
 * through the same generic mock/live `EmailProvider` gate as everything
 * else in `src/lib/email`, so it is a real send only when
 * `SITEFORGE_ALLOW_LIVE_EMAIL=true` and simulated otherwise.
 */
export type FounderPaymentNotificationInput = {
  businessName: string;
  amountTotalCents: number | null;
  currency: string | null;
  leadId: string;
  leadUrl: string;
};

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents === null) return "an unknown amount";
  const usd = centsToUsd(cents);
  const amount = Number.isInteger(usd) ? String(usd) : usd.toFixed(2);
  const code = (currency || "usd").toUpperCase();
  return `$${amount} ${code}`;
}

export function buildFounderPaymentNotificationEmail(
  input: FounderPaymentNotificationInput,
  options: { to: string; from: string },
): SendEmailInput {
  const amount = formatAmount(input.amountTotalCents, input.currency);
  return {
    to: options.to,
    from: options.from,
    subject: `Payment received: ${input.businessName} (${amount})`,
    text: [
      `${input.businessName} just completed checkout for ${amount}.`,
      "",
      `Lead: ${input.leadUrl}`,
    ].join("\n"),
    metadata: {
      notification: "founder_payment_success",
      lead_id: input.leadId,
    },
  };
}
