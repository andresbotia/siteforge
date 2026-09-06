"use server";

import { revalidatePath } from "next/cache";
import { activateCustomerSite, sendWelcomeEmail } from "@/data/customers";
import { requireAdminSession } from "@/lib/auth/guard";

export type ActivateCustomerSiteActionState = { ok: boolean; error?: string } | null;

/**
 * "Mark site live." Manual confirmation only -- never called from the
 * Stripe webhook, a reconcile pass, or anything else automatic. Does not
 * touch leads.status (that already flipped to "customer" at payment time
 * via the webhook); this only moves the separate customers.status field
 * from pending_setup to active once the operator has done the actual
 * fulfillment work (domain, DNS, deploy) outside the codebase.
 */
export async function activateCustomerSiteAction(
  _previousState: ActivateCustomerSiteActionState,
  formData: FormData,
): Promise<ActivateCustomerSiteActionState> {
  await requireAdminSession();

  const customerId = String(formData.get("customerId") ?? "").trim();
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!customerId) return { ok: false, error: "Missing customer." };

  const result = await activateCustomerSite(customerId);
  if (!result.ok) return result;

  revalidatePath(`/customers/${customerId}`);
  if (leadId) revalidatePath(`/leads/${leadId}`);
  revalidatePath("/today");
  return { ok: true };
}

export type SendWelcomeEmailActionState = { ok: boolean; error?: string } | null;

/**
 * "Send welcome email." Manual, one-time. Requires customers.status =
 * "active" (set by "Mark site live" above) -- see canSendWelcomeEmail in
 * src/lib/customers/welcome-email.ts for the exact gate.
 */
export async function sendWelcomeEmailAction(
  _previousState: SendWelcomeEmailActionState,
  formData: FormData,
): Promise<SendWelcomeEmailActionState> {
  await requireAdminSession();

  const customerId = String(formData.get("customerId") ?? "").trim();
  const leadId = String(formData.get("leadId") ?? "").trim();
  const siteUrl = String(formData.get("siteUrl") ?? "").trim();
  if (!customerId) return { ok: false, error: "Missing customer." };
  if (!siteUrl) return { ok: false, error: "Enter the live site URL." };

  const result = await sendWelcomeEmail(customerId, siteUrl);
  if (!result.ok) return result;

  revalidatePath(`/customers/${customerId}`);
  if (leadId) revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
