import type { AnalyticsSnapshot, PipelineStage } from "@/types";
import { mockCustomers } from "@/data/mock-customers";
import { mockLeads } from "@/data/mock-leads";
import { mockOutreach } from "@/data/mock-outreach";
import { mockWebsites } from "@/data/mock-websites";

const qualifiedStatuses = new Set(["qualified", "building", "ready"]);
const sentOutreachStatuses = new Set([
  "sent",
  "replied",
  "interested",
  "declined",
  "unsubscribed",
]);

const discovered = mockLeads.length;
const qualified = mockLeads.filter((lead) =>
  qualifiedStatuses.has(lead.status),
).length;
const websiteBuilt = mockWebsites.filter(
  (site) => site.status !== "failed",
).length;
const approved = mockWebsites.filter(
  (site) => site.status === "approved" || site.status === "live",
).length;
const contacted = mockOutreach.filter((item) =>
  sentOutreachStatuses.has(item.status),
).length;
const interested = mockOutreach.filter(
  (item) => item.status === "interested" || item.status === "replied",
).length;
const customers = mockCustomers.length;

export const mockPipeline: PipelineStage[] = [
  { id: "discovered", label: "Discovered", count: discovered },
  { id: "qualified", label: "Qualified", count: qualified },
  { id: "website_built", label: "Website Built", count: websiteBuilt },
  { id: "approved", label: "Approved", count: approved },
  { id: "contacted", label: "Contacted", count: contacted },
  { id: "interested", label: "Interested", count: interested },
  { id: "customer", label: "Customer", count: customers },
];

export const mockAnalytics: AnalyticsSnapshot = {
  leadConversion: qualified / discovered,
  websiteConversion: websiteBuilt / qualified,
  outreachResponseRate: interested / contacted,
  salesConversion: customers / contacted,
  mrr: mockCustomers
    .filter((customer) => customer.status === "active")
    .reduce((sum, customer) => sum + customer.monthlyRevenue, 0),
  agentCost: 0,
  costPerLead: 0,
  costPerWebsite: 0,
  costPerSale: 0,
  funnel: [
    { stage: "Discovered", count: discovered },
    { stage: "Qualified", count: qualified },
    { stage: "Website Built", count: websiteBuilt },
    { stage: "Contacted", count: contacted },
    { stage: "Interested", count: interested },
    { stage: "Customer", count: customers },
  ],
};

export const mockSettings = {
  general: {
    applicationName: "SiteForge",
    defaultMarket: "South Florida",
    defaultIndustry: "Home Services",
    defaultCurrency: "USD",
  },
  agents: {
    globalStatus: "disabled" as const,
    dailyBudget: 25,
    monthlyBudget: 400,
    requireApprovalForExternalActions: true,
  },
  email: {
    senderDomain: "yourdomain.com",
    salesSender: "sales@yourdomain.com",
    supportSender: "support@yourdomain.com",
  },
  billing: {
    websiteSetup: 99,
    managedPlan: 39,
  },
  safety: {
    requireApprovalBeforeExternalEmail: true,
    requireApprovalBeforeProductionDeployment: true,
    requireApprovalBeforeModifyingCustomerWebsite: true,
    requireApprovalBeforePaymentActions: true,
  },
};
