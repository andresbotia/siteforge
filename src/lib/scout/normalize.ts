const LEGAL_SUFFIXES =
  /\b(llc|l\.l\.c|inc|incorporated|corp|corporation|co|ltd|limited|company|pllc|pc)\b/gi;

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.length >= 7 ? digits : null;
}

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (!host || host === "localhost") return null;
    return host;
  } catch {
    return null;
  }
}

export function parseLocation(input: string): { city: string; state: string; label: string } {
  const trimmed = input.trim();
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts[0],
      state: parts[1].replace(/\d+/g, "").trim() || parts[1],
      label: `${parts[0]}, ${parts[1]}`,
    };
  }
  return { city: trimmed, state: "", label: trimmed };
}

export function locationMatches(
  candidateCity: string,
  candidateState: string,
  query: { city: string; state: string },
): boolean {
  const city = candidateCity.trim().toLowerCase();
  const state = candidateState.trim().toLowerCase();
  const qCity = query.city.trim().toLowerCase();
  const qState = query.state.trim().toLowerCase();
  if (!qCity) return true;
  if (city !== qCity) return false;
  if (!qState) return true;
  return state === qState || state.startsWith(qState);
}
