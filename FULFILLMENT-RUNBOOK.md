# Fulfillment Runbook

This is a manual, step-by-step checklist for what happens between "the
customer's Stripe payment succeeds" and "their site is live." It documents
the process as it actually works today, including the parts that are still
100% manual. It is not aspirational — every claim below is checked against
the current code, tests, and migrations (as of 2026-09-06). Where a step has
no in-app tooling, that is called out explicitly rather than implied away.

M10 adds no background workers or schedulers (see `AGENTS.md`), so every step
below either already runs synchronously inside a request (Step 1) or is a
human doing something outside the app (Steps 2-7). This is expected to stay a
manual runbook until a later milestone explicitly builds automation for it.

## At a glance

| # | Step | In-app today? | Active time | Elapsed/wait time |
|---|------|----------------|-------------|--------------------|
| 1 | Payment succeeds (webhook) | **Yes, fully automated** | 0 | Seconds |
| 2 | Register the domain | **No — 0% built** | ~5-10 min | Usually instant |
| 3 | Point DNS at the Vercel project | **No — 0% built** | ~10-15 min | 0 (config only) |
| 4 | Deploy the generated site | **No — 0% built** | ~15-30 min | A few minutes (build) |
| 5 | Wait for DNS + SSL | N/A (not code) | ~0 (monitoring) | Minutes to ~48 hours |
| 6 | Send live link + welcome email | **No — 0% built** | ~10 min | 0 |
| 7 | Mark the lead a customer | **Already done in Step 1** — see note | N/A | N/A |

The one step that is genuinely automatic is Step 1. Everything else is a
human doing something in an external account (Stripe dashboard, a domain
registrar, Vercel) or, in Step 7's case, directly in the Supabase table
editor, because no operator-facing tool exists for it yet.

---

## Step 1 — Payment succeeds (Stripe webhook fires)

**What already happens automatically**, inside `processCheckoutCompletedEvent`
(`src/data/payments.ts:976-1151`), triggered by the webhook route at
`src/app/api/stripe/webhook/route.ts`:

1. The event is recorded in `stripe_webhook_events` keyed by Stripe's event
   ID, so a retried webhook delivery is a no-op (`src/data/payments.ts:982-994`).
2. The matching `stripe_checkout_sessions` row is marked `completed`.
3. A `customers` row is created (or updated) with `status: "pending_setup"`
   (`src/data/payments.ts:1038-1067`).
4. The bound `commercial_offers` row is marked `status: "paid"`.
5. **The lead's pipeline status flips to `customer` right here** —
   `src/data/payments.ts:1077-1080`, via `resolveMonotonicLeadStatus`
   (`src/lib/scout/status.ts:47`).
6. If a managed plan was selected, a `subscriptions` row is created with
   `status: "active"`.
7. An `activity_events` row is inserted with `event_type: "customer_converted"`
   — this is an internal audit-log row, **not** a notification to anyone.
8. A work item is created: `type: "fulfill_site"`, labeled "Fulfil the paid
   site" on `/today` (`src/lib/work-items/types.ts:37,49`;
   `src/data/payments.ts:1132-1147`).

**Active time:** 0 — nothing for a human to do.
**Elapsed time:** seconds (normal Stripe webhook delivery latency).
**Manual account action outside the codebase:** none. This is the only step
in the whole pipeline that is code-driven end to end.

**Gap to flag — no payment-success notification exists yet.** Nothing pushes
this event to a person: no email, no Slack message, no push notification.
The only way an operator learns a payment came in is by (a) noticing "Fulfil
the paid site" appear on `/today`, or (b) checking the Stripe dashboard or
the `activity_events` table directly. **Once a notification is built, it
belongs right after the work-item insert** at
`src/data/payments.ts:1132-1147` — that is the natural hook point, since by
then the customer/offer/subscription rows and the work item all already
exist and can be referenced in the notification payload.

**Important ordering note for Step 7 below:** because the lead's status
already becomes `customer` in this step, "mark the lead as a customer in the
pipeline" is not a thing left to do later — it happens the moment the
customer pays, potentially days before the site is actually live. See the
Step 7 note.

---

## Step 2 — Register the domain

