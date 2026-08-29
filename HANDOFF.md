# SiteForge Handoff

For the next session. Milestone 6 Builder is complete and committed. Do not start Milestone 7 unless explicitly asked.

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
- No public prospect deployments
- No email
- No payments
- No domain/DNS automation
- Supabase public application-table access remains revoked

## Next Milestone

Milestone 7: Preview Deployments

Milestone 7 is a new external-side-effect boundary.

Important requirements for future M7:

- Do not automatically deploy every generated website
- Public/shareable preview deployment requires explicit human approval
- Internal Builder preview remains private
- No customer production/domain deployment yet
- Preview deployment must be separate from customer production deployment
- Preserve immutable build/version provenance
- Record deployment action in agent/tool/audit logs
- Enforce deployment allowlists
- Agents must not receive broad Vercel credentials directly
- Backend-controlled deployment tooling only
- No domain purchase
- No DNS changes
- No email
- No payment
- No paid AI required just to deploy an existing deterministic draft
