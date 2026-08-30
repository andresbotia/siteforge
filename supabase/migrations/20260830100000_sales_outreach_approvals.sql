-- Milestone 8: Sales Agent + human-approved email outreach data model.
-- Additive only. Extends outreach and preview tracking for deterministic drafts,
-- approval-content binding, and preview attribution.

alter table public.outreach
  add column if not exists generated_website_id uuid references public.generated_websites (id) on delete set null,
  add column if not exists preview_deployment_id uuid references public.preview_deployments (id) on delete set null,
  add column if not exists sales_run_id uuid references public.agent_runs (id) on delete set null,
  add column if not exists sender_name text,
  add column if not exists sender_email text,
  add column if not exists content_hash text,
  add column if not exists content_version text not null default 'sales.v1',
  add column if not exists provider text not null default 'mock',
  add column if not exists approved_at timestamptz,
  add column if not exists campaign_id text,
  add column if not exists attribution_token_hash text unique,
  add column if not exists attribution_token_hint text,
  add column if not exists attribution_token_created_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists outreach_generated_website_id_idx
  on public.outreach (generated_website_id);

create index if not exists outreach_preview_deployment_id_idx
  on public.outreach (preview_deployment_id);

create index if not exists outreach_agent_run_id_idx
  on public.outreach (agent_run_id);

create index if not exists outreach_sales_run_id_idx
  on public.outreach (sales_run_id);

create index if not exists outreach_attribution_token_hash_idx
  on public.outreach (attribution_token_hash)
  where attribution_token_hash is not null;

-- Link preview_events to outreach if attributed
alter table public.preview_events
  add column if not exists outreach_id uuid references public.outreach (id) on delete set null;

create index if not exists preview_events_outreach_id_idx
  on public.preview_events (outreach_id, occurred_at desc);

-- Ensure RLS is active on outreach tables and public access revoked
alter table public.outreach enable row level security;
alter table public.outreach_events enable row level security;

revoke all on table public.outreach from anon, authenticated, public;
revoke all on table public.outreach_events from anon, authenticated, public;
