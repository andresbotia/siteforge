# SiteForge handoff

For the next Grok session. Do not implement Milestone 5 until explicitly asked.

## Project

- **SiteForge** — AI-assisted local-business website operations
- Next.js App Router, TypeScript, Tailwind
- Supabase (server-only `SUPABASE_SECRET_KEY`, RLS on, no anon/authenticated table grants)
- Vercel
- Temporary single-admin cookie auth (`SITEFORGE_ADMIN_*`)
- xAI provider infrastructure exists; **live inference remains disabled** (`XAI_ALLOW_LIVE_INFERENCE` not `true`)

Repo: `https://github.com/andresbotia/siteforge`  
Branch: `main`

## Completed

| Milestone | SHA | Notes |
| --- | --- | --- |
| 1 Application foundation | `1801f1df8f6feb9ad05e7107f10104b8c3b5a1f2` | Dashboard shell |
| Temporary admin auth | `1d902ea5cb830b228bc352e49bb7b45b7a11d6ba` | HttpOnly session cookie |
| 2 Supabase persistence | `c2c04f4bb8e470ff6a30208c6e3a1e564dd1f899` | Seeded fictional South Florida data |
| 2.1 Security hardening | `6fa4d85bdb8cd985df8f7f979aaa6690cc2ce172` | Revoke public table reads |
| 3 Paid-AI cost controls | `48c703baeb7e263b6bad21816dcc1495baa63947` | Approval + tick accounting + reservations |
| **4 Scout** | **`7eeef31386d07af0d88493b1eb7b7543c3cd7b8b`** | Manual $0 lead discovery |

## Milestone 4 summary

- Manual Scout only (`/agents/scout`). Not autonomous.
- `BusinessDiscoveryProvider` abstraction in `src/lib/scout/discovery.ts`
- Connected provider: **`mock_catalog`**, **$0**
- Stages: discovery → normalization → inspection → qualification → persistence
- Bounded SSRF-safe website inspector (`src/lib/scout/ssrf.ts`, `inspector.ts`)
- Deterministic scoring (`business_strength_score`, `website_opportunity_score`, overall + tier)
- Restaurant-aware scoring (menu/reservation/order; no food-quality judgment)
- Dedupe by domain, then phone, then name+city
- **Monotonic lead status** (`src/lib/scout/status.ts`): never regress `qualified` → `discovered`
- Audit: `agent_runs` + `agent_tool_calls` (discover / inspect / qualify)
- UI: Scout run form/results; Leads filters and qualification on lead detail
- Migration `20260829210000_scout_lead_qualification.sql` **applied remotely**
- Authenticated local smoke tests completed (Fort Lauderdale / Plumbers / limit 3, twice)
- Hosted lead count after smoke testing: **16**

## Safety state

- Agents are not autonomously executing. Auditor / Builder / Sales / Manager remain disabled.
- Scout does **not** require `XAI_API_KEY`
- `XAI_ALLOW_LIVE_INFERENCE` remains off
- Zero paid xAI calls during M4
- Zero paid discovery API calls (`mock_catalog` only)
- No email sending, customer deploys, or payments
- Paid AI must use `executeApprovedAiRun` and Milestone 3 reservation RPCs
- `anon` / `authenticated` / `public` have no application-table grants; RLS stays enabled

## Current cost limits (development defaults)

- Daily **$1.00**
- Monthly **$10.00**
- Per-run ceilings: Scout **$0.25**, Auditor **$0.10**, Builder **$0.50**, Sales **$0.10**, Manager **$0.10**

Scout basic runs do not spend against these; discovery cost is **$0.00**.

## Next milestone

**Milestone 5: Auditor**

Auditor should consume qualified/reviewable Scout leads and perform deeper, deterministic website audits before any optional AI enrichment.

Do **not** connect paid discovery or AI without explicit cost approval.  
Do **not** bypass Milestone 3.  
Do **not** scrape, email, deploy, or process payments unless that milestone asks.
