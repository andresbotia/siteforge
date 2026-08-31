# SiteForge

SiteForge is an AI-assisted website operations platform for a local-business website agency.

The product finds strong local businesses with weak websites, generates a better site, requires a human to approve anything that leaves the system, then sells, deploys, and optionally manages the site.

## Problem

Local service businesses often have strong demand and weak websites. Rebuilding those sites by hand does not scale. Fully autonomous outreach, billing, and deployment is unsafe.

SiteForge is the operating system for that workflow: specialized agents do research and drafting, humans approve external side effects, and the company can sell a one-time site or a managed monthly service.

## Long-term workflow

Discover → Audit → Build → Approve → Outreach → Sell → Deploy → Manage

1. Discover local businesses.
2. Analyze their existing websites.
3. Identify strong businesses with poor websites.
4. Generate improved websites.
5. A human reviews and approves the website.
6. Generate personalized outreach.
7. A human approves outreach.
8. Contact the business.
9. Accept payment.
10. Deploy the production website.
11. Optionally manage the website as a monthly service.

## Future agents

| Agent | Role |
| --- | --- |
| **Scout** | Finds promising local businesses. |
| **Auditor** | Analyzes existing websites and SEO. |
| **Builder** | Generates improved websites. |
| **Sales** | Creates personalized outreach. |
| **Manager** | Handles requests for paying customers. |

Scout, Auditor, Builder, and Sales can run **manually**. Manager stays disabled. Placeholder directories live in `src/agents`.

## Human approval philosophy

- **Read actions** can generally operate autonomously in the future (public research, inspecting a public site, reading internal records).
- **Internal writes** may operate autonomously depending on scope (create a lead, save an audit, store a draft).
- **External side effects require human approval initially**: sending email, production deploys, customer site changes, charges, refunds, DNS changes, deleting production resources, and **paid AI usage**.

Agents never hold privileged infrastructure credentials, including `XAI_API_KEY` and `SUPABASE_SECRET_KEY`. They request actions through backend-controlled tools that validate input, check approval, execute with server credentials, and log the result.

## Current milestone

M9.5D prepares the **first controlled prospect campaign**. The campaign is bounded to at most five manually selected real prospects and reuses the existing deterministic Scout/Auditor/Builder/Sales workflow. There is no bulk discovery, no bulk send, no scheduler, and no AI-generated outreach copy.

M9.5C is locked complete: Resend is configured server-side, `mail.andresbotia.com` was verified externally in Resend, the live-email gate was exercised for one operator-only internal test email, and that test delivered successfully without mutating lead/prospect/customer funnel state. No prospect email was sent during M9.5C.

M9.5D prospect sends require all of the following:

- Operator manually selects the prospect and uses only reliable public business contact information.
- Deterministic Auditor and Builder results are reviewed before Sales drafting.
- If the operator has explicitly verified that a prospect has no standalone business website, SiteForge stores that as a new-website opportunity instead of inventing a URL or audit score. Auditor is skipped; Builder uses only sourced lead facts.
- For explicit no-website prospects, the lead detail page supports admin-only verified public fact enrichment: source URL, public summary, cuisine/category, hours, rating, review count, and public social/menu/order/reservation URLs. Saved enrichment stores provenance in `inspection_summary.verified_public_facts` and can be used by a later Builder regeneration.
- The tracked public preview is approved, active, public, not revoked, not expired, and linked to the same lead and generated website.
- Sales draft content is deterministic; no paid AI writes official email copy.
- A human approval binds the exact recipient, subject, body, preview deployment, content version, and attribution token hash.
- Backend send execution revalidates approval, content fingerprint, recipient, provider readiness, live-email gate, duplicate state, suppression/DNC history, and unsubscribe/opt-out language.
- The final send button identifies when a real external email will be sent.

`outreach.campaign_id = m9.5d-first-controlled-campaign` identifies the first experiment. New Sales drafts are capped at five distinct leads for that campaign. No migration is needed because `campaign_id` already exists on `outreach` and `preview_deployments`.

