import type { Metadata } from "next";
import { LeadsView } from "@/components/leads/leads-view";
import { mockLeads } from "@/data";

export const metadata: Metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  return <LeadsView leads={mockLeads} />;
}
