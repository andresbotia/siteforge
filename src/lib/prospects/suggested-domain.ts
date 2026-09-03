/**
 * M9.9 operator-supplied suggested domain.
 *
 * This value is typed in by hand by an operator who has checked availability
 * THEMSELVES. SiteForge performs no registry/WHOIS/DNS lookup here and must
 * never state or imply that the domain is available -- outreach copy phrases
 * it strictly as an example (see `src/lib/sales/draft.ts`). Storing it is a
 * note-to-self, not a claim.
 *
 * Validation is shape-only and deliberately conservative: a bare
 * registrable-looking hostname, no scheme, no path, no credentials, no port.
 * A value that does not pass is rejected rather than silently "cleaned" into
 * something the operator did not type.
 */
const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export const SUGGESTED_DOMAIN_MAX_LENGTH = 253;

export type SuggestedDomainResult =
  | { ok: true; domain: string | null }
  | { ok: false; error: string };

/** Lowercases and strips a leading "www." only; everything else must already be a bare domain. */
export function normalizeSuggestedDomain(value: string | null | undefined): SuggestedDomainResult {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return { ok: true, domain: null };
  if (raw.length > SUGGESTED_DOMAIN_MAX_LENGTH) {
    return { ok: false, error: "Suggested domain is too long." };
  }
  if (/[\s/@:?#]/.test(raw)) {
    return {
      ok: false,
      error: "Enter a bare domain such as example.com -- no scheme, path, port, or spaces.",
    };
  }
  const domain = raw.startsWith("www.") ? raw.slice(4) : raw;
  if (!DOMAIN_PATTERN.test(domain)) {
    return { ok: false, error: "Enter a valid bare domain such as exampleplumbing.com." };
  }
  return { ok: true, domain };
}
