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
      "Scout researches a local public catalog, inspects public websites with SSRF-safe bounded HTTP, and scores leads deterministically. It does not send email, deploy, or call xAI.",
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
      "Auditor inspects a Scout lead's public website with SSRF-safe bounded HTTP and scores findings deterministically. It does not generate a replacement site, send email, deploy, or call xAI.",
    capabilities: [
      "Inspect website content",
      "Generate structured audits",
      "Calculate quality and redesign-opportunity scores",
      "Recommend evidence-based improvements",
    ],
    restrictions: [
      "Cannot send email",
      "Cannot deploy websites",
      "Cannot charge customers",
      "Cannot generate replacement websites",
      "Cannot call xAI directly",
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
      "Builder turns an audited lead into a $0 deterministic website draft from a reusable template. It does not deploy, send email, buy domains, or call xAI.",
    capabilities: [
      "Select a trusted template",
      "Compose a structured WebsiteSpec",
      "Map Auditor findings to draft fixes",
      "Render an internal authenticated preview",
    ],
    restrictions: [
      "Cannot deploy production websites",
      "Cannot send sales email",
      "Cannot process payments",
      "Cannot buy domains or change DNS",
      "Cannot call xAI directly",
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
      "Sales drafts $0 deterministic email outreach based on audit findings, Builder redesigns, and approved M7 previews. Sending external email requires explicit human approval.",
    capabilities: [
      "Read lead information",
      "Read audits",
      "Read generated website details",
      "Read active approved previews",
      "Draft personalized outreach",
      "Request send approval",
    ],
    restrictions: [
      "External email requires human approval",
      "Cannot change pricing",
      "Cannot deploy websites",
      "Cannot charge customers",
      "Cannot call xAI directly",
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
