import "server-only";

import { readTable } from "@/lib/supabase/server";
import type { Customer, CustomerPlan, CustomerStatus } from "@/types";
import type { CustomerRow, SubscriptionRow } from "@/types/database";

export async function listCustomers(): Promise<Customer[]> {
  const [customers, subscriptions] = await Promise.all([
    readTable<CustomerRow[]>((client) =>
      client
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false }),
    ),
    readTable<Pick<SubscriptionRow, "customer_id" | "amount_usd" | "interval" | "status">[]>(
      (client) =>
        client
          .from("subscriptions")
          .select("customer_id, amount_usd, interval, status"),
    ),
  ]);

  return (customers ?? []).map((row) => {
    const sub = (subscriptions ?? []).find(
      (item) => item.customer_id === row.id && item.status !== "cancelled",
    );
    const monthly =
      sub && sub.interval === "month" ? Number(sub.amount_usd) : 0;
    return {
      id: row.id,
      leadId: row.lead_id ?? "",
      commercialOfferId: row.commercial_offer_id,
      stripeCustomerId: row.stripe_customer_id,
      businessName: row.business_name,
      website: row.production_url ?? "",
      plan: (row.plan as CustomerPlan) ?? "website_only",
      status: (row.status as CustomerStatus) ?? "pending_setup",
      monthlyRevenue: monthly,
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
  const subscriptions = await readTable<SubscriptionRow[]>((client) =>
    client
      .from("subscriptions")
      .select("*")
      .eq("customer_id", row.id)
      .order("created_at", { ascending: false }),
  );
  const active = (subscriptions ?? []).find((item) => item.status !== "cancelled");
  return {
    id: row.id,
    leadId: row.lead_id ?? "",
    commercialOfferId: row.commercial_offer_id,
    stripeCustomerId: row.stripe_customer_id,
    businessName: row.business_name,
    website: row.production_url ?? "",
    plan: (row.plan as CustomerPlan) ?? "website_only",
    status: (row.status as CustomerStatus) ?? "pending_setup",
    monthlyRevenue: active?.interval === "month" ? Number(active.amount_usd) : 0,
    joinedAt: row.created_at,
    convertedAt: row.converted_at,
    subscriptions: subscriptions ?? [],
  };
}