No-website prospects are represented without a schema change: `leads.website_url` and `leads.normalized_domain` stay null, while `leads.inspection_summary.website_status = verified_no_standalone_website` and `no_standalone_website = true` record the operator verification. Missing or malformed URLs do not create this state automatically.

Milestone 9 adds **Stripe Checkout + customer conversion**: manual commercial offers, approval-bound mock checkout creation, Stripe webhook ingestion, and idempotent lead-to-customer conversion. The migration has been applied to hosted Supabase and validated with mock Stripe checkout only.

- Offers live at `/offers`, `/offers/[id]`, on lead detail, and from outreach detail.
- Offer creation is manual and deterministic. It does not call paid AI and does not contact a prospect.
- Checkout approval binds the exact lead, generated website, outreach record, currency, setup amount, managed monthly amount, plan selection, content version, and content hash.
- Editing approved offer terms resets approval and expires the pending approval when applicable.
- The default payment provider is mock Stripe. It creates deterministic `cs_mock_*`, `cus_mock_*`, `pi_mock_*`, and optional `sub_mock_*` identifiers without a network call.
- Live Stripe fails closed unless `STRIPE_ALLOW_LIVE_PAYMENTS=true` and server-side Stripe secrets are configured. Live checkout creation is not enabled for this milestone.
- `/api/stripe/webhook` reads the raw body, separates mock test traffic via `x-siteforge-mock-stripe: true`, and requires a valid Stripe signature for live traffic.
- `checkout.session.completed` is idempotent by Stripe event ID, updates the checkout session, creates or updates a customer, creates a managed subscription only when selected, and advances the lead to `customer`.
- No Stripe API call, real charge, production deployment, Resend call, email delivery, or paid AI/API call is part of Milestone 9.

Milestone 8 added **Sales Agent + email approval**: a manual, deterministic outreach workflow that drafts prospect email, requires human approval, uses a mock email provider, and attributes public preview activity back to the outreach record.

- Sales is available at `/agents/sales`; outreach review lives at `/outreach` and `/outreach/[id]`.
- Drafting is deterministic and `$0`; it does not call paid AI and does not invent emails, contact names, testimonials, pricing, or unsupported claims.
- Missing recipient email can still create a draft, but send approval and send execution fail closed until a valid recipient is present.
- Outreach links use `/o/[token]` with separate `sfo_` attribution tokens. The database stores only the token hash and short hint.
- M7 preview raw tokens are still never persisted, and M7 token hints are never used to reconstruct public URLs.
- Approval binds the exact recipient, subject, body, preview deployment, content version, and attribution token hash. Editing the draft resets send approval.
- The only wired email provider is the deterministic mock provider. It returns fake `msg_mock_*` IDs and performs no external network call or real delivery.
- The M8 migration was version-controlled, applied to hosted Supabase, smoke-tested, and locked in commit `42e3752c25deabe6464a318b7ae1cbbaadcf9815`.
- No Resend integration, production deployment, domain/DNS change, payment, or paid AI call is part of Milestone 8.

Milestone 7 added **Preview Deployments + Tracking**: a manual, approval-gated way to share generated Builder drafts with prospects.

- Public prospect previews use `/p/[token]` and remain separate from customer production deployments.
- Publishing a public preview requires a pending `website_deployment` approval; approving that specific request mints the public token.
- Full preview tokens are shown only immediately after approval. The database stores only a SHA-256 token hash and short token hint.
- Private Builder preview at `/websites/[id]/preview` remains authenticated and unchanged.
- Public previews render the trusted Builder `WebsiteSpec`; invalid, revoked, expired, or missing specs fail closed.
- Tracking records privacy-conscious view and CTA events with bot/device/browser classification and a daily rotating visitor key. Raw IP addresses are not stored.
- M8-ready attribution fields are present: `outreach_id`, `campaign_id`, and `attribution`.
- No production deployment, domain/DNS change, outreach email, payment, or paid AI call is part of Milestone 7.

Milestone 6 added **Builder**: a manual, auditable website-draft workflow on audited leads.

