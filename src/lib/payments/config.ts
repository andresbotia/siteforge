/**
 * Server-only Stripe configuration reader. Mirrors src/lib/supabase/config-core.ts's
 * pattern: a pure function reading directly from a plain env object, no
 * "server-only" import marker (safe from a standalone script too), no
 * caching. Never returns or logs a secret value -- only presence/shape.
 *
 * Mode is derived, not a separate env var: STRIPE_ALLOW_LIVE_PAYMENTS is the
 * existing, AGENTS.md-documented live-payments gate from Milestone 9 and is
 * preserved unchanged. Within "live enabled," TEST vs LIVE is read from the
 * secret key's own Stripe-assigned prefix (sk_test_/sk_live_) rather than a
 * second, independently-settable env var -- a key's prefix cannot drift out
 * of sync with what it actually authorizes the way a hand-set STRIPE_MODE
 * variable could (e.g. STRIPE_MODE=test with a live key pasted in by
 * mistake). This is strictly additive: no existing env var was renamed or
 * removed.
 */
export type StripeKeyMode = "test" | "live" | "unknown";
export type StripeMode = "mock" | "test" | "live";

export type StripeSecretConfig = {
  secretKey: string;
  webhookSecret: string | null;
  setupPriceId: string | null;
  managedMonthlyPriceId: string | null;
};

export function classifyStripeKeyMode(key: string): StripeKeyMode {
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "unknown";
}

/** Returns null when STRIPE_SECRET_KEY is absent -- the only required field for a usable live/test config. */
export function getStripeSecretConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StripeSecretConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return {
    secretKey,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    setupPriceId: env.STRIPE_SITE_SETUP_PRICE_ID?.trim() || null,
    managedMonthlyPriceId: env.STRIPE_MANAGED_MONTHLY_PRICE_ID?.trim() || null,
  };
}

export type StripeConfigStatus = {
  mode: StripeMode;
  liveGateEnabled: boolean;
  secretKeyPresent: boolean;
  secretKeyMode: StripeKeyMode | null;
  webhookSecretPresent: boolean;
  setupPriceIdPresent: boolean;
  managedMonthlyPriceIdPresent: boolean;
  /** True once every field needed to actually create/verify a real checkout is present for the current mode. */
  ready: boolean;
};

/** Presence-only status for display (Settings, offers UI). Never includes a secret value. */
export function getStripeConfigStatus(env: NodeJS.ProcessEnv = process.env): StripeConfigStatus {
  const liveGateEnabled = env.STRIPE_ALLOW_LIVE_PAYMENTS === "true";
  const config = getStripeSecretConfigFromEnv(env);
  const secretKeyMode = config ? classifyStripeKeyMode(config.secretKey) : null;
  const mode: StripeMode = !liveGateEnabled ? "mock" : secretKeyMode === "live" ? "live" : "test";
  const webhookSecretPresent = Boolean(config?.webhookSecret);
  const setupPriceIdPresent = Boolean(config?.setupPriceId);
  const managedMonthlyPriceIdPresent = Boolean(config?.managedMonthlyPriceId);
  const ready = mode === "mock" || Boolean(config && webhookSecretPresent && setupPriceIdPresent && managedMonthlyPriceIdPresent);
  return {
    mode,
    liveGateEnabled,
    secretKeyPresent: Boolean(config),
    secretKeyMode,
    webhookSecretPresent,
    setupPriceIdPresent,
    managedMonthlyPriceIdPresent,
    ready,
  };
}
