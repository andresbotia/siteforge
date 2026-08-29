import type { LeadStatus } from "@/types";

export const industries = [
  "Plumbing",
  "HVAC",
  "Roofing",
  "Landscaping",
  "Electrical",
  "Auto Repair",
  "Pressure Washing",
  "Dentistry",
  "Pest Control",
  "Pool Services",
  "General Contractor",
  "Detailing",
  "Salon",
  "Spa",
  "Cleaning",
  "Professional Services",
  "Restaurant",
  "Cafe",
  "Bakery",
  "Casual Dining",
] as const;

export const cities = [
  "Fort Lauderdale",
  "Coconut Creek",
  "Pompano Beach",
  "Boca Raton",
  "Coral Springs",
  "Deerfield Beach",
] as const;

export const leadStatuses: LeadStatus[] = [
  "discovered",
  "qualified",
  "audited",
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
  "rejected",
];

export const settingsDefaults = {
  general: {
    applicationName: "SiteForge",
    defaultMarket: "South Florida",
    defaultIndustry: "Home Services",
    defaultCurrency: "USD",
  },
  agents: {
    globalStatus: "disabled" as const,
    dailyBudget: 1,
    monthlyBudget: 10,
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