- Builder answers “what replacement website should we draft?” Auditor still answers “what is wrong with the current site?”
- Manual only (`/agents/builder` and **Build Website Draft** on lead detail). Not autonomous. Not on page load.
- Template-first, **$0** deterministic path. Paid AI is not required.
- Trusted templates: `home-services-modern`, `restaurant-modern`, `professional-services-modern`
- Structured `WebsiteSpec` (JSON data, never executable code) rendered by an allowlisted component renderer
- Factual integrity: sourced vs derived vs omitted. No invented phones, hours, menus, reviews, or testimonials
- Auditor findings map to draft fixes (viewport, CTA, services nav, menu/reservation only when evidenced)
- Internal authenticated preview at `/websites/[id]/preview`. Public prospect preview is a separate approval-gated M7 flow.
- Rebuilds insert a new `generated_websites` row. Eligible `audited` leads may advance to `website_built`
- Writes `agent_runs` / `agent_tool_calls` / `activity_events`. No page-source dumps
- Optional future AI copy must use `executeApprovedAiRun`. Builder does not import the provider
- Manager stays disabled
- No outreach, production deploy, payments, domain, or DNS

Auditor and Scout remain: manual `$0` inspection/discovery with monotonic lead status.

Demo geography (configurable, not architecture): Fort Lauderdale, Coconut Creek, Boca Raton, Pompano Beach.

**No live xAI API calls were made during Milestone 6 implementation.**

## What is mock vs real

| Area | Status |
| --- | --- |
| UI, routing, layout | Real |
| Leads, audits, websites, outreach, customers, approvals, agents | Persisted in Supabase |
| Paid-AI Approve/Reject | Persisted server-side after `requireAdminSession()` |
| Other approval types Approve/Reject | Persisted status only; side effects still not executed |
| Scout | Manual $0 catalog discovery + bounded inspection |
| Manual public prospect import | Admin-only public-data import with normalization, dedupe, SSRF URL validation when a website exists, explicit no-website marking, and manual provenance |
| Auditor | Manual $0 deterministic website audit; explicit no-website prospects are excluded |
| Builder | Manual $0 deterministic template draft; explicit no-website prospects may build from sourced lead facts and verified public enrichment without a crawled audit |
| Sales | Manual $0 deterministic outreach drafting, approval binding, mock send, guarded live-send boundary, and no-website-safe copy |
| Preview deployments | Approval-gated tokenized public previews; not production hosting |
| Other agents | Disabled |
| xAI provider layer | Implemented, mock-tested, live calls gated off |
| Supabase database | Server-side reads/writes with a secret key after admin session check |
| Vercel / Stripe APIs | Not connected |
| Resend API | Server-only provider integrated; live sends gated off unless explicitly configured |
| Authentication | Temporary single-admin env credentials. Not Supabase Auth. |
| Email sending | Mock by default; guarded Resend path plus internal/operator test only |
| Payments | M9 mock checkout workflow implemented and hosted-validated; live Stripe disabled |
| Website generation and deploy | Internal drafts only; no customer production deploy |

Restaurant Builder drafts use Restaurant Modern V2.1 behind the existing `restaurant-modern` template key. V2.1 treats dedicated structured facts as canonical: cuisine/category, rating, review count, daily hours, social profiles, menu/order/reservation links, and approved image assets are modeled separately from the public summary. Legacy combined summaries are defensively sanitized before visitor-facing rendering so labels such as `Cuisine/category:`, `Rating:`, `Review count:`, `Description:`, and `Hours:` do not leak into prospect copy. Daily hours render from structured rows when present, with legacy string hours kept only as a compatibility fallback.

Restaurant V2.1 maps verified addresses to zero-cost Google directions links using `https://www.google.com/maps/dir/?api=1&destination=...`; it does not render an unsafe iframe or use a paid Google Maps API. Verified social profiles are stored per platform and render only when operator verified and host-matched for Instagram, Facebook, TikTok, YouTube, X, or LinkedIn. Image assets must carry URL/reference, role, alt text, source type, source URL, rights status, attribution, and operator approval status. The renderer only accepts approved, rights-approved, allowlisted local restaurant assets; it does not scrape, download, rehost, ingest arbitrary remote images, or render third-party reference media. When no approved image exists, the hero uses a designed CSS fallback instead of an empty placeholder.

