import { readTable } from "@/lib/supabase/server";
import type { ConnectionStatus, IntegrationStatus, SystemServiceStatus } from "@/types";
import type { IntegrationRow } from "@/types/database";

const labels: Record<
  string,
  { id: IntegrationStatus["id"]; name: string; purpose: string }
> = {
  supabase: {
    id: "supabase",
    name: "Supabase",
    purpose: "Database, authentication, application state",
  },
  xai: { id: "xai", name: "xAI", purpose: "Grok agent execution" },
  email: { id: "resend", name: "Resend", purpose: "Outbound and inbound email" },
  payments: {
    id: "stripe",
    name: "Stripe",
    purpose: "Payments and subscriptions",
  },
  deployments: {
    id: "vercel",
    name: "Vercel",
    purpose: "Preview and production deployments",
  },
};

function asConnection(value: string): ConnectionStatus {
  if (value === "connected" || value === "error") return value;
  return "not_connected";
}

export async function listIntegrations(): Promise<IntegrationStatus[]> {
  const rows = await readTable<IntegrationRow[]>((client) =>
    client.from("integration_status").select("*").order("integration"),
  );

  const order: IntegrationStatus["id"][] = [
    "supabase",
    "xai",
    "vercel",
    "resend",
    "stripe",
  ];

  const mapped =
    !rows || rows.length === 0
      ? Object.values(labels).map((meta) => ({
          id: meta.id,
          name: meta.name,
          purpose: meta.purpose,
          status: "not_connected" as const,
        }))
      : rows.map((row) => {
          const meta = labels[row.integration] ?? {
            id: "supabase" as const,
            name: row.integration,
            purpose: "",
          };
          return {
            id: meta.id,
            name: meta.name,
            purpose: meta.purpose,
            status: asConnection(row.status),
          };
        });

  return mapped.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export async function listSystemStatus(): Promise<SystemServiceStatus[]> {
  const integrations = await listIntegrations();
  const byId = new Map(integrations.map((item) => [item.id, item.status]));
  return [
    { id: "database", name: "Database", status: byId.get("supabase") ?? "not_connected" },
    { id: "xai", name: "xAI", status: byId.get("xai") ?? "not_connected" },
    { id: "email", name: "Email", status: byId.get("resend") ?? "not_connected" },
    { id: "payments", name: "Payments", status: byId.get("stripe") ?? "not_connected" },
    {
      id: "deployments",
      name: "Deployments",
      status: byId.get("vercel") ?? "not_connected",
    },
  ];
}
