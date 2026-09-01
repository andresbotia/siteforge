-- M9.6: Designer Job system.
--
-- A Designer Job is a work order for premium visual design work that the
-- deterministic Builder/template registry cannot cover on its own. It is
-- distinct from generated_websites/external_site_artifacts: a job tracks the
-- *request* (why design work was needed, what brief/facts/imagery were sent
-- to a design provider, what the provider returned) and its human review
-- lifecycle. A successful job produces a generated_websites row and an
-- external_site_artifacts row through the existing external-generated-site
-- pipeline (M9.5D); it does not replace that pipeline.
--
-- Human visual approval is mandatory and structural: no job may become
-- `approved` or `promoted_to_master` while visual_review_status is anything
-- other than `approved`. That check lives in application code
-- (src/lib/designer/state-machine.ts) because Postgres check constraints
-- cannot express "column A implies column B" across an UPDATE cleanly here,
-- but visual_review_status defaults to 'not_ready' and only an explicit
-- admin-authored review can move it to 'approved'. No AI worker writes this
-- column.
--
-- Additive only. Admin-only. RLS enabled, anon/authenticated/public revoked.

create table if not exists public.designer_jobs (
  id uuid primary key default gen_random_uuid(),

  -- What triggered this job.
  lead_id uuid references public.leads (id) on delete set null,
  is_fixture boolean not null default false,
  requested_by_agent_run_id uuid references public.agent_runs (id) on delete set null,

  -- Why design work was required.
  mode text not null check (mode in ('new_master', 'adaptation')),
  template_family text check (template_family in ('home_services', 'restaurant', 'professional', 'other')),
  base_template_key text,
  reason text not null default '',

  -- Provider / worker.
  provider text not null default 'claude_code' check (provider in ('claude_code', 'grok_local')),
  billing_mode text not null default 'subscription' check (billing_mode in ('subscription', 'paid_api')),
  claimed_by text,
  claimed_at timestamptz,

  -- State machine.
  status text not null default 'queued' check (status in (
    'queued', 'claimed', 'preparing', 'generating', 'generated', 'validating',
    'technical_qa_failed', 'technical_qa_passed', 'visual_review_required',
    'approved', 'rejected', 'failed', 'cancelled', 'superseded'
  )),

  -- Sanitized input sent to the worker. No secrets. No raw DB rows.
  design_brief jsonb not null default '{}'::jsonb,
  input_facts_snapshot jsonb not null default '{}'::jsonb,
  input_facts_fingerprint text,
  imagery_manifest jsonb not null default '{}'::jsonb,

  -- Worker execution.
  workspace_path text,
  started_at timestamptz,
  completed_at timestamptz,
  output_report jsonb,
  cash_cost_usd numeric not null default 0 check (cash_cost_usd >= 0),
  subscription_usage_class text not null default 'designer_job',
  subscription_usage_status text not null default 'not_started' check (subscription_usage_status in (
    'not_started', 'attempted', 'completed', 'blocked', 'failed'
  )),
  failure_code text,
  failure_reason text,

  -- Independent SiteForge validation. Never trust the worker's self-report.
  technical_qa_report jsonb,
  output_generated_website_id uuid references public.generated_websites (id) on delete set null,
  output_artifact_id uuid references public.external_site_artifacts (id) on delete set null,

  -- Human visual approval. Mandatory. Never set by a worker or by this
  -- table's own defaults transitioning automatically.
  visual_review_status text not null default 'not_ready' check (visual_review_status in (
    'not_ready', 'pending', 'approved', 'needs_revision', 'rejected'
  )),
  visual_review_notes text,
  visual_reviewed_by text,
  visual_reviewed_at timestamptz,

  -- Master harvesting. promoted_to_master may only be true when
  -- visual_review_status = 'approved'; enforced in application code.
  promoted_to_master boolean not null default false,
  master_template_key text,

  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists designer_jobs_status_idx
  on public.designer_jobs (status, created_at desc);

create index if not exists designer_jobs_lead_id_idx
  on public.designer_jobs (lead_id, created_at desc);

create index if not exists designer_jobs_queued_claim_idx
  on public.designer_jobs (created_at)
  where status = 'queued';

alter table public.designer_jobs enable row level security;

revoke all on table public.designer_jobs from anon, authenticated, public;

-- Atomic claim: only one worker can ever claim a given queued job. Uses a
-- conditional UPDATE ... WHERE status = 'queued' rather than a Postgres
-- advisory lock, mirroring the simple compare-and-swap style already used
-- elsewhere in this codebase (e.g. external_site_artifacts deployment_status
-- transitions) rather than introducing a new locking primitive.
create or replace function public.siteforge_claim_designer_job(p_job_id uuid, p_claimed_by text)
returns public.designer_jobs
language sql
security definer
set search_path = public
as $$
  update public.designer_jobs
  set status = 'claimed',
      claimed_by = p_claimed_by,
      claimed_at = now(),
      updated_at = now()
  where id = p_job_id
    and status = 'queued'
  returning *;
$$;

revoke all on function public.siteforge_claim_designer_job(uuid, text) from public, anon, authenticated;
grant execute on function public.siteforge_claim_designer_job(uuid, text) to service_role;