M9.5D also adds a provider-neutral external generated-site import path for operator-assisted design tools such as Lovable. The deterministic Builder remains available and remains the fallback; it is not replaced. External imports are admin-only, bound to one explicit lead ID, and create a new immutable `generated_websites` version with `metadata.generation_source = external_generated` plus provider metadata, a verified-facts fingerprint, static validation results, and build validation status. `/websites` exposes the operator entry point at `/websites/import-external`. The import form does not accept a SiteForge/Vercel deployment URL; that URL is generated by SiteForge only after the separate approved deployment step.

External generated source is imported as an operator-supplied bounded ZIP archive or legacy JSON source manifest and is not fetched from arbitrary remote URLs. ZIP archives are stored privately in the `external-site-artifacts` Supabase Storage bucket; `external_site_artifacts.source_manifest` stores only an immutable inventory, fingerprints, package metadata, and storage pointer. Source file contents and archive bytes are admin-only and are not mapped into public preview data. SiteForge validates archive size, expanded size, file count, source paths, file extensions, binary signatures, package scripts, dependency metadata, `.env`/secret material, private/localhost/metadata URLs, `javascript:` URLs, Stripe/payment references, dangerous inline scripts, unexpected binary content, symlinks, executables, and nested archives. Repository-only documentation/metadata such as `README.md`, `AGENTS.md`, `.gitignore`, `.prettierignore`, and `.prettierrc` may be preserved in private artifacts without becoming public output. Provider/editor leak detection remains enforced for browser-facing source and final build output. Private-network detection parses URLs and explicit host contexts instead of treating arbitrary semver-like dotted numbers as endpoints. Legacy JSON manifests remain text-only; binary assets are supported through ZIP upload.

The supported build shapes are a Vite React static app with `package.json` build script exactly `vite build`, a Lovable-style Vite/TanStack Start export with Bun lockfile and the same build script, or static source with `index.html`. Build execution is isolated in a temporary directory with a minimal environment, bounded timeout/output size, lifecycle scripts disabled, and fixed SiteForge commands: npm projects run `npm ci --ignore-scripts` plus `node node_modules/vite/bin/vite.js build`; Bun/TanStack projects run `bun install --frozen-lockfile --ignore-scripts` plus `bun run build`. Operator-supplied shell commands are never executed. Build output must contain `index.html` in an allowlisted output directory and must pass the same secret/private-network scan before deployment.

External preview deployment is a separate human-approved `website_deployment` approval action. The adapter interface supports fake/test and backend-only Vercel implementations. Production fails closed unless `SITEFORGE_EXTERNAL_PREVIEW_PROJECT_ID` and backend-only `VERCEL_TOKEN` are configured; when configured, SiteForge deploys bounded static build output to the dedicated SiteForge-generated-preview project through the Vercel REST non-Git deployment API and persists the returned deployment id and URL on `external_site_artifacts`. Provider preview URLs such as `lovable.app` are admin references only; prospect previews continue to use SiteForge opaque `/p/[token]` URLs. If an external generated version has a completed controlled Vercel deployment and then receives normal M7 public-preview approval, `/p/[token]` records the visit and redirects to the SiteForge/Vercel deployment URL. If that deployment URL is missing, failed, expired, or revoked, the public route fails closed and never falls back to `providerPreviewUrl`. Deep CTA tracking inside arbitrary external sites is not injected automatically. No customer production deployment, DNS change, email, Stripe call, paid AI call, or autonomous discovery is part of this path.

## Paid AI cost controls

### Estimated vs approved vs actual

| Amount | Meaning |
| --- | --- |
| **Estimated** | Conservative pre-run estimate from token/tool assumptions |
| **Approved maximum** | Human-authorized hard ceiling for that run |
| **Actual** | Provider-reported `cost_in_usd_ticks` after the request |

Estimator inaccuracies cannot override the approved ceiling. After execution, provider-reported cost is authoritative. Do not infer billed cost from tokens when `cost_in_usd_ticks` is present.

### Hard caps (development defaults)

Centralized in `src/lib/ai/limits.ts` and `ai_budget_limits`:

