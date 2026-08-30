import { MAX_OFFER_AMOUNT_CENTS, SUPPORTED_PAYMENT_CURRENCIES } from "@/lib/payments/limits";

export type PaymentCurrency = (typeof SUPPORTED_PAYMENT_CURRENCIES)[number];

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return SUPPORTED_PAYMENT_CURRENCIES.includes(value as PaymentCurrency);
}

export function parseCents(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const cents = Number(text);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function validateAmountCents(
  cents: number,
  label: string,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return { ok: false, error: `${label} must be a positive whole-cent amount.` };
  }
  if (cents > MAX_OFFER_AMOUNT_CENTS) {
    return { ok: false, error: `${label} exceeds the configured payment ceiling.` };
  }
  return { ok: true };
}

export function centsToUsd(cents: number): number {
  return cents / 100;
}
