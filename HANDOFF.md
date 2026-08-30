# SiteForge Handoff

For the next session. Milestone 7 Preview Deployments + Tracking is COMPLETE and HOSTED-VALIDATED. The schema migration is applied remotely, approval gates and tokenized public previews were validated end-to-end against the Atlantic Drain artifact, tracking and revocation were verified in hosted Supabase, and full test/lint/build regressions passed.

## Project

- SiteForge: AI-assisted local-business website operations
- Next.js App Router, TypeScript, Tailwind
- Supabase with server-only `SUPABASE_SECRET_KEY`, RLS on, and no anon/authenticated table grants
- Vercel production admin app deployment
- Temporary single-admin cookie auth (`SITEFORGE_ADMIN_*`)
- xAI provider infrastructure exists; live inference remains disabled (`XAI_ALLOW_LIVE_INFERENCE` not `true`)

Repo: `https://github.com/andresbotia/siteforge`
Branch: `main`

## Completed

| Milestone | SHA | Notes |
| --- | --- | --- |
| 1 Application foundation | `1801f1df8f6feb9ad05e7107f10104b8c3b5a1f2` | Dashboard shell |
| Temporary admin auth | `1d902ea5cb830b228bc352e49bb7b45b7a11d6ba` | HttpOnly session cookie |
| 2 Supabase persistence | `c2c04f4bb8e470ff6a30208c6e3a1e564dd1f899` | Seeded fictional South Florida data |
| 2.1 Security hardening | `6fa4d85bdb8cd985df8f7f979aaa6690cc2ce172` | Revoke public table reads |
| 3 Paid-AI approval/cost controls | `48c703baeb7e263b6bad21816dcc1495baa63947` | Approval + tick accounting + reservations |
| 4 Scout | `7eeef31386d07af0d88493b1eb7b7543c3cd7b8b` | Manual $0 lead discovery |
| 5 Auditor | `68ad58761ca00863970c9cd650e4f66a431532df` | Manual $0 deterministic website audit |
| 6 Builder | `cf7f1c59f4924202cdfab0b55720299521e95557` | Manual $0 deterministic website drafts |
| 7 Preview deployments | `35957d501faf6f6d4272d93b4be75298c176ae30` | Hosted migration applied, smoke-tested, and validated |

## Milestone 7 Summary

- Adds migration `20260830000000_preview_deployments_tracking.sql` (applied remotely)
- Tables: `preview_deployments`, `preview_events` with RLS enabled and `anon`/`authenticated`/`public` access revoked
- Public preview publishing requires explicit `website_deployment` approval
- Approval execution mints a one-time visible `sfp_` token; only SHA-256 hash and token hint are stored
- Public route `/p/[token]` renders trusted Builder specs without admin chrome (`robots: noindex, nofollow`)
- Invalid, expired, revoked, or missing-token previews return 404 (safe fail-closed)
- `/api/preview-events` accepts bounded beacon events and returns 204 without leaking token validity
- View and CTA events classify likely humans, bots, browser, and device
- Visitor keys are preview-scoped and daily rotating; raw IP is never persisted
- Admin website detail shows preview status, token hint, analytics, request approval, and revoke controls
- Internal preview `/websites/[id]/preview` remains authenticated
- TypeScript passed: `npx tsc --noEmit`
- Lint passed: `npm run lint`
- Tests passed: 134/134 (`npm test`)
- Production build passed: `npm run build`
- No production deployment, email, DNS/domain, payments, or paid AI/API calls were added ($0.00 cost)

### Milestone 7 Hosted Smoke Test Validation

- Lead: `ee0aa3e0-78f9-478a-bdba-f5db6e7db1d3` / Atlantic Drain Plumbing
- Website: `29ca4d70-a474-44d0-8470-347adba511bc`
- Source audit: `d1c6b82e-2d85-43b1-952c-ccd32affc4a9`
- Builder run: `f831dfde-9312-422c-be3d-a2f4ad15f34c`
- Approval request: `91cb4e0c-8257-487f-9ebd-6182b047faa7` (`website_deployment`, status `pending` -> `executed`)
- Preview deployment: `d20631cc-3963-4625-b151-ca2fb673542f` (status `active` -> `revoked`)
- Token Hint: `KY0rJhyc` (SHA-256 hash stored, raw token not persisted)
- Public route resolution: Active token resolved HTTP 200 with structured `WebsiteSpec`
- Tracking validation: 2 views (human-likely, desktop, chrome) + 1 CTA click (`phone_cta_clicked`). Coarse geo parsing was validated using synthetic request headers. No paid geo service or browser geolocation was used. Real deployed requests may provide platform-derived coarse geo or null values.
- Daily pseudonym: `visitor_key` matched across repeat visits without storing raw IP
- Aggregated analytics verified: 3 total events, 2 human views, 1 CTA click, 1 unique visitor
- Revocation verified: Deployment status `revoked`, `revoked_at` set, public token immediately returns 404 (fails closed)
- Historical events preserved: 3 `preview_events` remain intact post-revocation
- Production isolation: `generated_websites.production_url` remained `null` throughout
- Final smoke preview state: **REVOKED**

M8 must connect outreach emails to unique tracked preview links so SiteForge can measure the funnel:

sent -> delivered -> opened (low-confidence) -> preview clicked/viewed -> return visit -> CTA interaction -> replied -> interested -> customer

Preview analytics should continue to support approximate location, approximate visitors/repeat visits, likely-human vs likely-bot/scanner activity, and attribution to the outreach link. Do not store raw IP addresses long term.

## Milestone 6 Summary

- Deterministic/manual Builder
- $0 build path
- No xAI required
- Template-first architecture
- `WebsiteSpec` structured trusted data
- No arbitrary executable JSX/JS/HTML
- Allowlisted templates: `home-services-modern`, `restaurant-modern`, `professional-services-modern`
- Factual integrity and provenance
- Provenance states: `sourced`, `derived`, `placeholder`, `omitted`
- Auditor findings mapped to Builder fixes
- Trusted renderer validates persisted specs before rendering
- Internal authenticated preview only
- No public prospect preview yet
- Insert-only generated website history
- Monotonic `audited` to `website_built` progression
- `agent_runs` / `agent_tool_calls` audit trail
- Migration `20260829230000_builder_generated_websites.sql` applied remotely
- Authenticated Builder smoke test completed

Builder smoke artifact:

- Lead: `ee0aa3e0-78f9-478a-bdba-f5db6e7db1d3` / Atlantic Drain Plumbing
- Source audit: `d1c6b82e-2d85-43b1-952c-ccd32affc4a9`
- Builder run: `f831dfde-9312-422c-be3d-a2f4ad15f34c`
- Generated website: `29ca4d70-a474-44d0-8470-347adba511bc`
- Template: `home-services-modern`
- Build version: `builder.v1`
- `production_url`: `null`

Validation:

- `WebsiteSpec` passed trusted validation
- Factual-integrity verification passed
- Internal preview verified
- Preview remains behind admin auth
- 124 tests passed
- Zero paid AI/API calls
- Zero external monetary cost

## Current Safety State

- `XAI_ALLOW_LIVE_INFERENCE` remains disabled
- Scout deterministic path remains $0
- Auditor deterministic path remains $0
- Builder deterministic path remains $0
- Public prospect previews exist only after human approval and only as tokenized previews
- No email
- No payments
- No domain/DNS automation
- Supabase public application-table access remains revoked

## Next Milestone

Milestone 8: Sales Agent + email approval. Do not start it unless explicitly asked.
