-- Milestone 4: Scout qualification fields on leads.
-- Additive only. RLS remains enabled. No anon/authenticated grants.
-- Integer scores are 0-100. Evidence stays in JSONB (no full HTML).

alter table public.leads
  add column if not exists normalized_domain text,
  add column if not exists normalized_phone text,
  add column if not exists qualification_tier text,
  add column if not exists business_strength_score integer,
  add column if not exists website_opportunity_score integer,
  add column if not exists overall_qualification_score integer,
  add column if not exists qualification_reasons jsonb not null default '[]'::jsonb,
  add column if not exists inspection_summary jsonb not null default '{}'::jsonb,
  add column if not exists discovered_at timestamptz,
  add column if not exists last_scout_run_id uuid references public.agent_runs (id) on delete set null;

alter table public.leads drop constraint if exists leads_qualification_tier_check;
alter table public.leads
  add constraint leads_qualification_tier_check check (
    qualification_tier is null or qualification_tier in (
      'reject',
      'review',
      'qualified',
      'high_priority'
    )
  );

alter table public.leads drop constraint if exists leads_business_strength_score_check;
alter table public.leads
  add constraint leads_business_strength_score_check check (
    business_strength_score is null
    or (business_strength_score >= 0 and business_strength_score <= 100)
  );

alter table public.leads drop constraint if exists leads_website_opportunity_score_check;
alter table public.leads
  add constraint leads_website_opportunity_score_check check (
    website_opportunity_score is null
    or (website_opportunity_score >= 0 and website_opportunity_score <= 100)
  );

alter table public.leads drop constraint if exists leads_overall_qualification_score_check;
alter table public.leads
  add constraint leads_overall_qualification_score_check check (
    overall_qualification_score is null
    or (overall_qualification_score >= 0 and overall_qualification_score <= 100)
  );

create index if not exists leads_normalized_domain_idx
  on public.leads (normalized_domain);

create index if not exists leads_qualification_tier_idx
  on public.leads (qualification_tier);

create index if not exists leads_last_scout_run_id_idx
  on public.leads (last_scout_run_id);

revoke all on table public.leads from anon, authenticated, public;
