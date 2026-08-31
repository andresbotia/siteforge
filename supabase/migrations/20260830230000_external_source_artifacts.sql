-- M9.5D: immutable external generated-site source artifacts.
-- Additive only. Artifacts are admin-only and do not publish previews by themselves.

create table if not exists public.external_site_artifacts (
  id uuid primary key default gen_random_uuid(),
  generated_website_id uuid not null references public.generated_websites (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  provider text not null check (provider in ('lovable', 'manual', 'other')),
  provider_project_id text,
  provider_commit_sha text,
  source_manifest_fingerprint text not null,
  source_manifest jsonb not null,
  created_by text not null default 'admin',
  validation_status text not null check (validation_status in ('passed', 'failed')),
  build_status text not null check (build_status in ('pending', 'passed', 'blocked', 'failed', 'unsupported')),
  deployment_status text not null default 'not_requested'
    check (deployment_status in ('not_requested', 'pending_approval', 'deploying', 'deployed', 'failed')),
  deployment_id text,
  deployment_url text,
  failure_summary text,
  artifact_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists external_site_artifacts_generated_website_id_idx
  on public.external_site_artifacts (generated_website_id, created_at desc);

create index if not exists external_site_artifacts_lead_id_idx
  on public.external_site_artifacts (lead_id, created_at desc);

create index if not exists external_site_artifacts_source_manifest_fingerprint_idx
  on public.external_site_artifacts (source_manifest_fingerprint);

alter table public.external_site_artifacts enable row level security;

revoke all on table public.external_site_artifacts from anon, authenticated, public;
