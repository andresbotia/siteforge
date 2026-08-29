import { getAgentSpend } from "@/data/activity";
import { listPendingApprovals } from "@/data/approvals";
import { listCustomers } from "@/data/customers";
import { listLeads } from "@/data/leads";
import { listOutreach } from "@/data/outreach";
import { listWebsites } from "@/data/websites";
import type { AnalyticsSnapshot, DashboardMetrics, PipelineStage } from "@/types";

const qualified = new Set([
  "qualified",
  "audited",
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
]);
const websiteBuilt = new Set([
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
]);
const approved = new Set(["approved", "contacted", "interested", "customer"]);
const contacted = new Set(["contacted", "interested", "customer"]);
const interested = new Set(["interested", "customer"]);
const sentOutreach = new Set([
  "sent",
  "replied",
  "interested",
  "declined",
  "unsubscribed",
]);

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [leads, websites, approvals, outreach, customers] = await Promise.all([
    listLeads(),
    listWebsites(),
    listPendingApprovals(),
    listOutreach(),
    listCustomers(),
  ]);

  return {
    qualifiedLeads: leads.filter((lead) => qualified.has(lead.status)).length,
    websitesGenerated: websites.length,
    awaitingApproval: approvals.length,
    outreachSent: outreach.filter((item) => sentOutreach.has(item.status)).length,
    customers: customers.length,
    mrr: customers
      .filter((customer) => customer.status === "active")
      .reduce((sum, customer) => sum + customer.monthlyRevenue, 0),
  };
}

export async function getPipeline(): Promise<PipelineStage[]> {
  const leads = await listLeads();
  const count = (statuses: Set<string>) =>
    leads.filter((lead) => statuses.has(lead.status)).length;

  return [
    { id: "discovered", label: "Discovered", count: leads.length },
    { id: "qualified", label: "Qualified", count: count(qualified) },
    { id: "website_built", label: "Website Built", count: count(websiteBuilt) },
    { id: "approved", label: "Approved", count: count(approved) },
    { id: "contacted", label: "Contacted", count: count(contacted) },
    { id: "interested", label: "Interested", count: count(interested) },
    {
      id: "customer",
      label: "Customer",
      count: leads.filter((lead) => lead.status === "customer").length,
    },
  ];
}

export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  const [leads, websites, outreach, customers, metrics, spend] = await Promise.all([
    listLeads(),
    listWebsites(),
    listOutreach(),
    listCustomers(),
    getDashboardMetrics(),
    getAgentSpend(),
  ]);

  const discovered = Math.max(leads.length, 1);
  const qualifiedCount = leads.filter((lead) => qualified.has(lead.status)).length;
  const contactedCount = outreach.filter((item) =>
    sentOutreach.has(item.status),
  ).length;
  const interestedCount = outreach.filter(
    (item) => item.status === "interested" || item.status === "replied",
  ).length;
  const customerCount = customers.length;

  return {
    leadConversion: qualifiedCount / discovered,
    websiteConversion: websites.length / Math.max(qualifiedCount, 1),
    outreachResponseRate: interestedCount / Math.max(contactedCount, 1),
    salesConversion: customerCount / Math.max(contactedCount, 1),
    mrr: metrics.mrr,
    agentCost: spend.thisMonth,
    costPerLead: spend.thisMonth / discovered,
    costPerWebsite: spend.thisMonth / Math.max(websites.length, 1),
    costPerSale: spend.thisMonth / Math.max(customerCount, 1),
    funnel: [
      { stage: "Discovered", count: leads.length },
      { stage: "Qualified", count: qualifiedCount },
      { stage: "Website Built", count: websites.filter((site) => site.status !== "failed").length },
      { stage: "Contacted", count: contactedCount },
      { stage: "Interested", count: interestedCount },
      { stage: "Customer", count: customerCount },
    ],
  };
}
