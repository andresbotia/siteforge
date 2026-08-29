import type { AgentId, AgentPermission } from "@/types";

export const agentCatalog: Record<
  AgentId,
  {
    purpose: string;
    description: string;
    capabilities: string[];
    restrictions: string[];
    permissions: Omit<AgentPermission, "agentId">;
  }
> = {
  scout: {
    purpose: "Discover strong local businesses that have poor websites.",
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
    permissions: {
      canReadPublicData: true,
      canWriteInternal: true,
      canSendEmail: false,
      canDeployProduction: false,
      canModifyCustomerSite: false,
      canProcessPayments: false,
    },
  },
  auditor: {
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
    permissions: {
      canReadPublicData: true,
      canWriteInternal: true,
      canSendEmail: false,
      canDeployProduction: false,
      canModifyCustomerSite: false,
      canProcessPayments: false,
    },
  },
  builder: {
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
    permissions: {
      canReadPublicData: true,
      canWriteInternal: true,
      canSendEmail: false,
      canDeployProduction: false,
      canModifyCustomerSite: false,
      canProcessPayments: false,
    },
  },
  sales: {
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
    permissions: {
      canReadPublicData: true,
      canWriteInternal: true,
      canSendEmail: false,
      canDeployProduction: false,
      canModifyCustomerSite: false,
      canProcessPayments: false,
    },
  },
  manager: {
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
    permissions: {
      canReadPublicData: true,
      canWriteInternal: true,
      canSendEmail: false,
      canDeployProduction: false,
      canModifyCustomerSite: false,
      canProcessPayments: false,
    },
  },
};

export function isAgentId(value: string): value is AgentId {
  return value in agentCatalog;
}
