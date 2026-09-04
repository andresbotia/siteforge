/**
 * SiteForge roadmap, as of M10.6.
 *
 * Deliberately a typed constant in source, not a database table: there is no
 * CRUD, no migration, and no admin editing surface. Git history is the audit
 * trail -- a roadmap change is a reviewable commit, which is exactly the
 * property a roadmap needs and a mutable table would lose.
 *
 * Rendered read-only at /roadmap behind the admin session.
 */
export type MilestoneStatus = "done" | "current" | "next" | "backlog";

export type Milestone = {
  id: string;
  title: string;
  status: MilestoneStatus;
  goal: string;
  exitCriteria: string[];
  notes: string;
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  done: "Done",
  current: "Current",
  next: "Next",
  backlog: "Backlog",
};

export const ROADMAP: readonly Milestone[] = [
  {
    id: "M1",
    title: "Application shell and domain model",
    status: "done",
    goal: "Stand up the operator console shell, routing, and the shared domain/database type layer.",
    exitCriteria: [
      "Navigable app shell with pipeline, operations, and analytics sections",
      "Domain types in src/types and database types in src/types/database.ts",
    ],
    notes: "Mock data only at this stage.",
  },
  {
    id: "M2",
    title: "Supabase persistence and single-admin auth",
    status: "done",
    goal: "Move application state into Supabase behind a server-only secret key and a temporary single-admin session.",
    exitCriteria: [
      "All reads/writes go through src/data repositories after requireAdminSession()",
      "RLS enabled; anon/authenticated have no grants on application tables",
    ],
    notes: "Temporary cookie auth in src/lib/auth and src/proxy.ts. Supabase Auth is still backlog.",
  },
  {
    id: "M3",
    title: "Paid-AI budget gates",
    status: "done",
    goal: "Make it structurally impossible to spend money on AI without an approved dollar ceiling.",
    exitCriteria: [
      "Postgres reservations plus executeApprovedAiRun enforce the ceiling, not UI copy",
      "Daily/monthly caps and per-run ceilings live in one place",
    ],
    notes: "Money is integer ticks. Estimated cost is advisory; approved maximum is the hard ceiling.",
  },
  {
    id: "M4",
    title: "Scout — discovery and qualification",
    status: "done",
    goal: "Find local businesses from public data and score them deterministically.",
    exitCriteria: [
      "Deterministic qualification score; no LLM authors the official score",
      "SSRF-safe website inspection; $0 basic runs",
    ],
    notes: "V1.1 added Google Places as the preferred provider with OpenStreetMap as the $0 fallback.",
  },
  {
    id: "M5",
    title: "Auditor — deterministic website audit",
    status: "done",
    goal: "Inspect an existing lead's website and produce a deterministic quality and redesign-opportunity score.",
    exitCriteria: [
      "Deterministic scoring; shared SSRF-safe HTTP client reused",
      "$0 basic runs; inspects existing leads only",
    ],
    notes: "Does not discover businesses, generate websites, or contact anyone.",
  },
  {
    id: "M6",
    title: "Builder — internal website drafts",
    status: "done",
    goal: "Turn an audited lead into a structured WebsiteSpec draft rendered by a trusted template system.",
    exitCriteria: [
      "Specs are data, never executable code stored in the database",
      "Deterministic composition; internal authenticated preview only",
    ],
    notes: "No deploy, no domain purchase, no contact with the business.",
  },
  {
    id: "M7",
    title: "Preview deployments and tracking",
    status: "done",
    goal: "Share a Builder draft with a prospect through an approval-gated, tokenized public preview.",
    exitCriteria: [
      "sfp_ tokens stored as hash plus hint only; raw token shown once",
      "Privacy-conscious view/CTA tracking with no raw IP storage",
    ],
    notes: "Public prospect previews stay separate from customer production hosting.",
  },
  {
    id: "M8",
    title: "Sales — deterministic outreach with email approval",
    status: "done",
    goal: "Draft a prospect email deterministically and bind an exact-content human approval before any send.",
    exitCriteria: [
      "Approval binds recipient, subject, body, preview deployment, content version, attribution hash",
      "Separate sfo_ attribution tokens; edits invalidate approval",
    ],
    notes: "Mock email provider by default; the guarded Resend path is gated off unless explicitly configured.",
  },
  {
    id: "M9",
    title: "Stripe Checkout and customer conversion",
    status: "done",
    goal: "Take a manual commercial offer through approval, checkout, webhook ingestion, and lead-to-customer conversion.",
    exitCriteria: [
      "Checkout approval binds exact amounts, plan, website, outreach, content version and hash",
      "Webhook handling idempotent by Stripe event ID with no duplicate customers or subscriptions",
    ],
    notes: "Mock Stripe by default. Live/test requires STRIPE_ALLOW_LIVE_PAYMENTS plus server secrets.",
  },
  {
    id: "M9.5",
    title: "Real-prospect preparation and controlled campaign setup",
    status: "done",
    goal: "Prepare a bounded first real campaign: manual public prospect import, Auditor calibration, guarded real email, external design import.",
    exitCriteria: [
      "Campaign capped at five manually selected prospects",
      "Verified public facts and no-website prospects modeled without schema drift",
    ],
    notes: "Includes the M9.5D external generated-site import path and the Designer Job worker track.",
  },
  {
    id: "M9.6",
    title: "Real Stripe integration (test/live mode)",
    status: "done",
    goal: "Replace the mock-only Stripe seam with a real provider whose mode is derived from the secret key's own prefix.",
    exitCriteria: [
      "MOCK/TEST/LIVE surfaced in the UI; no secret value ever displayed",
      "Provider refuses to create a session when offer amounts drift from the configured Prices",
    ],
    notes: "Still uncredentialed by default. Live payment rehearsal is M11.",
  },
  {
    id: "M9.7",
    title: "Customer purchase links",
    status: "done",
    goal: "Let a customer complete checkout on their own from an admin-published, token-gated purchase page.",
    exitCriteria: [
      "sfb_ purchase tokens stored as hash plus hint only",
      "Public /buy/[token] re-derives the Stripe request server-side; no client-supplied amount",
    ],
    notes: "Invalid, revoked, and edited-since-approval offers all render one identical unavailable page.",
  },
  {
    id: "M9.8",
    title: "Payment provenance and revenue truthfulness",
    status: "done",
    goal: "Never present a mock or Stripe TEST payment as real revenue anywhere in the console.",
    exitCriteria: [
      "mock / test / live distinguished per customer and per payment",
      "Only live payments count toward revenue figures",
    ],
    notes: "Corrected M10.6: this had been left marked \"current\" despite M9.9/M10/M10.5 all having shipped after it. PaymentEnvironmentBadge and the customers list/detail pages distinguish mock/test/live and gate revenue on live throughout.",
  },
  {
    id: "M9.9",
    title: "Lifecycle states and the payment follow-up email",
    status: "done",
    goal: "Model where a lead actually is, lock offer amounts to the configured prices, and add the post-intent payment email.",
    exitCriteria: [
      "One explicit allowed-transitions table with archived reachable from any state and an interested -> contacted fallback",
      "Offer drafting selects between two configured plans; the provider price lock stays untouched",
      "follow_up outreach kind reusing the existing approval, suppression, duplicate and provider machinery",
    ],
    notes: "Follow-up approval binds recipient, subject, body, offer id, and purchase token hash. Send requires an interested lead and an active purchase link.",
  },
  {
    id: "M10",
    title: "Operator Console",
    status: "done",
    goal: "Make the daily operating surface answer 'what needs my attention right now' without hunting across pages.",
    exitCriteria: [
      "Primary nav collapsed to five task-shaped items; /leads/[id] operates a business end to end",
      "work_items table + /today queue, created and resolved by the same state-change code paths, ordered by proximity to revenue",
    ],
    notes: "Structure only. The visual system pass is M10.5. Outreach commercial terms corrected here too.",
  },
  {
    id: "M10.5",
    title: "Visual System Pass",
    status: "done",
    goal: "Bring the console onto one deliberate visual system instead of accumulated per-page styling.",
    exitCriteria: [
      "DESIGN-SYSTEM.md authored; --sf-* token layer + five-size type scale in globals.css; contrast enforced by test",
      "Shared tokens and components applied consistently across pipeline and operations pages",
      "Responsive and accessible behavior verified, not assumed",
    ],
    notes: "Deliberately after M10 so the layout settles before it is styled. Task 0 carried M10's remaining fixes (reconcile out of render, reconcile-failure banner, review_visuals work item, dedup detail buttons, dev-seed mix). Shipped dark; M10.6 converted it to light.",
  },
  {
    id: "M10.6",
    title: "Data hygiene and light theme",
    status: "current",
    goal: "Show only real work before the first campaign, fix the work-item overlap that surfaced once real data was in the mix, and move the console off dark onto a light neutral ramp.",
    exitCriteria: [
      "Reversible, dry-run-first archive script for seed/fixture leads, dead Scout experiments, and mock-Stripe smoke-test customers",
      "confirm_intent / approve_follow_up can no longer fire once a customer row exists; /today groups by business, capped at 7 businesses",
      "Console palette re-derived light, same token architecture, contrast.test.ts passing unweakened",
      "Add-prospect form off the Pipeline page body; numeric columns read in an intuitive direction",
    ],
    notes: "Dry run only was executed this session -- the archive script's --execute is an operator call after reviewing the classification.",
  },
  {
    id: "M11",
    title: "Live Payment Rehearsal",
    status: "backlog",
    goal: "Exercise the full payment path end to end in Stripe TEST mode against the hosted project.",
    exitCriteria: [
      "Test-mode checkout completes and the webhook converts the lead to a customer",
      "Purchase link, follow-up email, and success page all verified against real Stripe behavior",
    ],
    notes: "Requires operator Stripe configuration: test keys, Price IDs, webhook endpoint and signing secret.",
  },
  {
    id: "M12",
    title: "First Campaign",
    status: "backlog",
    goal: "Run the bounded first real prospect campaign end to end.",
    exitCriteria: [
      "Five manually selected prospects contacted through the approved send path",
      "Preview attribution and replies tracked back to each outreach",
    ],
    notes: "Blocked on live payment rehearsal; no real prospect email should go out before that.",
  },
  {
    id: "M13",
    title: "First Customer",
    status: "backlog",
    goal: "Take one real business from interest through payment to a delivered, live website.",
    exitCriteria: [
      "A real completed payment recorded as live revenue",
      "The customer's website deployed through an approved deployment path",
    ],
    notes: "Depends on production deployment and DNS, which are still backlog.",
  },
  {
    id: "BACKLOG-MANAGER",
    title: "Manager agent",
    status: "backlog",
    goal: "Coordinate the other agents' runs instead of every run being manually triggered.",
    exitCriteria: ["Auditable run orchestration with per-action approval gates preserved"],
    notes: "Manager execution is explicitly not implemented in any milestone so far.",
  },
  {
    id: "BACKLOG-DEPLOY",
    title: "Production deployment and DNS",
    status: "backlog",
    goal: "Deploy a customer website to production and point a real domain at it.",
    exitCriteria: ["Approval-gated deploy path", "Domain and DNS changes recorded and reversible"],
    notes: "No production deployment, domain purchase, or DNS change has been performed to date.",
  },
  {
    id: "BACKLOG-SCOUT-SCALE",
    title: "Scout scaling",
    status: "backlog",
    goal: "Discover beyond the current short static location list and single-request-per-run ceiling.",
    exitCriteria: ["General location resolution", "Quota-aware provider usage above the current monthly ceiling"],
    notes: "Current limits are honest V1 characteristics of a $0/low-cost source mix, not bugs.",
  },
  {
    id: "BACKLOG-REPLIES",
    title: "Reply detection",
    status: "backlog",
    goal: "Detect and classify prospect replies so lead status reflects reality without manual bookkeeping.",
    exitCriteria: ["Inbound replies attributed to the originating outreach", "Interested/declined transitions driven by real signal"],
    notes: "Until this exists, the M9.9 lifecycle transitions are set by an operator by hand.",
  },
  {
    id: "BACKLOG-REFUNDS",
    title: "Refund handling",
    status: "backlog",
    goal: "Handle refunds and cancellations as first-class, approval-gated actions.",
    exitCriteria: ["Refund requires explicit approval", "Customer, subscription and revenue state stay consistent afterwards"],
    notes: "No refund-creating code exists anywhere in the payments module today.",
  },
  {
    id: "BACKLOG-DESIGN-MASTERS",
    title: "Design master materialization",
    status: "backlog",
    goal: "Turn an approved Designer job into a reusable master template package on disk.",
    exitCriteria: ["Master package with DESIGN.md, metadata, and source", "Builder can select a promoted master"],
    notes: "The package contract is defined in src/lib/designer/reference.ts but nothing materializes it yet.",
  },
  {
    id: "BACKLOG-SUPABASE-AUTH",
    title: "Supabase Auth",
    status: "backlog",
    goal: "Replace the temporary single-admin cookie session with real authentication.",
    exitCriteria: ["Per-user identity and roles", "Session handling that does not depend on a shared env credential"],
    notes: "The temporary auth is a launch bridge and is documented as such. Credential rotation is still outstanding.",
  },
] as const;

export function milestonesByStatus(status: MilestoneStatus): Milestone[] {
  return ROADMAP.filter((milestone) => milestone.status === status);
}
