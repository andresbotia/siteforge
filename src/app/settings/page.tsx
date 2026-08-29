import type { Metadata } from "next";
import { listIntegrations } from "@/data/integrations";
import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const integrations = await listIntegrations();
  return <SettingsView integrations={integrations} />;
}
