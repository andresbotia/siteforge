import type { CustomerStatus } from "@/types";

/**
 * The only legal source-status for "mark site live": a customer converted by
 * the Stripe webhook and still awaiting manual fulfillment (domain, DNS,
 * deploy -- all outside this codebase, see FULFILLMENT-RUNBOOK.md). This is
 * an operator confirmation, not a derived signal -- there is no production
 * deployment or DNS check behind it (AGENTS.md forbids that automation), so
 * the only thing this function can validate is the customer's current
 * status, exactly like `canTransitionLeadStatus` does for leads.
 */
export function canActivateCustomerSite(
  status: string,
): { ok: true } | { ok: false; error: string } {
  if (status === "pending_setup") return { ok: true };
  return {
    ok: false,
    error: `Customer is "${status}", not "pending_setup" -- only a customer awaiting setup can be marked live.`,
  };
}

export type CustomerActivationPatch = {
  status: Extract<CustomerStatus, "active">;
  activated_at: string;
};

/** Pure so the exact written fields are testable without a database. */
export function buildCustomerActivationPatch(now: Date = new Date()): CustomerActivationPatch {
  return { status: "active", activated_at: now.toISOString() };
}
