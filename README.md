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

Milestone 1 is the dashboard foundation:

- Next.js App Router application shell
- Dark-first operations UI
- Navigation for the full future workflow
- Centralized domain types and mock data
- No API keys required
- No scraping, email, payments, deployments, or live agents

Everything you see in the UI is fictional sample data, including South Florida businesses. Those businesses are not real.

## What is mock vs real

| Area | Status |
| --- | --- |
| UI, routing, layout | Real |
| Leads, audits, websites, outreach, customers | Mock |
| Approvals queue | Mock, local UI state only |
| Agent cards and permissions | Documented, not implemented |
| Supabase / xAI / Vercel / Resend / Stripe | Not connected |
| Authentication | Not implemented |
| Email sending | Not implemented |
| Payments | Not implemented |
| Website generation and deploy | Not implemented |

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- ESLint
- npm

The only extra runtime dependency beyond the Next.js starter is `lucide-react` for navigation icons.

## Architecture

```
src/
  app/           Route pages (Server Components by default)
  components/    Layout, shared UI, and feature views
  data/          Centralized mock datasets and lookups
  types/         Domain types
  lib/           Formatting, labels, class helpers, policy copy
  agents/        Future agent packages (empty in Milestone 1)
```

Pages load mock data on the server where possible. Client Components are used only for filters, dialogs, tabs, mobile navigation, and local-only approval actions.

This layout is intended to swap mock lookups for Supabase queries in Milestone 2 without rewriting the UI.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required.

```bash
npm run lint
npm run build
```

## Environment variables

Copy `.env.example` if you want a local env file. Values are placeholders for later milestones. The app does not read them in Milestone 1.

Never commit real secrets. `.env*` files are gitignored except `.env.example`.

## Roadmap

1. **Milestone 1** — Application foundation (this repo)
2. **Milestone 2** — Supabase database + authentication + persistent application state
3. **Milestone 3** — xAI integration
4. **Milestone 4** — Scout Agent
5. **Milestone 5** — Auditor Agent
6. **Milestone 6** — Builder Agent
7. **Milestone 7** — Preview deployments
8. **Milestone 8** — Sales Agent + email approval
9. **Milestone 9** — Stripe payments
10. **Milestone 10** — Manager Agent + customer operations
