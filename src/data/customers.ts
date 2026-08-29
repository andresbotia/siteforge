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
      businessName: row.business_name,
      website: row.production_url ?? "",
      plan: (row.plan as CustomerPlan) ?? "website_only",
      status: (row.status as CustomerStatus) ?? "pending_setup",
      monthlyRevenue: monthly,
      joinedAt: row.created_at,
    };
  });
}
