import type {
  AgentId,
  ApprovalType,
  ConnectionStatus,
  CustomerPlan,
  CustomerStatus,
  GeneratedWebsiteStatus,
  LeadStatus,
  OutreachStatus,
  QualificationTier,
  RiskLevel,
  CommercialOfferStatus,
} from "@/types";

export const qualificationTierLabel: Record<QualificationTier, string> = {
  reject: "Reject",
  review: "Review",
  qualified: "Qualified",
  high_priority: "High priority",
};

export const leadStatusLabel: Record<LeadStatus, string> = {
  discovered: "Discovered",
  qualified: "Qualified",
  audited: "Audited",
  website_built: "Website Built",
  approved: "Approved",
  contacted: "Contacted",
  interested: "Interested",
  customer: "Customer",
  rejected: "Rejected",
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
  approved: "Approved",
  sent: "Sent",
  failed: "Failed",
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
  paid_ai_usage: "Paid AI Usage",
  dns_change: "DNS Change",
  destructive_infrastructure_action: "Destructive Infrastructure",
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

export const commercialOfferStatusLabel: Record<CommercialOfferStatus, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  checkout_created: "Checkout Created",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};
