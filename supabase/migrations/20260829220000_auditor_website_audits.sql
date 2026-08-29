-- Milestone 5: Auditor structured website audits.
-- Additive only. Existing seed audits remain historical rows.
-- RLS remains enabled. No anon/authenticated/public grants.

alter table public.website_audits
  add column if not exists technical_score integer,
  add column if not exists ux_score integer,
  add column if not exists content_score integer,
  add column if not exists redesign_opportunity_score integer,
  add column if not exists findings jsonb not null default '[]'::jsonb,
  add column if not exists inspected_urls jsonb not null default '[]'::jsonb,
  add column if not exists audit_version text,
  add column if not exists source_run_id uuid references public.agent_runs (id) on delete set null,
  add column if not exists pages_inspected integer not null default 0,
  add column if not exists website_url text;

alter table public.website_audits drop constraint if exists website_audits_technical_score_check;
alter table public.website_audits
  add constraint website_audits_technical_score_check check (
    technical_score is null or (technical_score >= 0 and technical_score <= 100)
  );

alter table public.website_audits drop constraint if exists website_audits_ux_score_check;
alter table public.website_audits
  add constraint website_audits_ux_score_check check (
    ux_score is null or (ux_score >= 0 and ux_score <= 100)
  );

alter table public.website_audits drop constraint if exists website_audits_content_score_check;
alter table public.website_audits
  add constraint website_audits_content_score_check check (
    content_score is null or (content_score >= 0 and content_score <= 100)
  );

alter table public.website_audits drop constraint if exists website_audits_redesign_opportunity_score_check;
alter table public.website_audits
  add constraint website_audits_redesign_opportunity_score_check check (
    redesign_opportunity_score is null
    or (redesign_opportunity_score >= 0 and redesign_opportunity_score <= 100)
  );

create index if not exists website_audits_source_run_id_idx
  on public.website_audits (source_run_id);

create index if not exists website_audits_audit_version_idx
  on public.website_audits (audit_version);

revoke all on table public.website_audits from anon, authenticated, public;
