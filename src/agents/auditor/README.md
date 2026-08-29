# Auditor

Manual website-audit agent. Orchestration lives in `src/lib/auditor` and `src/data/auditor.ts`.

Auditor never receives `SUPABASE_SECRET_KEY` or `XAI_API_KEY`.
Deterministic audits do not use paid AI.
Outreach, deploy, payment, and website-generation side effects are forbidden.