| Cap | Default |
| --- | --- |
| Global daily | $1.00 |
| Global monthly | $10.00 |
| Scout per-run | $0.25 |
| Auditor per-run | $0.10 |
| Builder per-run | $0.50 |
| Sales per-run | $0.10 |
| Manager per-run | $0.10 |

Available budget = limit − finalized actual spend − active reservations.

### Reservation model

1. Run must be `approved` with a matching approved `paid_ai_usage` approval
2. `siteforge_reserve_ai_run` takes a Postgres advisory lock, re-checks budgets, inserts a reservation, and sets the run to `running`
3. The provider is invoked (only if live inference is explicitly enabled)
4. `siteforge_finalize_ai_run` records actual ticks, releases or consumes the reservation, and marks success/failure

Two concurrent runs cannot both observe remaining budget and overspend. The lock serializes reservations.

If a process dies between reserve and finalize, the reserved row stays until an operator calls `siteforge_finalize_ai_run` or updates `ai_budget_reservations`. There is no background cleanup job in this milestone.

### Run state machine

`queued` → `draft` → `awaiting_approval` → `approved` → `running` → `succeeded` / `failed`

Also: `rejected`, `budget_blocked`, `cancelled`, plus legacy `completed`.

- `awaiting_approval`, `rejected`, and `budget_blocked` cannot execute
- `approved` may execute only after a fresh budget reservation
- `running` cannot be started again
- Terminal runs are immutable except finalize metadata

### Provider

- Server-only. `import "server-only"`
- Reads `XAI_API_KEY` only on the Next.js server
- Official endpoint: `https://api.x.ai/v1/chat/completions`
- Entry point: `executeApprovedAiRun(runId, request)` — not a generic `callXai(prompt)`
- Missing key fails closed
- SuperGrok subscription does **not** make API calls free

### Environment

`XAI_API_KEY` is **not required** until you want a live paid call. The app must not crash when it is absent.

When you are ready:

