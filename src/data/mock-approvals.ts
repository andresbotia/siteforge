import type { Approval } from "@/types";

export const mockApprovals: Approval[] = [
  {
    id: "appr_palmetto_deploy",
    leadId: "lead_palmetto",
    agentId: "builder",
    type: "website_deployment",
    requestedAction: "Deploy Palmetto Air & Heat to production",
    reason:
      "Internal review approved the preview. Production publish is an external side effect and requires a human decision.",
    status: "pending",
    riskLevel: "high",
    createdAt: "2026-08-18T14:26:00.000Z",
  },
  {
    id: "appr_harborline_email",
    leadId: "lead_harborline",
    agentId: "sales",
    type: "external_email",
    requestedAction: "Send introduction email to Harborline Plumbing",
    reason:
      "A personalized draft is ready. Sending email to a real inbox requires approval.",
    status: "pending",
    riskLevel: "medium",
    createdAt: "2026-08-17T10:24:00.000Z",
  },
  {
    id: "appr_greenline_mod",
    leadId: "lead_greenline",
    customerId: "cust_greenline",
    agentId: "manager",
    type: "website_modification",
    requestedAction: "Publish seasonal services update on the live customer site",
    reason:
      "Greenline Gardens is a managed customer. Customer-facing changes require approval initially.",
    status: "pending",
    riskLevel: "medium",
    createdAt: "2026-08-25T15:20:00.000Z",
  },
  {
    id: "appr_tidewash_pay",
    leadId: "lead_tidewash",
    agentId: "sales",
    type: "payment_action",
    requestedAction: "Create a $99 website setup invoice for Tidewash Pressure Washing",
    reason:
      "The prospect is marked interested. Charges and invoices are privileged actions.",
    status: "pending",
    riskLevel: "high",
    createdAt: "2026-08-21T16:08:00.000Z",
  },
  {
    id: "appr_oakridge_deploy",
    leadId: "lead_oakridge",
    agentId: "builder",
    type: "website_deployment",
    requestedAction: "Request production deploy for Oakridge Auto Repair",
    reason:
      "Preview is waiting on website review. Production deployment cannot proceed without approval.",
    status: "pending",
    riskLevel: "high",
    createdAt: "2026-08-19T12:02:00.000Z",
  },
  {
    id: "appr_banyan_email",
    leadId: "lead_banyan",
    agentId: "sales",
    type: "external_email",
    requestedAction: "Send follow-up with preview link to Banyan Air Comfort",
    reason:
      "External email is a side effect. The draft may be edited before approval.",
    status: "pending",
    riskLevel: "medium",
    createdAt: "2026-08-22T09:41:00.000Z",
  },
];
