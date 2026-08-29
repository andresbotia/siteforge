import { Badge } from "@/components/shared/badge";
import {
  approvalTypeLabel,
  connectionStatusLabel,
  customerPlanLabel,
  customerStatusLabel,
  leadStatusLabel,
  outreachStatusLabel,
  riskLabel,
  websiteStatusLabel,
} from "@/lib/labels";
import type {
  ApprovalType,
  ConnectionStatus,
  CustomerPlan,
  CustomerStatus,
  GeneratedWebsiteStatus,
  LeadStatus,
  OutreachStatus,
  RiskLevel,
} from "@/types";

const leadTone = {
  discovered: "neutral",
  auditing: "info",
  qualified: "accent",
  rejected: "danger",
  building: "warning",
  ready: "success",
} as const;

const websiteTone = {
  building: "warning",
  review_required: "info",
  approved: "accent",
  live: "success",
  failed: "danger",
} as const;

const outreachTone = {
  draft: "neutral",
  awaiting_approval: "warning",
  sent: "info",
  replied: "accent",
  interested: "success",
  declined: "danger",
  unsubscribed: "neutral",
} as const;

const customerStatusTone = {
  active: "success",
  pending_setup: "warning",
  cancelled: "neutral",
} as const;

const planTone = {
  website_only: "neutral",
  managed: "accent",
} as const;

const approvalTone = {
  website_deployment: "accent",
  external_email: "info",
  website_modification: "warning",
  payment_action: "danger",
} as const;

const riskTone = {
  low: "success",
  medium: "warning",
  high: "danger",
} as const;

const connectionTone = {
  not_connected: "neutral",
  connected: "success",
  error: "danger",
} as const;

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={leadTone[status]}>{leadStatusLabel[status]}</Badge>;
}

export function WebsiteStatusBadge({
  status,
}: {
  status: GeneratedWebsiteStatus;
}) {
  return (
    <Badge tone={websiteTone[status]}>{websiteStatusLabel[status]}</Badge>
  );
}

export function OutreachStatusBadge({ status }: { status: OutreachStatus }) {
  return (
    <Badge tone={outreachTone[status]}>{outreachStatusLabel[status]}</Badge>
  );
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge tone={customerStatusTone[status]}>
      {customerStatusLabel[status]}
    </Badge>
  );
}

export function PlanBadge({ plan }: { plan: CustomerPlan }) {
  return <Badge tone={planTone[plan]}>{customerPlanLabel[plan]}</Badge>;
}

export function ApprovalTypeBadge({ type }: { type: ApprovalType }) {
  return (
    <Badge tone={approvalTone[type]}>{approvalTypeLabel[type]}</Badge>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={riskTone[level]}>{riskLabel[level]} risk</Badge>;
}

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <Badge tone={connectionTone[status]}>
      {connectionStatusLabel[status]}
    </Badge>
  );
}