**In-app tooling: none.** Confirmed — there is no registrar, WHOIS, or
DNS-lookup code anywhere in the repo. `src/lib/prospects/suggested-domain.ts`
states outright that "SiteForge performs no registry/WHOIS/DNS lookup here";
the `suggestedDomain` field is only ever used as an unverified example string
in cold-outreach copy, never as a real availability check.

**Manual action (outside the codebase):** the founder logs into the
registrar account and registers the domain under the **founder's own
registrant contact info**, with **WHOIS privacy enabled**. No customer data
is needed for this step.

**Active time:** ~5-10 min.
**Elapsed time:** usually instant; some TLDs/registrars can take longer to
finalize registration.

**This is where the commercial-terms discrepancy starts — see the dedicated
section below before treating this step as final.**

---

## Step 3 — Point DNS at the customer's Vercel project (create if new)

**In-app tooling: none for production sites.** The only real Vercel API
integration in the repo is `createVercelPreviewDeploymentProvider()`
(`src/lib/builder/external-artifacts.ts:520-572`), which creates preview
deployments inside SiteForge's own internal preview project for prospects —
it does not create or touch customer production Vercel projects, and isn't
wired to do so. Separately, Builder explicitly forbids DNS changes in code
(`src/lib/builder/policy.ts` — `canChangeDns: false`, throws
`builder_dns_forbidden`), and `AGENTS.md` prohibits any DNS/domain action —
so this being unbuilt is a deliberate current restriction, not an oversight.

**Manual action (outside the codebase):**
1. In the Vercel dashboard, create a new project for the customer if one
   doesn't already exist.
2. Add the domain registered in Step 2 to that project.
3. Set the DNS records Vercel specifies (A/CNAME, per its instructions) at
   the registrar from Step 2.

**Active time:** ~10-15 min.
**Elapsed time:** 0 — this step is configuration only; propagation is
Step 5.

---

## Step 4 — Deploy the generated site to that project

**In-app tooling: none.** There is no "promote to production" action
anywhere in the codebase. The generated site currently exists only as an
internal `WebsiteSpec` draft (`/websites/[id]`) rendered through the
allowlisted template system, plus an internal preview deployment — there is
no code path that pushes it into a customer-facing production Vercel
project. This matches the roadmap: `BACKLOG-DEPLOY` in
`src/lib/roadmap/roadmap.ts` is explicitly `status: "backlog"`, and
`AGENTS.md` currently prohibits production deployment outright.

**Manual action (outside the codebase):** the founder manually takes the
generated site's output and deploys it to the Vercel project from Step 3
(however that is currently done by hand — e.g. exporting the rendered
output and pushing/importing it into the project). *(Fill in the exact
manual mechanics here once the export path is settled — this runbook
currently only documents that no in-app path exists yet.)*

**Active time:** ~15-30 min (variable).
**Elapsed time:** a few minutes (Vercel build time).

---

## Step 5 — Wait for DNS propagation + SSL issuance

Not code-related — this step is elapsed time, not active work.

**Active time:** ~0 (periodic checking only).
**Elapsed time:** minutes up to ~48 hours depending on the registrar's DNS
TTL; Vercel typically auto-issues an SSL certificate within minutes once DNS
resolves correctly to it.
**Manual action:** check the Vercel project's domain-status indicator (or an
external DNS-checker tool) until it shows a valid configuration and an
issued certificate before telling the customer the link is live.

---

## Step 6 — Send the customer their live link + welcome email

**In-app tooling: none.** SiteForge's outreach system only has two kinds
today — `cold_outreach` and `follow_up` (`OUTREACH_KINDS` in
`src/lib/sales/kinds.ts:12`) — there is no third kind for a post-purchase
welcome/onboarding email, and no such template exists anywhere in
`src/lib/email` or `src/lib/sales`. Nothing in the checkout-completed path
sends any email to the customer.

**Manual action (outside the codebase):** the founder composes and sends the
welcome email by hand (outside SiteForge's mock/guarded Resend path, which
is only wired for the two existing outreach kinds), including the live site
URL from Step 3/4.

**Active time:** ~10 min.
**Elapsed time:** 0.

**Gap to flag:** if this should eventually become a real third outreach kind
(with its own approval binding, like `cold_outreach` and `follow_up` have),
that's a genuine scope decision for a future milestone, not something to
back into here.

