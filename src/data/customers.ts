import "server-only";

import { readTable } from "@/lib/supabase/server";
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
    subscriptions: subscriptions ?? [],
  };
}
