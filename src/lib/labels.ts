import type {
  AgentId,
  ApprovalType,
  ConnectionStatus,
  CustomerPlan,
  CustomerStatus,
  GeneratedWebsiteStatus,
  LeadStatus,
  OutreachStatus,
  RiskLevel,
} from "@/types";

export const leadStatusLabel: Record<LeadStatus, string> = {
  discovered: "Discovered",
  auditing: "Auditing",
  qualified: "Qualified",
  rejected: "Rejected",
  building: "Building",
  ready: "Ready",
};

export const websiteStatusLabel: Record<GeneratedWebsiteStatus, string> = {
  building: "Building",
  review_required: "Review Required",
  approved: "Approved",
  live: "Live",
  failed: "Failed",
};

export const outreachStatusLabel: Record<OutreachStatus, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting Approval",
  sent: "Sent",
  replied: "Replied",
  interested: "Interested",
  declined: "Declined",
  unsubscribed: "Unsubscribed",
};

export const customerPlanLabel: Record<CustomerPlan, string> = {
  website_only: "Website Only",
  managed: "Managed",
};

export const customerStatusLabel: Record<CustomerStatus, string> = {
  active: "Active",
  pending_setup: "Pending Setup",
  cancelled: "Cancelled",
};

export const approvalTypeLabel: Record<ApprovalType, string> = {
  website_deployment: "Website Deployment",
  external_email: "External Email",
  website_modification: "Website Modification",
  payment_action: "Payment Action",
};

export const riskLabel: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const agentName: Record<AgentId, string> = {
  scout: "Scout",
  auditor: "Auditor",
  builder: "Builder",
  sales: "Sales",
  manager: "Manager",
};

export const connectionStatusLabel: Record<ConnectionStatus, string> = {
  not_connected: "Not Connected",
  connected: "Connected",
  error: "Error",
};

export const customerPlanPrice: Record<CustomerPlan, string> = {
  website_only: "$99 one time",
  managed: "$39/month",
};
