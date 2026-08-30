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

Milestone 8 adds manual Sales outreach drafts, approval binding, mock email sending, and tracked outreach preview attribution. Milestone 7 Preview, Milestone 6 Builder, Milestone 5 Auditor, Milestone 4 Scout, and Milestone 3 paid-AI gates remain mandatory. Temporary single-admin cookie auth remains in `src/lib/auth` and `src/proxy.ts`.

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
- Email execution is mock-only unless a later milestone explicitly adds a real provider. Do not call Resend or send real email.
- Do not implement Manager execution.
- Do not process payments or deploy generated websites.
- Do not connect Stripe, Resend, or production Vercel APIs.
- Do not add background workers or scheduled jobs unless a later milestone explicitly asks for them.
- Do not start Milestone 9 unless asked.

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
- Server Supabase utilities live in `src/lib/supabase` and are `server-only`.
- Shared UI lives in `src/components/shared`.
- Agent placeholders live in `src/agents`.
- Prefer Server Components. Use Client Components only for interaction.
