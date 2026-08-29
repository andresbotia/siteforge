-- Milestone 7: human-approved public prospect previews and privacy-conscious tracking.
-- Additive only. This creates a public-preview data model; it does not publish
-- any existing generated website by itself.

create table if not exists public.preview_deployments (
  id uuid primary key default gen_random_uuid(),
  generated_website_id uuid not null references public.generated_websites (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  approval_id uuid references public.approvals (id) on delete set null,
  token_hash text not null unique,
  token_hint text not null,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  source_run_id uuid references public.agent_runs (id) on delete set null,
  outreach_id uuid references public.outreach (id) on delete set null,
  campaign_id text,
  build_version text,
  attribution jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists preview_deployments_one_active_per_website_idx
  on public.preview_deployments (generated_website_id)
  where status = 'active' and revoked_at is null;

create index if not exists preview_deployments_generated_website_id_idx
  on public.preview_deployments (generated_website_id);

create index if not exists preview_deployments_lead_id_idx
  on public.preview_deployments (lead_id);

create index if not exists preview_deployments_approval_id_idx
  on public.preview_deployments (approval_id);

create index if not exists preview_deployments_outreach_id_idx
  on public.preview_deployments (outreach_id);

create table if not exists public.preview_events (
  id uuid primary key default gen_random_uuid(),
  preview_deployment_id uuid not null references public.preview_deployments (id) on delete cascade,
  generated_website_id uuid not null references public.generated_websites (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'preview_viewed',
      'cta_clicked',
      'phone_cta_clicked',
      'contact_cta_clicked'
    )),
  visitor_key text,
  bot_classification text not null default 'unknown'
    check (bot_classification in ('human_likely', 'bot_likely', 'unknown')),
  device_class text not null default 'unknown'
    check (device_class in ('desktop', 'mobile', 'tablet', 'unknown')),
  browser_class text not null default 'unknown'
    check (browser_class in ('chrome', 'safari', 'firefox', 'edge', 'bot', 'unknown')),
  country text,
  region text,
  city text,
  referrer text,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists preview_events_preview_deployment_id_idx
  on public.preview_events (preview_deployment_id, occurred_at desc);

create index if not exists preview_events_generated_website_id_idx
  on public.preview_events (generated_website_id, occurred_at desc);

create index if not exists preview_events_lead_id_idx
  on public.preview_events (lead_id, occurred_at desc);

alter table public.preview_deployments enable row level security;
alter table public.preview_events enable row level security;

revoke all on table public.preview_deployments from anon, authenticated, public;
revoke all on table public.preview_events from anon, authenticated, public;
