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

Scout, Auditor, and Builder can run **manually**. Sales and Manager stay disabled. Placeholder directories live in `src/agents`.

## Human approval philosophy

- **Read actions** can generally operate autonomously in the future (public research, inspecting a public site, reading internal records).
- **Internal writes** may operate autonomously depending on scope (create a lead, save an audit, store a draft).
- **External side effects require human approval initially**: sending email, production deploys, customer site changes, charges, refunds, DNS changes, deleting production resources, and **paid AI usage**.

Agents never hold privileged infrastructure credentials, including `XAI_API_KEY` and `SUPABASE_SECRET_KEY`. They request actions through backend-controlled tools that validate input, check approval, execute with server credentials, and log the result.

## Current milestone

Milestone 7 adds **Preview Deployments + Tracking**: a manual, approval-gated way to share generated Builder drafts with prospects.

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
- Sales and Manager stay disabled
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
| Auditor | Manual $0 deterministic website audit |
| Builder | Manual $0 deterministic template draft |
| Preview deployments | Approval-gated tokenized public previews; not production hosting |
| Other agents | Disabled |
| xAI provider layer | Implemented, mock-tested, live calls gated off |
| Supabase database | Server-side reads/writes with a secret key after admin session check |
| Vercel / Resend / Stripe APIs | Not connected |
| Authentication | Temporary single-admin env credentials. Not Supabase Auth. |
| Email sending | Not implemented |
| Payments | Not implemented |
| Website generation and deploy | Internal drafts only; no customer production deploy |

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
  lib/scout/        Discovery, SSRF-safe inspection, scoring, dedupe
  lib/auditor/      Deterministic website audit pipeline and scoring
  lib/builder/      Deterministic template drafts and WebsiteSpec
  lib/previews/     Public preview tokens, policy, and tracking helpers
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

### Temporary admin authentication

These three variables are required to sign in. They are server-only and must not be prefixed with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `SITEFORGE_ADMIN_EMAIL` | The single allowed admin email |
| `SITEFORGE_ADMIN_PASSWORD` | The single allowed admin password |
| `SITEFORGE_AUTH_SECRET` | HMAC secret used to sign the session cookie (at least 16 characters) |

If they are missing, the app fails closed: dashboard routes redirect to `/login`, and sign-in is rejected.

### Supabase credentials

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL. Public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key. Not used for application-table access. Kept for future Supabase Auth. |
| `SUPABASE_SECRET_KEY` | Server-only `sb_secret_...` key. Required for dashboard reads and approval writes. Never prefix with `NEXT_PUBLIC_`. |

### xAI credentials

| Variable | Purpose |
| --- | --- |
| `XAI_API_KEY` | Server-only. Empty until you create a key in the xAI console. |
| `XAI_ALLOW_LIVE_INFERENCE` | Must be exactly `true` to allow a live paid call. Default off. |

The publishable key authenticates as the Postgres `anon` role. It cannot read application tables. Trusted server access uses the secret key (`service_role`), after `requireAdminSession()`.

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

Then redeploy.

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
