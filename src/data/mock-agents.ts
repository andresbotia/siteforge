import type {
  Agent,
  AgentPermission,
  AgentRun,
  AgentSpend,
  IntegrationStatus,
  SystemServiceStatus,
} from "@/types";

export const mockAgents: Agent[] = [
  {
    id: "scout",
    name: "Scout",
    status: "not_configured",
    purpose:
      "Discover strong local businesses that have poor websites.",
    description:
      "Scout will eventually research public business listings, inspect public websites, and create enriched leads. It is not implemented in this milestone.",
    capabilities: [
      "Public business research",
      "Public website inspection",
      "Lead creation",
      "Lead enrichment",
    ],
    restrictions: [
      "Cannot send external email",
      "Cannot deploy websites",
      "Cannot process payments",
      "Cannot modify customer sites",
    ],
    runsToday: 0,
    successRate: null,
    costToday: 0,
    lastRun: null,
  },
  {
    id: "auditor",
    name: "Auditor",
    status: "not_configured",
    purpose:
      "Analyze websites, SEO, mobile usability, and conversion quality.",
    description:
      "Auditor will eventually inspect public website content, generate audits, and recommend improvements. It is not implemented in this milestone.",
    capabilities: [
      "Inspect website content",
      "Generate audits",
      "Calculate quality scores",
      "Recommend improvements",
    ],
    restrictions: [
      "Cannot send email",
      "Cannot deploy websites",
      "Cannot charge customers",
    ],
    runsToday: 0,
    successRate: null,
    costToday: 0,
    lastRun: null,
  },
  {
    id: "builder",
    name: "Builder",
    status: "not_configured",
    purpose: "Generate improved websites from approved qualified leads.",
    description:
      "Builder will eventually generate website code, modify templates, run builds, and create preview deployments. Production publish will require approval. It is not implemented in this milestone.",
    capabilities: [
      "Generate website code",
      "Modify templates",
      "Run builds",
      "Generate preview deployments in future",
    ],
    restrictions: [
      "Production deployment requires approval",
      "Cannot send sales email",
      "Cannot process payments",
    ],
    runsToday: 0,
    successRate: null,
    costToday: 0,
    lastRun: null,
  },
  {
    id: "sales",
    name: "Sales",
    status: "not_configured",
    purpose: "Prepare personalized outreach for approved prospects.",
    description:
      "Sales will eventually read lead, audit, and website records and draft personalized outreach. Sending external email will require approval. It is not implemented in this milestone.",
    capabilities: [
      "Read lead information",
      "Read audits",
      "Read generated website details",
      "Draft personalized outreach",
    ],
    restrictions: [
      "External email requires approval",
      "Cannot change pricing",
      "Cannot deploy websites",
      "Cannot charge customers",
    ],
    runsToday: 0,
    successRate: null,
    costToday: 0,
    lastRun: null,
  },
  {
    id: "manager",
    name: "Manager",
    status: "not_configured",
    purpose: "Handle requested updates for paying managed customers.",
    description:
      "Manager will eventually inspect customer sites and prepare content or layout changes. Customer-facing modifications will require approval initially. It is not implemented in this milestone.",
    capabilities: [
      "Inspect customer site",
      "Prepare modifications",
      "Generate content changes",
    ],
    restrictions: [
      "Customer-facing modifications require approval initially",
      "Cannot issue refunds without approval",
      "Cannot change billing terms",
    ],
    runsToday: 0,
    successRate: null,
    costToday: 0,
    lastRun: null,
  },
];

export const mockAgentPermissions: AgentPermission[] = [
  {
    agentId: "scout",
    canReadPublicData: true,
    canWriteInternal: true,
    canSendEmail: false,
    canDeployProduction: false,
    canModifyCustomerSite: false,
    canProcessPayments: false,
  },
  {
    agentId: "auditor",
    canReadPublicData: true,
    canWriteInternal: true,
    canSendEmail: false,
    canDeployProduction: false,
    canModifyCustomerSite: false,
    canProcessPayments: false,
  },
  {
    agentId: "builder",
    canReadPublicData: true,
    canWriteInternal: true,
    canSendEmail: false,
    canDeployProduction: false,
    canModifyCustomerSite: false,
    canProcessPayments: false,
  },
  {
    agentId: "sales",
    canReadPublicData: true,
    canWriteInternal: true,
    canSendEmail: false,
    canDeployProduction: false,
    canModifyCustomerSite: false,
    canProcessPayments: false,
  },
  {
    agentId: "manager",
    canReadPublicData: true,
    canWriteInternal: true,
    canSendEmail: false,
    canDeployProduction: false,
    canModifyCustomerSite: false,
    canProcessPayments: false,
  },
];

