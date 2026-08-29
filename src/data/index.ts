import { mockApprovals } from "@/data/mock-approvals";
import { mockCustomers } from "@/data/mock-customers";
import { mockLeads } from "@/data/mock-leads";
import { mockOutreach } from "@/data/mock-outreach";
import { mockWebsites } from "@/data/mock-websites";
import type { DashboardMetrics } from "@/types";

export { mockLeads, getLeadById } from "@/data/mock-leads";
export { mockAudits, getAuditByLeadId } from "@/data/mock-audits";
export { mockWebsites, getWebsiteByLeadId } from "@/data/mock-websites";
export {
  mockAgents,
  mockAgentPermissions,
  mockAgentRuns,
  mockAgentSpend,
  mockIntegrations,
  mockSystemStatus,
} from "@/data/mock-agents";
export { mockApprovals } from "@/data/mock-approvals";
export { mockOutreach } from "@/data/mock-outreach";
export { mockCustomers, mockSubscriptions } from "@/data/mock-customers";
export { mockLeadActivity, getActivityForLead } from "@/data/mock-activity";
export {
  mockAnalytics,
  mockPipeline,
  mockSettings,
} from "@/data/mock-analytics";

const qualifiedStatuses = new Set(["qualified", "building", "ready"]);
const sentOutreachStatuses = new Set([
  "sent",
  "replied",
  "interested",
  "declined",
  "unsubscribed",
]);

export function getDashboardMetrics(): DashboardMetrics {
  return {
    qualifiedLeads: mockLeads.filter((lead) =>
      qualifiedStatuses.has(lead.status),
    ).length,
    websitesGenerated: mockWebsites.length,
    awaitingApproval: mockApprovals.filter(
      (approval) => approval.status === "pending",
    ).length,
    outreachSent: mockOutreach.filter((item) =>
      sentOutreachStatuses.has(item.status),
    ).length,
    customers: mockCustomers.length,
    mrr: mockCustomers
      .filter((customer) => customer.status === "active")
      .reduce((sum, customer) => sum + customer.monthlyRevenue, 0),
  };
}

export const industries = [
  "Plumbing",
  "HVAC",
  "Roofing",
  "Landscaping",
  "Electrical",
  "Auto Repair",
  "Pressure Washing",
  "Dentistry",
] as const;

export const cities = [
  "Fort Lauderdale",
  "Coconut Creek",
  "Pompano Beach",
  "Boca Raton",
  "Coral Springs",
  "Deerfield Beach",
] as const;
