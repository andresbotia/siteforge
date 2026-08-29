# Builder

Manual website-draft agent. Orchestration lives in `src/lib/builder` and `src/data/builder.ts`.

Builder never receives `SUPABASE_SECRET_KEY` or `XAI_API_KEY`.
Deterministic drafts do not use paid AI.
Email, production deploy, domain, DNS, and payment side effects are forbidden.
