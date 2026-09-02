/**
 * Trusted, SiteForge-controlled Checkout success/cancel URL construction.
 * Never accepts a client-supplied redirect target -- the only input is an
 * internal commercial_offers.id (an unguessable UUID SiteForge itself
 * generated), and the path is always the fixed /checkout/success or
 * /checkout/cancel route.
 */
const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";

/**
 * SITEFORGE_APP_URL is optional: on Vercel, VERCEL_URL is populated
 * automatically without operator configuration; locally this falls back to
 * the standard Next.js dev port. Set SITEFORGE_APP_URL explicitly for a
 * custom production domain.
 */
export function resolveAppOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.SITEFORGE_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return DEFAULT_LOCAL_ORIGIN;
}

/**
 * `{CHECKOUT_SESSION_ID}` is a literal Stripe Checkout template token --
 * Stripe substitutes it server-side before redirecting the customer. It
 * must NOT be URL-encoded.
 */
export function buildCheckoutSuccessUrl(origin: string, offerId: string): string {
  return `${origin}/checkout/success?offer=${encodeURIComponent(offerId)}&session_id={CHECKOUT_SESSION_ID}`;
}

export function buildCheckoutCancelUrl(origin: string, offerId: string): string {
  return `${origin}/checkout/cancel?offer=${encodeURIComponent(offerId)}`;
}
