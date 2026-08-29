# SiteForge

SiteForge is an AI-assisted website operations platform for a local-business website agency.

The product finds strong local businesses with weak websites, generates a better site, requires a human to approve anything that leaves the system, then sells, deploys, and optionally manages the site.

This repository currently contains **Milestone 1**: a production-quality application shell with mock data. No external integrations are connected.

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

None of these agents are implemented yet. Placeholder directories live in `src/agents`.

## Human approval philosophy

- **Read actions** can generally operate autonomously in the future (public research, inspecting a public site, reading internal records).
- **Internal writes** may operate autonomously depending on scope (create a lead, save an audit, store a draft).
- **External side effects require human approval initially**: sending email, production deploys, customer site changes, charges, refunds, DNS changes, and deleting production resources.

Agents will never hold privileged infrastructure credentials. They will request actions through backend-controlled tools that validate input, check approval, execute with server credentials, and log the result.

## Current milestone

Milestone 2 is the persistent application data layer:

- Existing dashboard shell and temporary admin login are unchanged
- Supabase holds leads, audits, websites, approvals, agents, outreach, customers, and activity
- Dashboard pages read through `src/data` repositories
- Agents remain disabled and are not executing
- xAI, Resend, Stripe, and Vercel APIs are not connected

Sample records are fictional South Florida businesses. They are not real companies.

## What is mock vs real

| Area | Status |
| --- | --- |
| UI, routing, layout | Real |
| Leads, audits, websites, outreach, customers, approvals, agents | Persisted in Supabase |
| Approval Approve/Reject buttons | Local UI state only; no database writes |
| Agent execution | Not implemented |
| Supabase database | Server-side reads with a secret key after admin session check |
| xAI / Vercel / Resend / Stripe APIs | Not connected |
| Authentication | Temporary single-admin env credentials. Not Supabase Auth. |
| Email sending | Not implemented |
| Payments | Not implemented |
| Website generation and deploy | Not implemented |

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
  components/       Layout, shared UI, and feature views
  data/             Supabase repositories (no raw queries in pages)
  types/            Domain types and Database types
  lib/supabase/     Server-only Supabase client
  lib/auth/         Temporary admin session
  lib/cost/         Paid-AI spend control types
  agents/           Future agent packages (empty)
  proxy.ts          Request gate for the temporary admin session
supabase/
  migrations/       Version-controlled schema and seed SQL
```

Pages load data on the server through repositories after the SiteForge admin session is verified. The browser does not query application tables. Client Components are used only for filters, dialogs, tabs, mobile navigation, and local-only approval actions.

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
```

Generate `SITEFORGE_AUTH_SECRET` with a cryptographically random value, for example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Restart `npm run dev` after changing environment variables.

```bash
npm run lint
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

If they are missing, the app fails closed: dashboard routes redirect to `/login`, and sign-in is rejected. Production must not be left publicly reachable because these values were omitted.

This login is still temporary. Milestone 2 does **not** add Supabase Auth.

### Supabase credentials

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL. Public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key. Not used for application-table access. Kept for future Supabase Auth. |
| `SUPABASE_SECRET_KEY` | Server-only `sb_secret_...` key. Required for dashboard reads. Never prefix with `NEXT_PUBLIC_`. |

The publishable key authenticates as the Postgres `anon` role. After public SELECT was removed, it cannot read application tables. Trusted server reads use the secret key, which maps to `service_role` and bypasses RLS. SiteForge still checks the admin session before every repository read, so the secret key is never a public backdoor.

Copy the secret from **Project Settings → API Keys → Secret keys**. Do not commit it.

If `SUPABASE_SECRET_KEY` is missing, authenticated dashboard pages render empty rather than falling back to the publishable key.

### Vercel

Set these variables in Vercel Project → Settings → Environment Variables for **Production** and **Preview**:

- `SITEFORGE_ADMIN_EMAIL`
- `SITEFORGE_ADMIN_PASSWORD`
- `SITEFORGE_AUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Then redeploy. Apply `supabase/migrations/20260829180000_remove_public_read_access.sql` only after `SUPABASE_SECRET_KEY` is set in Vercel, or the live dashboard will lose its data reads.

## Supabase setup

### Apply migrations

Schema and development seed live in:

- `supabase/migrations/20260829100000_initial_schema.sql`
- `supabase/migrations/20260829120000_seed_development_data.sql`
- `supabase/migrations/20260829180000_remove_public_read_access.sql`

Apply them to the hosted project with the Supabase CLI (after `supabase login` and `supabase link --project-ref afpjclfcajrcbpcrgzvd`):

```bash
npx supabase db push
```

Or paste both SQL files, in order, into the Supabase Dashboard SQL editor.

Local workflow:

```bash
npx supabase start
npx supabase db reset
```

`db reset` applies versioned migrations. `supabase/seed.sql` is empty so seed rows are not inserted twice.

### RLS / security

- Dashboard access is protected by temporary SiteForge admin auth (signed HttpOnly cookie).
- Application database reads happen only on the Next.js server, after `requireAdminSession()`.
- Public publishable credentials cannot SELECT application tables.
- RLS remains enabled on every application table.
- `anon` and `authenticated` have no table grants or policies for application data.
- There are no public writes. Approve/Reject stays UI-only.
- Supabase Auth is still deferred.
- Future agents must go through this same server access layer and must not hold `SUPABASE_SECRET_KEY`.

### Cost control foundation

`src/lib/cost/types.ts` defines estimated, approved-limit, and actual cost fields plus `paid_ai_usage`. No agent may incur unapproved paid cost later. xAI is not called yet.

## Roadmap

1. **Milestone 1** — Application foundation
2. **Milestone 2** — Supabase database + persistent application state (this repo; auth is still the temporary admin login)
3. **Milestone 3** — xAI integration
4. **Milestone 4** — Scout Agent
5. **Milestone 5** — Auditor Agent
6. **Milestone 6** — Builder Agent
7. **Milestone 7** — Preview deployments
8. **Milestone 8** — Sales Agent + email approval
9. **Milestone 9** — Stripe payments
10. **Milestone 10** — Manager Agent + customer operations
