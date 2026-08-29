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

Milestone 2 adds a version-controlled Supabase data layer. Dashboard reads come from repositories in `src/data`. Temporary single-admin cookie auth remains in `src/lib/auth` and `src/proxy.ts` until Supabase Auth is explicitly requested.

- Database migrations must be version-controlled under `supabase/migrations`.
- Never expose privileged Supabase credentials client-side. Never put `SUPABASE_SECRET_KEY` in `NEXT_PUBLIC_*` or Client Components.
- Application table reads must go through `src/data` repositories and `requireAdminSession()`. Do not grant `anon` or `authenticated` SELECT on application tables.
- Never disable RLS merely to make development easier.
- External side effects require approvals.
- Paid AI spend must eventually require budget authorization. No agent may incur unapproved paid cost.
- Agents cannot directly hold infrastructure credentials, including `SUPABASE_SECRET_KEY`.

Do not implement Scout, Auditor, Builder, Sales, or Manager execution.
Do not connect xAI, Vercel, Resend, or Stripe APIs.
Do not scrape businesses, send email, process payments, or deploy generated websites.
Do not add background workers or scheduled jobs unless a later milestone explicitly asks for them.

## Architecture notes

- Domain types live in `src/types`.
- Database types live in `src/types/database.ts`.
- Data access lives in `src/data` repositories. Pages must not run raw Supabase queries.
- Server Supabase utilities live in `src/lib/supabase` and are `server-only`.
- Shared UI lives in `src/components/shared`.
- Agent placeholders live in `src/agents`.
- Prefer Server Components. Use Client Components only for interaction.
