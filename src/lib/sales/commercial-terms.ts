import {
  DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  DEFAULT_SETUP_AMOUNT_CENTS,
} from "@/lib/payments/limits";
import { centsToUsd } from "@/lib/payments/money";

/**
 * M10 Task 4. The commercial terms every prospect email must state, as FIXED,
 * non-editable content. Both the cold draft (src/lib/sales/draft.ts) and the
 * payment follow-up (src/lib/sales/follow-up.ts) embed these lines verbatim.
 *
 * Drafting logic must not reword, summarise, reorder, or omit any of them --
 * `commercial-terms.test.ts` asserts each clause is present byte-for-byte in
 * both draft bodies. The dollar amounts come from the same locked constants
 * the commercial offer and the Stripe Price IDs use, never a number the draft
 * invents.
 *
 * The previous copy stated "$99 setup plus optional $39/month" with no term
 * language, which implied the monthly began immediately. It does not: the
 * $99 one-time already includes the first year of hosting and the domain.
 */
function money(cents: number): string {
  const usd = centsToUsd(cents);
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

const SETUP = money(DEFAULT_SETUP_AMOUNT_CENTS);
const MONTHLY = money(DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS);

/**
 * The four fixed clauses, in order. `businessName` only fills the domain
 * ownership sentence; it is not otherwise interpolated.
 */
export function commercialTermsLines(businessName: string): string[] {
  const name = businessName.trim() || "your business";
  return [
    `The ${SETUP} is a one-time payment. It covers building and setting up the site, registering a domain, and the first year of hosting.`,
    `${MONTHLY}/month is optional and only applies after the first year. It covers hosting from then on plus any changes you want made. If you do not take it, nothing is owed after the ${SETUP}.`,
    `The domain is registered in ${name}'s name, with SiteForge listed only as the technical contact. It transfers to you on request at any time.`,
    `If the monthly is active and later lapses, the site stays online for 30 days and then comes down. Either way — lapsed or never started — we hand over the site files and transfer the domain to you.`,
  ];
}

/** The clauses as a single block, one clause per line, for a plain-text email. */
export function commercialTermsBlock(businessName: string): string {
  return commercialTermsLines(businessName).join("\n");
}

/** Heading the block sits under in both emails. */
export const COMMERCIAL_TERMS_HEADING = "How the pricing works:";

/**
 * Distinctive phrases from each of the four clauses, business-name-independent.
 * Used to gate a real send: an operator who edits the draft and strips or
 * rewords the terms cannot send it. This is the "non-editable" enforcement --
 * the terms live in code and the send path re-checks their presence.
 */
export const COMMERCIAL_TERMS_REQUIRED_PHRASES: readonly string[] = [
  "one-time payment",
  "the first year of hosting",
  "only applies after the first year",
  "listed only as the technical contact",
  "transfers to you on request",
  "the site stays online for 30 days and then comes down",
  "transfer the domain to you",
];

export function bodyStatesCommercialTerms(body: string | null | undefined): boolean {
  const text = (body ?? "").toLowerCase();
  return COMMERCIAL_TERMS_REQUIRED_PHRASES.every((phrase) =>
    text.includes(phrase.toLowerCase()),
  );
}
