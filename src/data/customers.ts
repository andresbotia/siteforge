import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { syncWorkItemsForLead } from "@/data/work-items";
import { mutateTable, readTable } from "@/lib/supabase/server";
import { buildCustomerActivationPatch, canActivateCustomerSite } from "@/lib/customers/activation";
import {
  buildWelcomeEmailSentPatch,
  canSendWelcomeEmail,
  composeWelcomeCustomerEmail,
} from "@/lib/customers/welcome-email";
import { DEFAULT_SENDER_EMAIL, getEmailProvider } from "@/lib/email/provider";
import { getEmailConfig } from "@/lib/email/config";
import { inferPaymentEnvironment } from "@/lib/payments/conversion";
import type { Customer, CustomerPlan, CustomerStatus } from "@/types";
import type {
  CommercialOfferRow,
  CustomerRow,
  Json,
  StripeCheckoutSessionRow,
  SubscriptionRow,
} from "@/types/database";

type CustomerSubscriptionSummary = Pick<
  SubscriptionRow,
  "customer_id" | "amount_usd" | "interval" | "status" | "provider_subscription_id"
>;

function readSessionProvider(metadata: Json | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const provider = (metadata as Record<string, Json>).provider;
  return typeof provider === "string" ? provider : null;
}

export async function listCustomers(): Promise<Customer[]> {
  const [customers, subscriptions, sessions, offers] = await Promise.all([
    readTable<CustomerRow[]>((client) =>
      client
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
    readTable<CustomerSubscriptionSummary[]>(
      (client) =>
        client
          .from("subscriptions")
          .select("customer_id, amount_usd, interval, status, provider_subscription_id"),
    ),
    readTable<Pick<
      StripeCheckoutSessionRow,
      | "lead_id"
      | "stripe_checkout_session_id"
      | "stripe_customer_id"
      | "stripe_payment_intent_id"
      | "stripe_subscription_id"
      | "metadata"
    >[]>((client) =>
      client
        .from("stripe_checkout_sessions")
        .select(
          "lead_id, stripe_checkout_session_id, stripe_customer_id, stripe_payment_intent_id, stripe_subscription_id, metadata",
        )
        .order("created_at", { ascending: false }),
    ),
    readTable<Pick<CommercialOfferRow, "id" | "setup_amount_cents">[]>((client) =>
      client.from("commercial_offers").select("id, setup_amount_cents"),
    ),
  ]);

  const offerById = new Map((offers ?? []).map((offer) => [offer.id, offer]));

  return (customers ?? []).map((row) => {
    const sub = (subscriptions ?? []).find(
      (item) => item.customer_id === row.id && item.status !== "cancelled",
    );
    const session = (sessions ?? []).find((item) => item.lead_id === row.lead_id);
    const paymentEnvironment = inferPaymentEnvironment({
      stripeCustomerId: row.stripe_customer_id ?? session?.stripe_customer_id,
      stripeCheckoutSessionId: session?.stripe_checkout_session_id,
      stripePaymentIntentId: session?.stripe_payment_intent_id,
      stripeSubscriptionId: session?.stripe_subscription_id,
      subscriptionProviderId: sub?.provider_subscription_id,
      sessionProvider: readSessionProvider(session?.metadata ?? null),
    });
    const grossMonthlyAmount = sub && sub.interval === "month" ? Number(sub.amount_usd) : 0;
    const monthlyRevenue = paymentEnvironment === "live" ? grossMonthlyAmount : 0;
    const offer = row.commercial_offer_id ? offerById.get(row.commercial_offer_id) : null;
    return {
      id: row.id,
      leadId: row.lead_id ?? "",
      commercialOfferId: row.commercial_offer_id,
      stripeCustomerId: row.stripe_customer_id,
      businessName: row.business_name,
      website: row.production_url ?? "",
      plan: (row.plan as CustomerPlan) ?? "website_only",
      status: (row.status as CustomerStatus) ?? "pending_setup",
      setupAmountCents: offer?.setup_amount_cents ?? null,
      managedSubscriptionStatus: sub?.status ?? null,
      monthlyRevenue,
      grossMonthlyAmount,
      paymentEnvironment,
      joinedAt: row.created_at,
      convertedAt: row.converted_at,
      activatedAt: row.activated_at,
      welcomeEmailSentAt: row.welcome_email_sent_at,
    };
  });
}

export type CustomerDetail = Customer & {
  subscriptions: SubscriptionRow[];
};

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  const row = await readTable<CustomerRow | null>((client) =>
    client.from("customers").select("*").eq("id", id).maybeSingle(),
  );
  if (!row) return null;
  const [subscriptions, session, offer] = await Promise.all([
    readTable<SubscriptionRow[]>((client) =>
      client
        .from("subscriptions")
        .select("*")
        .eq("customer_id", row.id)
        .order("created_at", { ascending: false }),
    ),
    readTable<Pick<
      StripeCheckoutSessionRow,
      | "stripe_checkout_session_id"
      | "stripe_customer_id"
      | "stripe_payment_intent_id"
      | "stripe_subscription_id"
      | "metadata"
    > | null>((client) =>
      client
        .from("stripe_checkout_sessions")
        .select(
          "stripe_checkout_session_id, stripe_customer_id, stripe_payment_intent_id, stripe_subscription_id, metadata",
        )
        .eq("lead_id", row.lead_id ?? "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
    row.commercial_offer_id
      ? readTable<Pick<CommercialOfferRow, "setup_amount_cents"> | null>((client) =>
          client
            .from("commercial_offers")
            .select("setup_amount_cents")
            .eq("id", row.commercial_offer_id!)
            .maybeSingle(),
        )
      : Promise.resolve(null),
  ]);
  const active = (subscriptions ?? []).find((item) => item.status !== "cancelled");
  const paymentEnvironment = inferPaymentEnvironment({
    stripeCustomerId: row.stripe_customer_id ?? session?.stripe_customer_id,
    stripeCheckoutSessionId: session?.stripe_checkout_session_id,
    stripePaymentIntentId: session?.stripe_payment_intent_id,
    stripeSubscriptionId: session?.stripe_subscription_id,
    subscriptionProviderId: active?.provider_subscription_id,
    sessionProvider: readSessionProvider(session?.metadata ?? null),
  });
  const grossMonthlyAmount =
    active?.interval === "month" ? Number(active.amount_usd) : 0;
  return {
    id: row.id,
    leadId: row.lead_id ?? "",
    commercialOfferId: row.commercial_offer_id,
    stripeCustomerId: row.stripe_customer_id,
    businessName: row.business_name,
    website: row.production_url ?? "",
    plan: (row.plan as CustomerPlan) ?? "website_only",
    status: (row.status as CustomerStatus) ?? "pending_setup",
    setupAmountCents: offer?.setup_amount_cents ?? null,
    managedSubscriptionStatus: active?.status ?? null,
    monthlyRevenue: paymentEnvironment === "live" ? grossMonthlyAmount : 0,
    grossMonthlyAmount,
    paymentEnvironment,
    joinedAt: row.created_at,
    convertedAt: row.converted_at,
    activatedAt: row.activated_at,
    welcomeEmailSentAt: row.welcome_email_sent_at,
    subscriptions: subscriptions ?? [],
  };
}

/**
 * M10 fulfillment follow-up. The only way to move a customer from
 * pending_setup to active: a manual operator confirmation ("Mark site
 * live"), never auto-triggered. Domain registration, DNS, and deployment
 * all happen outside this codebase (see FULFILLMENT-RUNBOOK.md) -- this
 * function does not check any of that, it only records that the operator
 * asserts it is done, and lets the existing work-item reconcile pass drop
 * "Fulfil the paid site" now that the condition it watches is gone.
 */
export async function activateCustomerSite(
  customerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await readTable<Pick<
    CustomerRow,
    "id" | "status" | "lead_id" | "business_name"
  > | null>((client) =>
    client
      .from("customers")
      .select("id, status, lead_id, business_name")
      .eq("id", customerId)
      .maybeSingle(),
  );
  if (!row) return { ok: false, error: "Customer was not found." };

  const check = canActivateCustomerSite(row.status);
  if (!check.ok) return check;

  const patch = buildCustomerActivationPatch();
  // The status filter on the update (not just the read above) closes the
  // race where two requests both pass the read-time check.
  const updated = await mutateTable<Pick<CustomerRow, "id"> | null>((client) =>
    client
      .from("customers")
      .update(patch)
      .eq("id", row.id)
      .eq("status", "pending_setup")
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Could not mark the site live." };

  await recordActivityEvent({
    eventType: "customer_site_activated",
    title: "Customer site marked live",
    description: `${row.business_name}: pending_setup -> active`,
    leadId: row.lead_id ?? undefined,
    metadata: { customer_id: row.id },
  });

  if (row.lead_id) {
    await syncWorkItemsForLead(row.lead_id).catch(() => {});
  }

  return { ok: true };
}

/**
 * M10 fulfillment follow-up. The manual, one-time "welcome, your site is
 * live" send -- see the design note at the top of
 * src/lib/customers/welcome-email.ts for why this is a customers-table
 * timestamp guard rather than an approval-bound outreach-table row. Unlike
 * the best-effort founder payment notification (src/data/payments.ts),
 * this IS the primary action the operator explicitly triggered, so a send
 * failure is returned as an explicit error rather than swallowed -- the
 * operator needs to know it didn't go out so they can retry.
 */
export async function sendWelcomeEmail(
  customerId: string,
  siteUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedUrl = siteUrl.trim();
  if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
    return { ok: false, error: "A live site URL (starting with http:// or https://) is required." };
  }

  const row = await readTable<Pick<
    CustomerRow,
    "id" | "status" | "lead_id" | "business_name" | "contact_email" | "welcome_email_sent_at"
  > | null>((client) =>
    client
      .from("customers")
      .select("id, status, lead_id, business_name, contact_email, welcome_email_sent_at")
      .eq("id", customerId)
      .maybeSingle(),
  );
  if (!row) return { ok: false, error: "Customer was not found." };

  const check = canSendWelcomeEmail(row.status, Boolean(row.welcome_email_sent_at));
  if (!check.ok) return check;

  const recipient = (row.contact_email ?? "").trim();
  if (!recipient) return { ok: false, error: "Customer has no contact email on file." };

  const { subject, body } = composeWelcomeCustomerEmail({
    businessName: row.business_name,
    siteUrl: trimmedUrl,
  });

  const emailConfig = getEmailConfig();
  const sendResult = await getEmailProvider().sendEmail({
    to: recipient,
    from: emailConfig.from ?? DEFAULT_SENDER_EMAIL,
    subject,
    text: body,
    metadata: { notification: "customer_welcome_email", customer_id: row.id },
  });
  if (!sendResult.ok) {
    return { ok: false, error: sendResult.error ?? "The welcome email failed to send." };
  }

  const patch = buildWelcomeEmailSentPatch(trimmedUrl);
  // Same race-safety idiom as activateCustomerSite: the update itself
  // re-checks both guard conditions, not just the read above.
  const updated = await mutateTable<Pick<CustomerRow, "id"> | null>((client) =>
    client
      .from("customers")
      .update(patch)
      .eq("id", row.id)
      .eq("status", "active")
      .is("welcome_email_sent_at", null)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) {
    return {
      ok: false,
      error: "The email sent, but the customer record could not be updated. Check the activity log before retrying.",
    };
  }

  await recordActivityEvent({
    eventType: "customer_welcome_email_sent",
    title: "Welcome email sent",
    description: `${row.business_name}: welcome email sent to ${recipient}.`,
    leadId: row.lead_id ?? undefined,
    metadata: {
      customer_id: row.id,
      provider: sendResult.provider,
      message_id: sendResult.messageId ?? "",
      simulated: sendResult.simulated ?? false,
    },
  });

  return { ok: true };
}
