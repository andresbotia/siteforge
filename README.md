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
| Supabase database | Connected via publishable key (read-only) |
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
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)

## Architecture

```
src/
  app/              Route pages (Server Components by default)
  components/       Layout, shared UI, and feature views
  data/             Supabase repositories (no raw queries in pages)
  types/            Domain types and Database types
  lib/supabase/     Browser and server clients
  lib/auth/         Temporary admin session
  lib/cost/         Paid-AI spend control types
  agents/           Future agent packages (empty)
  proxy.ts          Request gate for the temporary admin session
supabase/
  migrations/       Version-controlled schema and seed SQL
```

Pages load data on the server through repositories. Client Components are used only for filters, dialogs, tabs, mobile navigation, and local-only approval actions.

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

### Supabase public credentials

These are browser-safe project credentials. Do not add a secret or service-role key.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key used for read-only Data API access |

If they are missing, dashboard pages render empty states instead of crashing.

### Vercel

Set these variables in Vercel Project → Settings → Environment Variables for **Production** and **Preview**:

- `SITEFORGE_ADMIN_EMAIL`
- `SITEFORGE_ADMIN_PASSWORD`
- `SITEFORGE_AUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Then redeploy.

## Supabase setup

### Apply migrations

Schema and development seed live in:

- `supabase/migrations/20260829100000_initial_schema.sql`
- `supabase/migrations/20260829120000_seed_development_data.sql`

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

- RLS is enabled on every application table.
- `anon` and `authenticated` may **SELECT** only.
- There are no insert/update/delete policies.
- The app does not use a service-role key.
- Approve/Reject and other mutations stay UI-only.

Because SiteForge still uses custom admin cookies instead of Supabase Auth, SELECT is granted to the publishable key so the dashboard can read. That means anyone who has the publishable key can also query these tables through the Data API until Supabase Auth is added. Writes remain blocked.

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
