-- Milestone 6: Builder structured website drafts.
-- Additive only. Existing seed generated_websites remain historical rows.
-- RLS remains enabled. No anon/authenticated/public grants.

alter table public.generated_websites
  add column if not exists spec jsonb not null default '{}'::jsonb,
  add column if not exists build_version text,
  add column if not exists source_audit_id uuid references public.website_audits (id) on delete set null,
  add column if not exists source_run_id uuid references public.agent_runs (id) on delete set null,
  add column if not exists audit_fixes jsonb not null default '[]'::jsonb,
  add column if not exists content_provenance jsonb not null default '[]'::jsonb,
  add column if not exists template_key text;

create index if not exists generated_websites_source_audit_id_idx
  on public.generated_websites (source_audit_id);

create index if not exists generated_websites_source_run_id_idx
  on public.generated_websites (source_run_id);

create index if not exists generated_websites_template_key_idx
  on public.generated_websites (template_key);

revoke all on table public.generated_websites from anon, authenticated, public;
