import "server-only";

import { getAuthConfig } from "@/lib/auth/config";
import { getEmailConnectionStatus, getEmailProviderStatus } from "@/lib/email/config";
import { getStripeConfigStatus } from "@/lib/payments/config";
import { getSupabaseServerConfigIssue } from "@/lib/supabase/config";
import { readTable } from "@/lib/supabase/server";
import type {
  ConnectionStatus,
  IntegrationStatus,
  ReadinessIndicator,
  SystemServiceStatus,
} from "@/types";
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

  const emailConnectionStatus = getEmailConnectionStatus();
  return mapped
    .map((item) =>
      item.id === "resend" ? { ...item, status: emailConnectionStatus } : item,
    )
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
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

export function getReadinessIndicators(): ReadinessIndicator[] {
  const supabaseIssue = getSupabaseServerConfigIssue();
  const supabaseConfigured = !supabaseIssue;
  const publishableSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
  const authConfigured = Boolean(getAuthConfig());
  const liveAiEnabled = process.env.XAI_ALLOW_LIVE_INFERENCE === "true";
  const stripeStatus = getStripeConfigStatus();
  const emailStatus = getEmailProviderStatus();

  return [
    {
      id: "supabase",
      label: "Supabase server access",
      status: supabaseConfigured
        ? "Configured"
        : supabaseIssue.message,
      severity: supabaseConfigured ? "ok" : "blocked",
    },
    {
      id: "supabase-browser",
      label: "Supabase browser key",
      status: publishableSupabaseConfigured ? "Configured for future auth" : "Optional",
      severity: "ok",
    },
    {
      id: "admin-auth",
      label: "Temporary admin auth",
      status: authConfigured ? "Configured" : "Missing or invalid",
      severity: authConfigured ? "ok" : "blocked",
    },
    {
      id: "paid-ai",
      label: "Paid AI live gate",
      status: liveAiEnabled ? "Enabled" : "Disabled",
      severity: liveAiEnabled ? "attention" : "ok",
    },
    {
      id: "stripe",
      label: "Stripe mode",
      status:
        stripeStatus.mode === "mock"
          ? "MOCK (no real Stripe calls)"
          : stripeStatus.mode === "test"
            ? stripeStatus.ready
              ? "TEST -- ready"
              : "TEST -- incomplete configuration (webhook secret / price IDs missing)"
            : stripeStatus.ready
              ? "LIVE -- ready (real charges will occur)"
              : "LIVE -- incomplete configuration (webhook secret / price IDs missing)",
      severity: stripeStatus.mode === "mock" ? "ok" : stripeStatus.mode === "live" ? "attention" : "attention",
    },
    {
      id: "email",
      label: "Real email provider",
      status: emailStatus.providerKeyPresent
        ? emailStatus.liveEmailGateEnabled
          ? "Key present; live gate enabled"
          : "Key present; live gate disabled"
        : "Key missing; live gate disabled",
      severity: emailStatus.liveEmailGateEnabled ? "attention" : "ok",
    },
    {
      id: "credential-rotation",
      label: "Credential rotation",
      status: "Deferred for public-data-only validation; required before sensitive data",
      severity: "attention",
    },
    {
      id: "real-prospects",
      label: "Real prospect acquisition",
      status: "Not started",
      severity: "ok",
    },
  ];
}
