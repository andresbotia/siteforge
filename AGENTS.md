<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SiteForge agent rules

These rules apply to every coding agent working in this repository.

1. Inspect the existing implementation before modifying anything.
2. Preserve established patterns unless there is a strong reason to change them.
3. Use TypeScript strictly.
4. Do not introduce unnecessary dependencies.
5. Keep business logic outside presentation components.
6. Never expose server secrets to Client Components.
7. Never commit credentials.
8. AI agents must never directly possess privileged infrastructure credentials.
9. Privileged actions must go through backend-controlled tools.
10. External side effects require approval initially.

Examples of privileged / approval-gated actions:

- sending external email
- production website deployment
- customer website modification
- charges
- refunds
- destructive infrastructure changes
- paid AI usage (requires an explicit dollar ceiling)

11. Read-only research actions may eventually be autonomous.
12. Internal database writes may eventually be autonomous depending on scope.
13. Every future agent action should be auditable.
14. Agent runs should eventually track input, output, tool usage, result, status, duration, and cost.
15. Prefer reversible actions.
16. Validate all external tool inputs.
17. Never trust model output without schema validation.
18. Never let agents dynamically construct unrestricted database queries.
19. Use least-privilege permissions.
20. Avoid giant monolithic files.
21. Reuse components when sensible.
22. Maintain responsive behavior.
23. Maintain accessibility.
24. Run lint before considering work complete.
25. Run production build before considering work complete.
26. Update README when architecture changes.
27. Do not silently expand project scope.
28. Do not autonomously push commits or deploy production resources unless explicitly instructed.

## Milestone boundary

The current milestone is **M10 — Operator Console**: a navigation and information-architecture pass. Primary navigation collapses to five items (Today, Pipeline, Customers, Roadmap, Settings); `/leads/[id]` becomes the single end-to-end unit of work for a business; a new `work_items` table plus a `/today` queue surface what needs operator attention, ordered by proximity to revenue. M10 changes structure only — no color system, typography, or component restyle (that is M10.5). It adds no background workers or schedulers; work items are created and resolved by the same server-side code paths that already change state.

Everything through M9.9 remains mandatory: M9 Stripe Checkout / approval binding / webhook ingestion / customer conversion; M9.5 real-prospect preparation (manual public prospect import, Auditor calibration, guarded Resend path, external generated-site import, the Designer Job worker track); M9.6 real test/live Stripe provider (mode derived from the key prefix); M9.7 customer purchase links (`sfb_` tokens, hash + hint only); M9.8 payment provenance (mock/test/live never shown as real revenue); M9.9 lead lifecycle transition table + `follow_up` outreach kind + offer amount lock. M8 Sales, M7 Preview, M6 Builder, M5 Auditor, M4 Scout, and M3 paid-AI gates all still apply. Temporary single-admin cookie auth remains in `src/lib/auth` and `src/proxy.ts`.

- Database migrations must be version-controlled under `supabase/migrations`.
- Never expose privileged credentials client-side. Never put `SUPABASE_SECRET_KEY` or `XAI_API_KEY` in `NEXT_PUBLIC_*` or Client Components.
- Application table reads and writes must go through `src/data` repositories or narrow server actions after `requireAdminSession()`.
- Do not grant `anon` or `authenticated` access on application tables.
- Never disable RLS merely to make development easier.
- External side effects require approvals.
- **No paid AI call can occur without an approved dollar budget.** Enforcement is in Postgres reservations + `executeApprovedAiRun`, not UI copy.
- Agents never receive `XAI_API_KEY`. Only `src/lib/ai/provider.ts` may read it.
- Estimated cost is advisory. Approved maximum is the hard ceiling. Provider `cost_in_usd_ticks` is the actual billed cost.
- Daily and monthly hard caps plus per-run ceilings live in `src/lib/ai/limits.ts` and `ai_budget_limits`. Do not scatter magic numbers.
- Money is integer ticks (1 USD = 10_000_000_000). Do not use floats as the authoritative representation.
- Do not make live xAI calls unless the user explicitly approves that exact spend and `XAI_ALLOW_LIVE_INFERENCE=true`.
- Tests must use the mock provider.

