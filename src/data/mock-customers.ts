import type { Customer, Subscription } from "@/types";

export const mockCustomers: Customer[] = [
  {
    id: "cust_greenline",
    leadId: "lead_greenline",
    businessName: "Greenline Gardens",
    website: "https://www.greenlinegardens.example.test",
    plan: "managed",
    status: "active",
    monthlyRevenue: 39,
    joinedAt: "2026-08-04T12:00:00.000Z",
  },
  {
    id: "cust_palmetto",
    leadId: "lead_palmetto",
    businessName: "Palmetto Air & Heat",
    website: "https://palmetto-hvac.preview.siteforge.local",
    plan: "website_only",
    status: "active",
    monthlyRevenue: 0,
    joinedAt: "2026-08-12T16:30:00.000Z",
  },
  {
    id: "cust_tidewash",
    leadId: "lead_tidewash",
    businessName: "Tidewash Pressure Washing",
    website: "https://tidewash.preview.siteforge.local",
    plan: "managed",
    status: "pending_setup",
    monthlyRevenue: 39,
    joinedAt: "2026-08-20T10:15:00.000Z",
  },
];

export const mockSubscriptions: Subscription[] = [
  {
    id: "sub_greenline",
    customerId: "cust_greenline",
    plan: "managed",
    amount: 39,
    status: "active",
  },
  {
    id: "sub_palmetto",
    customerId: "cust_palmetto",
    plan: "website_only",
    amount: 0,
    status: "active",
  },
  {
    id: "sub_tidewash",
    customerId: "cust_tidewash",
    plan: "managed",
    amount: 39,
    status: "pending",
  },
];
