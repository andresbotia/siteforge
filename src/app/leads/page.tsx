import type { Metadata } from "next";
import { LeadsView } from "@/components/leads/leads-view";
import { listLeads } from "@/data/leads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default async function LeadsPage() {
  const leads = await listLeads();
  return <LeadsView leads={leads} />;
}