1. Create an API key in the [xAI console](https://console.x.ai)
2. Add `XAI_API_KEY` to local `.env.local` and to Vercel
3. Leave `XAI_ALLOW_LIVE_INFERENCE` unset until you explicitly approve a specific spend
4. Never paste the key into chat

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- ESLint
- npm
- Supabase (`@supabase/supabase-js`)

## Architecture

```
src/
  app/              Route pages (Server Components by default)
  app/actions/      Server actions (approval writes)
  components/       Layout, shared UI, and feature views
  data/             Supabase repositories (no raw queries in pages)
  types/            Domain types and Database types
  lib/ai/           Money, pricing, estimator, provider, execution
  lib/http/         Shared SSRF-safe fetch used by Scout and Auditor
  lib/prospects/    Manual public prospect validation and provenance helpers
  lib/scout/        Discovery, SSRF-safe inspection, scoring, dedupe
  lib/auditor/      Deterministic website audit pipeline and scoring
  lib/builder/      Deterministic template drafts and WebsiteSpec
  lib/previews/     Public preview tokens, policy, and tracking helpers
  lib/sales/        Deterministic outreach drafting, approval binding, attribution tokens
  lib/email/        Mock and guarded Resend provider, delivery policy, webhook verification
  lib/payments/     Commercial offers, checkout policy, mock Stripe provider, webhook parsing
  lib/supabase/     Server-only Supabase client
  lib/auth/         Temporary admin session
  agents/           Future agent packages (empty)
  proxy.ts          Request gate for the temporary admin session
supabase/
  migrations/       Version-controlled schema and seed SQL
```

Pages load data on the server through repositories after the SiteForge admin session is verified. The browser does not query application tables. Client Components are used only for filters, dialogs, tabs, mobile navigation, and approval forms. Approval writes go through Next.js server actions.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visits redirect to `/login`.

Create `.env.local` in the repository root (never commit this file):

```bash
SITEFORGE_ADMIN_EMAIL=your-admin-email
SITEFORGE_ADMIN_PASSWORD=your-strong-password
SITEFORGE_AUTH_SECRET=replace-with-a-long-random-value

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
XAI_API_KEY=
XAI_ALLOW_LIVE_INFERENCE=
RESEND_API_KEY=
SITEFORGE_EMAIL_FROM=
SITEFORGE_EMAIL_REPLY_TO=
SITEFORGE_ALLOW_LIVE_EMAIL=false
SITEFORGE_INTERNAL_TEST_EMAIL=
RESEND_WEBHOOK_SECRET=
```

Generate `SITEFORGE_AUTH_SECRET` with a cryptographically random value, for example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Restart `npm run dev` after changing environment variables.

```bash
npm run lint
npm test
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in values locally. Never commit real secrets. `.env*` files are gitignored except `.env.example`.

Secrets must never be prefixed with `NEXT_PUBLIC_`; Next.js bundles `NEXT_PUBLIC_*` values into browser JavaScript at build time.

### Temporary admin authentication

These three variables are required locally and in Vercel to sign in. They are server-only and must not be prefixed with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `SITEFORGE_ADMIN_EMAIL` | The single allowed admin email |
| `SITEFORGE_ADMIN_PASSWORD` | The single allowed admin password |
| `SITEFORGE_AUTH_SECRET` | HMAC secret used to sign the session cookie (at least 16 characters) |

If they are missing, the app fails closed: dashboard routes redirect to `/login`, and sign-in is rejected.

### Supabase credentials

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL. Browser-safe. Required locally and in Vercel. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key. Browser-safe. Not used for application-table access. Kept for future Supabase Auth. |
| `SUPABASE_SECRET_KEY` | Server-only `sb_secret_...` key. Required locally and in Vercel for dashboard reads and approval writes. Never prefix with `NEXT_PUBLIC_`. |

Do not configure `NEXT_PUBLIC_SUPABASE_SECRET_KEY`. A public-prefixed Supabase secret is ignored by server code and is unsafe because `NEXT_PUBLIC_*` values can be bundled for the browser.

### xAI credentials

| Variable | Purpose |
| --- | --- |
| `XAI_API_KEY` | Optional server-only key. Empty until the operator creates a key in the xAI console. |
| `XAI_ALLOW_LIVE_INFERENCE` | Live-action gate. Must be exactly `true` to allow a live paid call. Default off. |

The publishable key authenticates as the Postgres `anon` role. It cannot read application tables. Trusted server access uses the secret key (`service_role`), after `requireAdminSession()`.

Live xAI inference cannot occur merely because `XAI_API_KEY` exists. A paid AI run still requires admin session authorization, an approved budget ceiling, database reservation/finalization, and `XAI_ALLOW_LIVE_INFERENCE=true`.

### Stripe and email

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Optional server-only key for a future live Stripe provider. |
| `STRIPE_WEBHOOK_SECRET` | Optional server-only webhook signing secret. Required only for live Stripe webhook verification. |
| `STRIPE_ALLOW_LIVE_PAYMENTS` | Live-action gate. Must be exactly `true`; default off. |
| `RESEND_API_KEY` | Optional server-only Resend key. Required only for gated live email. |
| `SITEFORGE_EMAIL_FROM` | Server-only sender identity used for gated live email. |
| `SITEFORGE_EMAIL_REPLY_TO` | Server-only reply-to mailbox used for gated live prospect email. |
| `SITEFORGE_ALLOW_LIVE_EMAIL` | Live-email gate. Must be exactly `true`; default off. |
| `SITEFORGE_INTERNAL_TEST_EMAIL` | Optional allowlisted operator recipient for Settings internal test sends. Falls back to the admin email when absent. |
| `RESEND_WEBHOOK_SECRET` | Optional server-only Resend/Svix webhook signing secret. Required before accepting live Resend webhook events. |

Stripe checkout defaults to the mock provider. The live Stripe provider still fails closed in this milestone and does not create live checkout sessions. Email sending defaults to the mock provider; a Resend key alone does not enable delivery.

M9.5C real email setup, now validated by the operator-only test, requires:

1. Configure and verify the sending domain in Resend outside agent context.
2. Add the Resend key and email settings only to server-side local/Vercel environment variables.
3. Treat `SITEFORGE_ALLOW_LIVE_EMAIL=true` as necessary but insufficient for live sends.
4. Configure the Resend webhook endpoint `/api/resend/webhook` with the signing secret, then verify delivery events with live gate controls still in place.
5. Do not send prospect email until one M9.5D prospect has been manually selected, reviewed, approved, and explicitly sent.

### Vercel and future deployment automation

| Variable | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Optional server-only token for future deployment automation. Do not provide to agents or configure for autonomous M9.5A actions. |

### Vercel

Set these variables in Vercel Project → Settings → Environment Variables for **Production** and **Preview**:

- `SITEFORGE_ADMIN_EMAIL`
- `SITEFORGE_ADMIN_PASSWORD`
- `SITEFORGE_AUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `XAI_API_KEY` (only after you create a key; still not required for the dashboard)
- `XAI_ALLOW_LIVE_INFERENCE` (leave unset)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only when entering approved Stripe test/live work
- `STRIPE_ALLOW_LIVE_PAYMENTS` (leave unset)
- `RESEND_API_KEY`, `SITEFORGE_EMAIL_FROM`, `SITEFORGE_EMAIL_REPLY_TO`, `SITEFORGE_INTERNAL_TEST_EMAIL`, and `RESEND_WEBHOOK_SECRET` only for M9.5C guarded email setup
- `SITEFORGE_ALLOW_LIVE_EMAIL` only for an explicitly approved internal/operator test or later controlled prospect send
- `VERCEL_TOKEN` only when entering approved deployment automation work

Then redeploy.

Production login manual verification:

1. Visit a protected route such as `/leads` while signed out; it must redirect to `/login`.
2. Submit the configured admin email/password; it must create a secure authenticated session and redirect to `/dashboard`.
3. Use logout; the next protected route visit must redirect to `/login`.
4. Submit an invalid password; it must not create a session.

The temporary single-admin auth remains a launch bridge. Stronger production authentication is future hardening.

## Supabase setup

### Apply migrations

Schema and development seed live in:

- `supabase/migrations/20260829100000_initial_schema.sql`
- `supabase/migrations/20260829120000_seed_development_data.sql`
- `supabase/migrations/20260829180000_remove_public_read_access.sql`
- `supabase/migrations/20260829200000_paid_ai_cost_controls.sql`
- `supabase/migrations/20260829210000_scout_lead_qualification.sql`
- `supabase/migrations/20260829220000_auditor_website_audits.sql`
- `supabase/migrations/20260829230000_builder_generated_websites.sql`
- `supabase/migrations/20260830000000_preview_deployments_tracking.sql`
- `supabase/migrations/20260830230000_external_source_artifacts.sql`

Apply them to the hosted project with the Supabase CLI (after `supabase login` and `supabase link --project-ref afpjclfcajrcbpcrgzvd`):

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push --yes
```

Do not reset, reseed, or delete production rows.

### RLS / security

- Dashboard access is protected by temporary SiteForge admin auth (signed HttpOnly cookie).
- Application database reads and writes happen only on the Next.js server, after `requireAdminSession()`.
- Public publishable credentials cannot SELECT or write application tables.
- RLS remains enabled on every application table.
- `anon` and `authenticated` have no table grants or policies for application data.
- Public preview routes do not use browser Supabase credentials; they resolve active previews server-side by hashed token only.
- Budget RPCs are invoker-rights, execute revoked from `anon`/`authenticated`/`public`, granted to `service_role` only.
- Future agents must go through this same server access layer and must not hold `SUPABASE_SECRET_KEY` or `XAI_API_KEY`.

## Roadmap

1. **Milestone 1** — Application foundation
2. **Milestone 2** — Supabase database + persistent application state
3. **Milestone 3** — xAI integration + strict cost controls
4. **Milestone 4** — Scout Agent
5. **Milestone 5** — Auditor Agent
6. **Milestone 6** — Builder Agent (this repo)
7. **Milestone 7** — Preview deployments (this repo)
8. **Milestone 8** — Sales Agent + email approval
9. **Milestone 9** — Stripe payments
10. **Milestone 10** — Manager Agent + customer operations
