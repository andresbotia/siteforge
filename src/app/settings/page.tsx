import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getBudgetSnapshot, toCostControlsView } from "@/data/budget";
import { getReadinessIndicators, listIntegrations } from "@/data/integrations";
import { getEmailProviderStatus } from "@/lib/email/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const [integrations, budget] = await Promise.all([
    listIntegrations(),
    getBudgetSnapshot(),
  ]);
  return (
    <SettingsView
      integrations={integrations}
      costControls={toCostControlsView(budget)}
      readiness={getReadinessIndicators()}
      emailStatus={getEmailProviderStatus()}
    />
  );
}
