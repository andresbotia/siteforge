# SiteForge handoff

For the next Grok session. Do not implement Milestone 6 until explicitly asked.

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
| 4 Scout | `7eeef31386d07af0d88493b1eb7b7543c3cd7b8b` | Manual $0 lead discovery |
| Handoff for Auditor | `0cb19d431ff1e0bd388bd367324b365127a0f2a8` | Project handoff |
| **5 Auditor** | **`68ad58761ca00863970c9cd650e4f66a431532df`** | Manual $0 deterministic website audit |

## Milestone 5 summary

- Manual deterministic Auditor (`/agents/auditor`, lead-detail **Run Website Audit**, `/audits/[id]`). Not autonomous. Not on page load.
- **$0** execution path. Paid AI is not required. No xAI call.
- Shared SSRF-safe HTTP stack in `src/lib/http` (Scout and Auditor). No second fetch implementation.
- Bounded website crawl: homepage + up to 5 internal pages, timeout/redirect/size/link caps
- Finding categories: technical, SEO, UX/conversion, content
- Structured evidence (no raw HTML blobs)
- Deterministic quality scores: 100 = healthy / strong, 0 = severely deficient
- `redesign_opportunity_score`: 100 = strong redesign candidate
- Restaurant-specific checks (menu/PDF/hours/phone; reservation/order only if offered)
- Home-service checks (phone/CTA, services, service area; emergency CTA only if claimed)
- Immutable `website_audits` history (insert-only; later runs do not overwrite)
- Monotonic lead progression: eligible `discovered`/`qualified` may become `audited`; later statuses never regress
- `agent_runs` / `agent_tool_calls` audit trail (validate → inspect → score → persist)
- Dashboard surfaces: `/agents/auditor`, `/audits/[id]`, lead-detail latest audit
- Migration `20260829220000_auditor_website_audits.sql` **applied remotely**
- Authenticated fixture-backed smoke test completed (local production server)
- Smoke-test Auditor run: `721f46ef-2f7a-4399-8310-3e42ae3157f1`
- Smoke-test audit: `d1c6b82e-2d85-43b1-952c-ccd32affc4a9`
- Smoke target: Atlantic Drain Plumbing (`https://atlanticdrain.example.test`)
- Zero public HTTP requests during validation
- Zero external monetary cost

## Current security / cost state

- Agents are not autonomously executing. Builder / Sales / Manager remain disabled.
- Scout discovery provider remains **`mock_catalog`**, **$0**
- Auditor deterministic path remains **$0**
- Auditor does **not** require `XAI_API_KEY`
- `XAI_ALLOW_LIVE_INFERENCE` remains off
- No paid AI has been used
- `anon` / `authenticated` / `public` have no application-table grants; RLS stays enabled
- External side effects still require explicit control
- No email sending, customer deployments, or payments
- Paid AI must use `executeApprovedAiRun` and Milestone 3 reservation RPCs

## Current cost limits (development defaults)

- Daily **$1.00**
- Monthly **$10.00**
- Per-run ceilings: Scout **$0.25**, Auditor **$0.10**, Builder **$0.50**, Sales **$0.10**, Manager **$0.10**

Scout and Auditor basic runs do not spend against these.

## Next milestone

**Milestone 6: Builder**

Builder must consume a lead plus the latest website audit and produce a replacement website draft/preview artifact.

Important constraints:

- Builder must not deploy to production automatically
- Production deployment requires human approval
- Builder must not purchase domains
- Builder must not send outreach
- Builder must not process payments
- Initial Builder should prefer reusable templates/components over arbitrary from-scratch site generation
- A deterministic/template path should be explored before paid AI
- Any paid AI must go through Milestone 3 approval/reservation controls
- Do not enable `XAI_ALLOW_LIVE_INFERENCE` without explicit approval

Do **not** connect paid discovery or AI without explicit cost approval.  
Do **not** bypass Milestone 3.  
Do **not** scrape, email, deploy, or process payments unless that milestone asks.
