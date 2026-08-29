export type LeadStatus =
  | "discovered"
  | "qualified"
  | "audited"
  | "website_built"
  | "approved"
  | "contacted"
  | "interested"
  | "customer"
  | "rejected";

export type Industry =
  | "Plumbing"
  | "HVAC"
  | "Roofing"
  | "Landscaping"
  | "Electrical"
  | "Auto Repair"
  | "Pressure Washing"
  | "Dentistry"
  | "Pest Control"
  | "Pool Services"
  | "General Contractor"
  | "Detailing"
  | "Salon"
  | "Spa"
  | "Cleaning"
  | "Professional Services"
  | "Restaurant"
  | "Cafe"
  | "Bakery"
  | "Casual Dining";

export type QualificationTier =
  | "reject"
  | "review"
  | "qualified"
  | "high_priority";

export interface Lead {
  id: string;
  businessName: string;
  industry: Industry;
  location: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  reviewCount: number;
  websiteScore: number;
  leadScore: number;
  status: LeadStatus;
  createdAt: string;
  qualificationTier: QualificationTier | null;
  businessStrengthScore: number | null;
  websiteOpportunityScore: number | null;
  overallQualificationScore: number | null;
  qualificationReasons: string[];
  discoverySource: string | null;
  lastScoutRunId: string | null;
  inspectionSummary: Record<string, unknown> | null;
}

export type AuditCategory = "technical" | "seo" | "ux" | "content";

export type AuditSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface AuditFinding {
  category: AuditCategory;
  code: string;
  title: string;
  severity: AuditSeverity;
  evidence: string;
  affectedUrl: string | null;
  recommendation: string;
  confidence: number;
}

export interface InspectedUrlSummary {
  url: string;
  kind: string;
  status: number | null;
  ok: boolean;
}

export interface WebsiteAudit {
  id: string;
  leadId: string;
  overallScore: number;
  designScore: number;
  mobileScore: number;
  seoScore: number;
  performanceScore: number;
  conversionScore: number | null;
  technicalScore: number | null;
  uxScore: number | null;
  contentScore: number | null;
  redesignOpportunityScore: number | null;
  issues: string[];
  recommendations: string[];
  summary: string | null;
  findings: AuditFinding[];
  inspectedUrls: InspectedUrlSummary[];
  auditVersion: string | null;
  sourceRunId: string | null;
  pagesInspected: number;
  websiteUrl: string | null;
  createdAt: string;
}

export type GeneratedWebsiteStatus =
  | "building"
  | "review_required"
  | "approved"
  | "live"
  | "failed";

export interface GeneratedWebsite {
  id: string;
  leadId: string;
  businessName: string;
  status: GeneratedWebsiteStatus;
  template: string;
  beforeScore: number;
  afterScore: number | null;
  previewUrl: string;
  productionUrl: string | null;
  createdAt: string;
}

export type AgentId = "scout" | "auditor" | "builder" | "sales" | "manager";

export type AgentRuntimeStatus = "disabled" | "inactive" | "not_configured";

export interface Agent {
  id: AgentId;
  name: string;
  status: AgentRuntimeStatus;
  purpose: string;
  description: string;
  capabilities: string[];
  restrictions: string[];
  runsToday: number;
  successRate: number | null;
  costToday: number;
  lastRun: string | null;
}

export type AgentRunStatus =
  | "queued"
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "succeeded"
  | "completed"
  | "failed"
  | "rejected"
  | "budget_blocked"
  | "cancelled";

export interface AgentRun {
  id: string;
  agentId: AgentId;
  leadId?: string;
  status: AgentRunStatus;
  startedAt: string;
  completedAt: string | null;
  cost: number;
  summary: string;
}

export type ApprovalType =
  | "website_deployment"
  | "external_email"
  | "website_modification"
  | "payment_action"
  | "paid_ai_usage"
  | "dns_change"
  | "destructive_infrastructure_action";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "executed"
  | "failed";

export type RiskLevel = "low" | "medium" | "high";

export interface Approval {
  id: string;
  leadId?: string;
  customerId?: string;
  agentRunId?: string;
  businessName: string;
  agentId: AgentId;
  type: ApprovalType;
  requestedAction: string;
  reason: string;
  status: ApprovalStatus;
  riskLevel: RiskLevel;
  model?: string | null;
  purpose?: string | null;
  estimatedCostUsd: number | null;
  requestedMaxUsd: number | null;
  approvedCostLimitUsd: number | null;
  actualCostUsd: number | null;
  createdAt: string;
  approvedAt?: string;
}

export type OutreachStatus =
  | "draft"
  | "awaiting_approval"
  | "sent"
  | "replied"
  | "interested"
  | "declined"
  | "unsubscribed";

export interface Outreach {
  id: string;
  leadId: string;
  businessName: string;
  recipient: string;
  subject: string;
  body: string;
  status: OutreachStatus;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
}

export type CustomerPlan = "website_only" | "managed";

export type CustomerStatus = "active" | "pending_setup" | "cancelled";

export interface Customer {
  id: string;
  leadId: string;
  businessName: string;
  website: string;
  plan: CustomerPlan;
  status: CustomerStatus;
  monthlyRevenue: number;
  joinedAt: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  plan: CustomerPlan;
  amount: number;
  status: "active" | "pending" | "cancelled";
}

export interface AgentPermission {
  agentId: AgentId;
  canReadPublicData: boolean;
  canWriteInternal: boolean;
  canSendEmail: boolean;
  canDeployProduction: boolean;
  canModifyCustomerSite: boolean;
  canProcessPayments: boolean;
}

export type IntegrationId =
  | "supabase"
  | "xai"
  | "vercel"
  | "resend"
  | "stripe";

export type ConnectionStatus = "not_connected" | "connected" | "error";

export interface IntegrationStatus {
  id: IntegrationId;
  name: string;
  purpose: string;
  status: ConnectionStatus;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  timestamp: string;
  title: string;
  detail: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  count: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface AnalyticsSnapshot {
  leadConversion: number;
  websiteConversion: number;
  outreachResponseRate: number;
  salesConversion: number;
  mrr: number;
  agentCost: number;
  costPerLead: number;
  costPerWebsite: number;
  costPerSale: number;
  funnel: FunnelStage[];
}

export interface DashboardMetrics {
  qualifiedLeads: number;
  websitesGenerated: number;
  awaitingApproval: number;
  outreachSent: number;
  customers: number;
  mrr: number;
}

export interface AgentSpendBreakdown {
  agentId: AgentId;
  amount: number;
}

export interface AgentSpend {
  today: number;
  thisMonth: number;
  breakdown: AgentSpendBreakdown[];
}

export interface SystemServiceStatus {
  id: string;
  name: string;
  status: ConnectionStatus;
}

export interface AiCostControlsView {
  provider: "xAI";
  defaultModel: string;
  apiKeyConfigured: boolean;
  liveInferenceEnabled: boolean;
  paidApprovalsRequired: true;
  automaticPaidSpending: false;
  dailyLimitUsd: string;
  monthlyLimitUsd: string;
  dailyActualUsd: string;
  monthlyActualUsd: string;
  reservedUsd: string;
  dailyUsedUsd: string;
  monthlyUsedUsd: string;
  perRunCeilings: { agentId: AgentId; label: string; amountUsd: string }[];
}