- Scout may research public data only. No CAPTCHA bypass, no private content, no mass scraping.
- Scout website fetches must pass SSRF checks (http/https only; no localhost/private/metadata).
- Scout qualification is deterministic. Do not let an LLM author the official score.
- Scout must not call `executeApprovedAiRun` or `createLiveXaiProvider` directly.
- Basic Scout runs do not require paid AI.
- Auditor inspects existing leads only. It does not discover businesses, generate websites, or contact them.
- Auditor website fetches must reuse the shared SSRF-safe HTTP client (http/https only; no localhost/private/metadata).
- Auditor scoring is deterministic. Do not let an LLM author official quality or redesign-opportunity scores.
- Auditor must not call `executeApprovedAiRun` or `createLiveXaiProvider` directly.
- Basic Auditor runs do not require paid AI and must remain $0.
- Builder consumes audited leads and produces internal drafts only. It does not deploy, email, buy domains, or contact businesses.
- Builder drafts are structured WebsiteSpec data rendered by a trusted allowlisted template system. Do not eval or store executable code in the database.
- Builder scoring/spec composition is deterministic. Do not let an LLM author official specs in this milestone.
- Builder must not call `executeApprovedAiRun` or `createLiveXaiProvider` directly.
- Basic Builder runs do not require paid AI and must remain $0.
- Sales creates deterministic outreach drafts only, with backend approval binding before send execution.
- Sales must not call `executeApprovedAiRun` or `createLiveXaiProvider` directly.
- Basic Sales runs do not require paid AI and must remain $0.
- Sales must not invent recipient emails, contact names, testimonials, pricing, or unsupported claims.
- Outreach attribution must use separate opaque tokens from M7 preview tokens. Store only hash plus hint; never reconstruct M7 preview URLs from token hints.
- Send approval must bind exact recipient, subject, body, preview deployment, content version, and attribution token hash. Edits must invalidate approval.
- Email execution is mock-only by default. The guarded Resend path (M9.5C) stays gated off unless `SITEFORGE_ALLOW_LIVE_EMAIL=true` plus server secrets are configured and the exact send is approved. Do not send real prospect email.
- Payments use the mock Stripe provider by default. Do not call live Stripe unless a later approval explicitly sets `STRIPE_ALLOW_LIVE_PAYMENTS=true`, configures Stripe server secrets, and approves the exact action.
- Checkout approvals must bind the exact offer amount, currency, plan selection, website, outreach, content version, and content hash. Material offer edits must invalidate approval.
- Offer amounts are selected from the two configured plans (`src/lib/payments/plans.ts`), never typed as a free cent amount; the `LiveStripeProvider` price lock stays untouched as the last checkpoint.
- Purchase links (`sfb_`) and follow-up outreach (`follow_up` kind) reuse the existing approval / suppression / duplicate-send / provider machinery. A follow-up approval additionally binds the commercial offer id and the purchase token hash; editing any bound field invalidates it.
- Stripe webhook handling must be idempotent by provider event ID and must not create duplicate customers or subscriptions for the same completed checkout.
- Lead status transitions go through the one table in `src/lib/leads/lifecycle.ts`. `archived` requires a reason; `archived -> contacted` is an operator-only reversal edge (automated writers cannot un-archive).
- Navigation reflects operator tasks, not system architecture. `/agents/*`, `/templates`, `/visual-qa/*`, `/audits`, `/websites`, `/outreach`, `/offers` keep their routes and keep working; they are secondary/debug surfaces, not primary nav. Do not delete routes.
- `work_items` follow the same RLS pattern as every other table (RLS enabled; anon/authenticated/public revoked). Resolution must be idempotent and derived from real state, not a trusted flag.
- Do not implement Manager execution.
- Do not process real payments or deploy generated websites. No live Stripe call, no live email send, no paid AI, no production deployment, DNS, or domain action.
- Do not connect production Vercel APIs.
- Do not add background workers or scheduled jobs unless a later milestone explicitly asks for them.
- Do not start Milestone 11 (Live Payment Rehearsal) or any later milestone unless asked.

## Architecture notes

- Domain types live in `src/types`.
- Database types live in `src/types/database.ts`.
- Data access lives in `src/data` repositories. Pages must not run raw Supabase queries.
- Paid-AI execution lives in `src/lib/ai`. Entry point: `executeApprovedAiRun(runId, request)`.
- Shared SSRF-safe HTTP lives in `src/lib/http`. Scout and Auditor must not grow a second fetch stack.
- Scout lives in `src/lib/scout` and `src/data/scout.ts`. Manual UI: `/agents/scout`.
- Auditor lives in `src/lib/auditor` and `src/data/auditor.ts`. Manual UI: `/agents/auditor`. Audit detail: `/audits/[id]`.
- Builder lives in `src/lib/builder` and `src/data/builder.ts`. Manual UI: `/agents/builder`. Internal draft: `/websites/[id]`. Preview: `/websites/[id]/preview`.
- Sales lives in `src/lib/sales` and `src/data/sales.ts`. Manual UI: `/agents/sales`. Outreach review UI: `/outreach`.
- Mock email provider code lives in `src/lib/email`.
- Payment provider and checkout policy code lives in `src/lib/payments`.
- Payment data access lives in `src/data/payments.ts`.
- Lead lifecycle transition rules live in `src/lib/leads/lifecycle.ts` (the one place). Follow-up outreach logic lives in `src/lib/sales/follow-up.ts`.
- Work items live in `src/lib/work-items` and `src/data/work-items.ts`. Queue UI: `/today` (the post-login landing page). Business detail / unit of work: `/leads/[id]`.
- Server Supabase utilities live in `src/lib/supabase` and are `server-only`.
- Shared UI lives in `src/components/shared`.
- Agent placeholders live in `src/agents`.
- Prefer Server Components. Use Client Components only for interaction.
