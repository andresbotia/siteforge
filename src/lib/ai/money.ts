/** Authoritative money unit: xAI USD ticks. 1 USD = 10_000_000_000 ticks. */

export const TICKS_PER_USD = 10_000_000_000n;
export const TICKS_PER_CENT = 100_000_000n;

export type Ticks = bigint;

export function parseTicks(value: unknown): Ticks {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return 0n;
}

/** Convert a USD amount to ticks using 4 decimal places (no float money math). */
export function usdToTicks(usd: number): Ticks {
  if (!Number.isFinite(usd) || usd <= 0) return 0n;
  const tenThousandths = Math.round(usd * 10_000);
  if (tenThousandths <= 0) return 0n;
  return (BigInt(tenThousandths) * TICKS_PER_USD) / 10_000n;
}

export function ticksToUsd(ticks: Ticks): number {
  const negative = ticks < 0n;
  const abs = negative ? -ticks : ticks;
  const dollars = abs / TICKS_PER_USD;
  const remainder = abs % TICKS_PER_USD;
  const fraction = Number(remainder) / Number(TICKS_PER_USD);
  const usd = Number(dollars) + fraction;
  return negative ? -usd : usd;
}

export const ticksToUsdNumber = ticksToUsd;

export function formatTicksAsUsd(ticks: Ticks): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(ticksToUsd(ticks));
}

export function maxTicks(left: Ticks, right: Ticks): Ticks {
  return left >= right ? left : right;
}

export function minTicks(left: Ticks, right: Ticks): Ticks {
  return left <= right ? left : right;
}