/**
 * Sample historical runs for dashboard activity only.
 * Agents are not configured and are not running in Milestone 1.
 */
export const mockAgentRuns: AgentRun[] = [
  {
    id: "run_scout_currentpath",
    agentId: "scout",
    leadId: "lead_currentpath",
    status: "completed",
    startedAt: "2026-08-26T17:50:00.000Z",
    completedAt: "2026-08-26T18:02:00.000Z",
    cost: 0.42,
    summary: "Scout discovered CurrentPath Electrical in Coral Springs.",
  },
  {
    id: "run_scout_sawgrass",
    agentId: "scout",
    leadId: "lead_sawgrass",
    status: "completed",
    startedAt: "2026-08-27T08:20:00.000Z",
    completedAt: "2026-08-27T08:36:00.000Z",
    cost: 0.38,
    summary: "Scout discovered Sawgrass Shield Roofing in Coral Springs.",
  },
  {
    id: "run_auditor_cypress",
    agentId: "auditor",
    leadId: "lead_cypress",
    status: "completed",
    startedAt: "2026-08-21T09:20:00.000Z",
    completedAt: "2026-08-21T09:41:00.000Z",
    cost: 0.61,
    summary: "Auditor completed a website audit for Cypress Grove Landscaping.",
  },
  {
    id: "run_auditor_lakeside",
    agentId: "auditor",
    leadId: "lead_lakeside",
    status: "completed",
    startedAt: "2026-08-22T19:10:00.000Z",
    completedAt: "2026-08-22T19:33:00.000Z",
    cost: 0.57,
    summary: "Auditor completed a website audit for Lakeside Spark Electric.",
  },
  {
    id: "run_builder_ridgeway",
    agentId: "builder",
    leadId: "lead_ridgeway",
    status: "running",
    startedAt: "2026-08-28T09:05:00.000Z",
    completedAt: null,
    cost: 0,
    summary: "Builder generated a website draft for Ridgeway Roofing.",
  },
  {
    id: "run_builder_seaglass",
    agentId: "builder",
    leadId: "lead_seaglass",
    status: "failed",
    startedAt: "2026-08-24T13:47:00.000Z",
    completedAt: "2026-08-24T14:02:00.000Z",
    cost: 0.88,
    summary: "Builder failed while generating Seaglass Plumbing Co.",
  },
  {
    id: "run_sales_harborline",
    agentId: "sales",
    leadId: "lead_harborline",
    status: "completed",
    startedAt: "2026-08-17T10:14:00.000Z",
    completedAt: "2026-08-17T10:22:00.000Z",
    cost: 0.29,
    summary: "Sales prepared outreach for Harborline Plumbing.",
  },
  {
    id: "run_manager_greenline",
    agentId: "manager",
    leadId: "lead_greenline",
    status: "completed",
    startedAt: "2026-08-25T15:02:00.000Z",
    completedAt: "2026-08-25T15:18:00.000Z",
    cost: 0.33,
    summary: "Manager prepared a seasonal update for Greenline Gardens.",
  },
];

export const mockAgentSpend: AgentSpend = {
  today: 0,
  thisMonth: 0,
  breakdown: [
    { agentId: "scout", amount: 0 },
    { agentId: "auditor", amount: 0 },
    { agentId: "builder", amount: 0 },
    { agentId: "sales", amount: 0 },
    { agentId: "manager", amount: 0 },
  ],
};

export const mockIntegrations: IntegrationStatus[] = [
  {
    id: "supabase",
    name: "Supabase",
    purpose: "Database, authentication, application state",
    status: "not_connected",
  },
  {
    id: "xai",
    name: "xAI",
    purpose: "Grok agent execution",
    status: "not_connected",
  },
  {
    id: "vercel",
    name: "Vercel",
    purpose: "Preview and production deployments",
    status: "not_connected",
  },
  {
    id: "resend",
    name: "Resend",
    purpose: "Outbound and inbound email",
    status: "not_connected",
  },
  {
    id: "stripe",
    name: "Stripe",
    purpose: "Payments and subscriptions",
    status: "not_connected",
  },
];

export const mockSystemStatus: SystemServiceStatus[] = [
  { id: "database", name: "Database", status: "not_connected" },
  { id: "xai", name: "xAI", status: "not_connected" },
  { id: "email", name: "Email", status: "not_connected" },
  { id: "payments", name: "Payments", status: "not_connected" },
  { id: "deployments", name: "Deployments", status: "not_connected" },
];
