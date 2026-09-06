import { COMMERCIAL_TERMS_HEADING, commercialTermsLines } from "@/lib/sales/commercial-terms";

/**
 * M10 fulfillment follow-up: the one-time "welcome, your site is live" email.
 *
 * Conceptually the `welcome_customer` outreach kind the task describes, but
 * implemented on the `customers` table (a timestamp guard, mirroring
 * `activation.ts`'s `activated_at` pattern) rather than folded into the
 * `outreach` table's approval-bound pipeline (`src/lib/sales/kinds.ts`,
 * `delivery-policy.ts`, content-hash approval binding, attribution tokens).
 * That machinery exists specifically for pre-purchase prospect email, where
 * SiteForge is asking a stranger for money and a human must approve the
 * exact content before it goes out. This is the opposite case: a
 * deterministic, single-recipient, informational message to an
 * already-paying customer, triggered by one explicit operator click, with
 * content sourced entirely from the same locked commercial-terms.ts clauses
 * already shown to that customer before they paid. Forcing it through the
 * outreach-approval queue would add a schema change and an approval step
 * for content that cannot vary and carries no persuasion risk.
 */
export const WELCOME_EMAIL_CONTENT_VERSION = "customer-welcome.v1";

/**
 * The only legal precondition: the site is confirmed live (customers.status
 * = "active", set by the "Mark site live" action) and this has not already
 * gone out once. Explicit error either way -- never a silent no-op --
 * matching `canActivateCustomerSite`'s convention.
 */
export function canSendWelcomeEmail(
  status: string,
  alreadySent: boolean,
): { ok: true } | { ok: false; error: string } {
  if (status !== "active") {
    return {
      ok: false,
      error: `Customer is "${status}", not "active" -- mark the site live before sending the welcome email.`,
    };
  }
  if (alreadySent) {
    return { ok: false, error: "The welcome email has already been sent to this customer." };
  }
  return { ok: true };
}

export type WelcomeEmailSentPatch = {
  production_url: string;
  welcome_email_sent_at: string;
};

/** Pure so the exact written fields are testable without a database. */
export function buildWelcomeEmailSentPatch(
  productionUrl: string,
  now: Date = new Date(),
): WelcomeEmailSentPatch {
  return { production_url: productionUrl, welcome_email_sent_at: now.toISOString() };
}

export type WelcomeCustomerEmailInput = {
  businessName: string;
  siteUrl: string;
};

export type WelcomeCustomerEmail = {
  subject: string;
  body: string;
};

/**
 * Deterministic, $0, no LLM. Voice follows the cold-email skill's guidance
 * (.claude/skills/cold-email): peer-to-peer, short, plain language, no
 * corporate filler, one clear point per paragraph. The domain/hosting/
 * no-lock-in language is `commercialTermsLines()` verbatim -- the exact
 * same source of truth the cold and payment-follow-up emails already embed
 * -- so this message and those can never say something different about the
 * same commercial terms.
 */
export function composeWelcomeCustomerEmail(
  input: WelcomeCustomerEmailInput,
): WelcomeCustomerEmail {
  const businessName = input.businessName.trim();
  const subject = "your site is live";
  const body = [
    `Hi ${businessName} team,`,
    "",
    `Your site is live: ${input.siteUrl}`,
    "",
    `Take a look when you get a chance -- especially on your phone, since that's where most people will see it first.`,
    "",
    COMMERCIAL_TERMS_HEADING,
    ...commercialTermsLines(businessName),
    "",
    `If anything looks off, or you want something changed, just reply to this email -- you'll be talking to me directly, not a support queue.`,
    "",
    `Best,`,
    `Andres Botia`,
    `SiteForge`,
  ].join("\n");
  return { subject, body };
}