---

## Step 7 — Mark the lead as a customer in the pipeline

**Discrepancy worth flagging directly: this already happened, automatically,
in Step 1.** The lead's `status` column became `customer` the instant the
Stripe webhook processed the payment (`src/data/payments.ts:1077-1080`) —
not after the site goes live. So there is nothing left to do here to "mark
the lead as a customer"; by the time you reach this step, that has already
been true for as long as fulfillment took.

**What this step actually needs to be, and currently has zero tooling for:**
resolving the "Fulfil the paid site" work item. That item's resolution
condition is purely mechanical — it stays open as long as
`customers.status = 'pending_setup'`, and resolves the moment that status
leaves `pending_setup` (`src/lib/work-items/derive.ts:159-162`; documented
in `HANDOFF.md:174`). `customers.status` only accepts `'active'`,
`'pending_setup'`, or `'cancelled'` (`supabase/migrations/20260829100000_initial_schema.sql:275`).

**There is no operator-facing UI or server action anywhere in `src/data` or
`src/app` that flips `customers.status` from `pending_setup` to `active`, or
that sets `customers.production_url`** (a column that already exists on the
table and is populated in dev-seed data, but never written by any real code
path). Today, this requires a **direct edit in the Supabase table editor**:
set `customers.status = 'active'` and `customers.production_url` to the live
URL. The next `/today` reconcile pass (which runs on every page visit) will
then resolve the work item automatically — no further action needed once the
row is edited.

**Active time:** ~2 min (direct database edit).
**Elapsed time:** effectively 0 — resolves on the next `/today` page load.

---

## Commercial-terms discrepancy — needs a decision, not just a doc update

The process above (Step 2) has the **founder register the domain under
their own registrant info**, with the domain held by SiteForge during the
hosting period and transferred to the customer on request or at offboarding.

But the commercial terms already baked into every cold-outreach and
payment-follow-up email — verbatim, and enforced as non-editable — say
something different:

> "The domain is registered in `{business name}`'s name, with SiteForge
> listed only as the technical contact. It transfers to you on request at
> any time."
> — `src/lib/sales/commercial-terms.ts:39`

These describe two different ownership models:

- **What customers are currently told:** they are the registrant of record
  from day one; SiteForge is only ever the technical contact.
- **What the agreed process above actually does:** SiteForge (or the
  founder) is the registrant of record during the hosting period; the
  customer receives a transfer on request or at offboarding.

That is a real, customer-facing accuracy problem, not a wording nitpick —
someone who reads the email and later checks WHOIS would find SiteForge/the
founder listed as registrant, not themselves, contradicting what they were
told before they paid.

**This needs a decision:**
- **Option A** — change the actual registration process to name the customer
  as registrant from day one (matches existing copy). Note this would
  require collecting the customer's legal business name and address as
  registrant contact info at Step 2, which the "no customer data needed at
  this step" framing above assumes away.
- **Option B** — change the commercial-terms copy to describe a
  SiteForge-holds-during-hosting / transfers-on-request-or-offboarding
  model instead.

**If Option B is chosen, every one of these needs updating** (found by
searching the repo for this claim; none changed as part of this
documentation-only task):

- `src/lib/sales/commercial-terms.ts:34-42` — `commercialTermsLines()`, the
  actual source of truth both cold and follow-up emails pull from verbatim.
- `src/lib/sales/commercial-terms.ts:58-66` — `COMMERCIAL_TERMS_REQUIRED_PHRASES`,
  the list that gates a real send on the wording being present; must change
  in lockstep with the wording itself.
- `src/lib/sales/commercial-terms.test.ts:16-19` — asserts the current
  wording.
- `src/lib/sales/sales.test.ts:95-104` — asserts the current wording appears
  in the composed draft body.
- `.claude/product-marketing.md:52,61-62,96` — the positioning doc (drafted
  2026-09-06) repeats the same registrant-in-customer's-name claim in three
  places.
- `HANDOFF.md:178` — a session note paraphrasing the clause; historical, so
  it doesn't need editing, but a future reader should know it now describes
  a superseded model if Option B is chosen.

No code, tests, or copy were changed as part of writing this runbook — this
section is a flag for a decision to make, not a change already made.
