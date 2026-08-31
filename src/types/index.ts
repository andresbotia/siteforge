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
  websiteStatus: "has_website" | "no_standalone_website" | "unknown";
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
  verifiedPublicFacts: Record<string, unknown> | null;
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
  redesignOpportunityBreakdown: {
    score: number;
    components: Array<{
      id: string;
      label: string;
      score: number;
      positiveEvidence: string[];
      negativeEvidence: string[];
      unknownEvidence: string[];
    }>;
  } | null;
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

export type GenerationSource = "deterministic_builder" | "external_generated";

export interface ExternalGeneratedSite {
  externalProvider: "lovable" | "manual" | "other";
  providerProjectId: string | null;
  providerCommitSha: string | null;
  providerPreviewUrl: string | null;
  controlledPreviewUrl: string | null;
  artifactId: string | null;
  sourceManifestFingerprint: string | null;
  deploymentStatus: "not_requested" | "pending_approval" | "deploying" | "deployed" | "failed";
  deploymentId: string | null;
  deploymentUrl: string | null;
  deploymentFailureSummary: string | null;
  lifecycleStatus:
    | "imported"
    | "validating"
    | "validation_failed"
    | "ready_for_review"
    | "deployment_approval_required"
    | "deployment_approval_pending"
    | "deploying"
    | "approved_for_preview"
    | "preview_deployed"
    | "deployment_failed"
    | "revoked";
  importedAt: string;
  importedBy: "admin";
  generationCostCredits: number | null;
  generationCostUsdEstimate: number | null;
  providerCostNotes: string | null;
  sourceArtifact: {
    sourceType: "json_manifest" | "zip_archive";
    archiveFileName: string | null;
    fileCount: number | null;
    totalBytes: number | null;
    assetCount: number | null;
    detectedFramework: "vite-react" | "vite-tanstack-start" | "static" | "unknown";
    packageManager: "npm" | "bun" | "none" | "unsupported";
  };
  verifiedFactFingerprint: string;
  staleFactWarnings: string[];
  validation: {
    ok: boolean;
    status: "passed" | "failed";
    findings: Array<{
      code: string;
      severity: "warning" | "severe";
      message: string;
      path?: string;
    }>;
    packageSummary: {
      framework: "vite-react" | "vite-tanstack-start" | "static" | "unknown";
      packageManager: "npm" | "bun" | "none" | "unsupported";
      dependencies: string[];
      devDependencies: string[];
      scripts: Record<string, string>;
      lockfiles: string[];
    };
  };
  build: {
    ok: boolean;
    status: "pending" | "passed" | "blocked" | "failed" | "unsupported";
    command: string;
    reason: string;
  };
}

export interface GeneratedWebsite {
  id: string;
  leadId: string;
  businessName: string;
  status: GeneratedWebsiteStatus;
  generationSource: GenerationSource;
  externalGeneratedSite: ExternalGeneratedSite | null;
  template: string;
  templateKey: string | null;
  beforeScore: number;
  afterScore: number | null;
  previewUrl: string;
  productionUrl: string | null;
  createdAt: string;
  spec: Record<string, unknown> | null;
  buildVersion: string | null;
  sourceAuditId: string | null;
  sourceRunId: string | null;
  auditFixes: Array<{ findingCode: string; addressed: boolean; builderAction: string }>;
  contentProvenance: Array<{ field: string; provenance: string; source: string | null }>;
}

export type PreviewDeploymentStatus = "active" | "revoked" | "expired";

export type PreviewEventType =
  | "preview_viewed"
  | "cta_clicked"
  | "phone_cta_clicked"
  | "contact_cta_clicked";

export type BotClassification = "human_likely" | "bot_likely" | "unknown";
export type DeviceClass = "desktop" | "mobile" | "tablet" | "unknown";
export type BrowserClass = "chrome" | "safari" | "firefox" | "edge" | "bot" | "unknown";

export interface PreviewDeployment {
  id: string;
  generatedWebsiteId: string;
  leadId: string;
  approvalId: string | null;
  tokenHint: string;
  status: PreviewDeploymentStatus;
  sourceRunId: string | null;
  outreachId: string | null;
  campaignId: string | null;
  buildVersion: string | null;
  expiresAt: string | null;
  approvedAt: string;
  revokedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  createdAt: string;
}

export interface PreviewAnalytics {
  deployment: PreviewDeployment | null;
  pendingApprovalId: string | null;
  totalEvents: number;
  humanLikelyViews: number;
  botLikelyViews: number;
  ctaClicks: number;
  uniqueVisitors: number;
  lastEventAt: string | null;
  recentEvents: Array<{
    id: string;
    eventType: PreviewEventType;
    botClassification: BotClassification;
    deviceClass: DeviceClass;
    browserClass: BrowserClass;
    occurredAt: string;
  }>;
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
  payloadAction: string | null;
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
  | "approved"
  | "sent"
  | "failed"
  | "replied"
  | "interested"
  | "declined"
  | "unsubscribed";

export interface Outreach {
  id: string;
  leadId: string;
  generatedWebsiteId: string | null;
  previewDeploymentId: string | null;
  salesRunId: string | null;
  approvalId: string | null;
  agentRunId: string | null;
  businessName: string;
  recipient: string;
  senderName: string | null;
  senderEmail: string | null;
  subject: string;
  body: string;
  contentHash: string | null;
  contentVersion: string | null;
  status: OutreachStatus;
  provider: string;
  providerMessageId: string | null;
  previewUrl: string | null;
  tokenHint?: string | null;
  attributionTokenHint?: string | null;
  campaignId?: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export type CommercialOfferStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "checkout_created"
  | "paid"
  | "expired"
  | "cancelled";

export interface CommercialOffer {
  id: string;
  leadId: string;
  generatedWebsiteId: string | null;
  outreachId: string | null;
  customerId: string | null;
  approvalId: string | null;
  businessName: string;
  status: CommercialOfferStatus;
  currency: "usd";
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
  description: string;
  contentHash: string;
  contentVersion: string;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StripeCheckoutStatus =
  | "created"
  | "completed"
  | "expired"
  | "cancelled"
  | "failed";

export interface StripeCheckoutSession {
  id: string;
  commercialOfferId: string;
  leadId: string;
  stripeCheckoutSessionId: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  mode: "payment" | "subscription";
  status: StripeCheckoutStatus;
  checkoutUrl: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type CustomerPlan = "website_only" | "managed";

export type CustomerStatus = "active" | "pending_setup" | "cancelled";

export type PaymentEnvironment = "mock" | "live" | "unknown";

export interface Customer {
  id: string;
  leadId: string;
  commercialOfferId?: string | null;
  stripeCustomerId?: string | null;
  businessName: string;
  website: string;
  plan: CustomerPlan;
  status: CustomerStatus;
  monthlyRevenue: number;
  grossMonthlyAmount: number;
  paymentEnvironment: PaymentEnvironment;
  joinedAt: string;
  convertedAt?: string | null;
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

export type ReadinessSeverity = "ok" | "attention" | "blocked";

export interface ReadinessIndicator {
  id: string;
  label: string;
  status: string;
  severity: ReadinessSeverity;
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

export type EmailProviderStatus = {
  provider: "resend";
  providerKeyPresent: boolean;
  liveEmailGateEnabled: boolean;
  fromConfigured: boolean;
  replyToConfigured: boolean;
  internalTestRecipientConfigured: boolean;
  webhookSecretPresent: boolean;
  readyForInternalTest: boolean;
  readyForProspectSend: boolean;
};
