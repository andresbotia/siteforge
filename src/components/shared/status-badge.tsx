import { Badge } from "@/components/shared/badge";
import { MANUAL_PUBLIC_PROSPECT_SOURCE } from "@/lib/prospects/constants";
import {
  approvalTypeLabel,
  commercialOfferStatusLabel,
  connectionStatusLabel,
  customerPlanLabel,
  customerStatusLabel,
  leadStatusLabel,
  outreachStatusLabel,
  qualificationTierLabel,
  riskLabel,
  websiteStatusLabel,
} from "@/lib/labels";
import type {
  ApprovalType,
  CommercialOfferStatus,
  ConnectionStatus,
  CustomerPlan,
  CustomerStatus,
  GeneratedWebsiteStatus,
  LeadStatus,
  OutreachStatus,
  PaymentEnvironment,
  QualificationTier,
  RiskLevel,
} from "@/types";

// Tone assignments follow the canonical map in DESIGN-SYSTEM.md section 1.
// The through-line: `warning` always means "the operator has a decision to
// make". There is no `accent` tone -- accent is for interactive elements.
const leadTone = {
  discovered: "neutral",
  qualified: "success",
  audited: "info",
  website_built: "info",
  approved: "success",
  contacted: "info",
  interested: "success",
  customer: "success",
  rejected: "danger",
  archived: "neutral",
} as const;

const websiteTone = {
  building: "info",
  review_required: "warning",
  approved: "success",
  live: "success",
  failed: "danger",
} as const;

const outreachTone = {
  draft: "neutral",
  awaiting_approval: "warning",
  approved: "success",
  sent: "info",
  failed: "danger",
  replied: "info",
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
  managed: "info",
} as const;

// Approval type is a category, not a state. All neutral except the classes
// that carry irreversible-side-effect risk, flagged with `warning`.
const approvalTone = {
  website_deployment: "neutral",
  external_email: "neutral",
  website_modification: "neutral",
  payment_action: "warning",
  paid_ai_usage: "warning",
  dns_change: "warning",
  destructive_infrastructure_action: "warning",
} as const;

const commercialOfferTone = {
  draft: "neutral",
  awaiting_approval: "warning",
  approved: "success",
  checkout_created: "info",
  paid: "success",
  expired: "neutral",
  cancelled: "danger",
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

const paymentEnvironmentTone = {
  mock: "neutral",
  test: "warning",
  live: "success",
  unknown: "neutral",
} as const;

const leadWebsiteTone = {
  has_website: "success",
  no_standalone_website: "warning",
  unknown: "neutral",
} as const;

const qualificationTone = {
  reject: "danger",
  review: "warning",
  qualified: "success",
  high_priority: "success",
} as const;

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={leadTone[status]}>{leadStatusLabel[status]}</Badge>;
}

export function LeadSourceBadge({ source }: { source: string | null }) {
  const normalized = source ?? "seed";
  if (normalized === MANUAL_PUBLIC_PROSPECT_SOURCE) {
    return <Badge tone="info">Manual public</Badge>;
  }
  if (normalized === "scout") {
    return <Badge tone="neutral">Scout</Badge>;
  }
  return <Badge tone="neutral">Seed / fixture</Badge>;
}

export function LeadWebsiteStatusBadge({
  status,
}: {
  status: keyof typeof leadWebsiteTone;
}) {
  const label =
    status === "no_standalone_website"
      ? "No standalone website"
      : status === "has_website"
        ? "Website"
        : "Website unknown";
  return <Badge tone={leadWebsiteTone[status]}>{label}</Badge>;
}

export function QualificationBadge({ tier }: { tier: QualificationTier }) {
  return (
    <Badge tone={qualificationTone[tier]}>{qualificationTierLabel[tier]}</Badge>
  );
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

export function CommercialOfferStatusBadge({
  status,
}: {
  status: CommercialOfferStatus;
}) {
  return (
    <Badge tone={commercialOfferTone[status]}>
      {commercialOfferStatusLabel[status]}
    </Badge>
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

export function PaymentEnvironmentBadge({
  environment,
}: {
  environment: PaymentEnvironment;
}) {
  const label =
    environment === "live"
      ? "Live payment"
      : environment === "test"
        ? "Stripe TEST payment"
        : environment === "mock"
          ? "Mock payment"
          : "Payment unknown";
  return <Badge tone={paymentEnvironmentTone[environment]}>{label}</Badge>;
}
