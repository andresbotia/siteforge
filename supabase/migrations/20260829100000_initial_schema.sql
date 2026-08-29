-- SiteForge initial schema
-- Version-controlled. Apply with `supabase db push` or the SQL editor.
-- Privileged service-role credentials are intentionally not used by the app.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  industry text not null,
  address text,
  city text,
  state text,
  phone text,
  email text,
  website_url text,
  google_rating numeric(2, 1) check (google_rating is null or (google_rating >= 0 and google_rating <= 5)),
  review_count integer not null default 0 check (review_count >= 0),
  status text not null check (
    status in (
      'discovered',
      'qualified',
      'audited',
      'website_built',
      'approved',
      'contacted',
      'interested',
      'customer',
      'rejected'
    )
  ),
  lead_score integer check (lead_score is null or (lead_score >= 0 and lead_score <= 100)),
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on public.leads (status);
create index leads_city_idx on public.leads (city);
create index leads_industry_idx on public.leads (industry);
create index leads_created_at_idx on public.leads (created_at desc);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- website_audits
-- ---------------------------------------------------------------------------
create table public.website_audits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  overall_score integer check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  design_score integer check (design_score is null or (design_score >= 0 and design_score <= 100)),
  seo_score integer check (seo_score is null or (seo_score >= 0 and seo_score <= 100)),
  mobile_score integer check (mobile_score is null or (mobile_score >= 0 and mobile_score <= 100)),
  performance_score integer check (performance_score is null or (performance_score >= 0 and performance_score <= 100)),
  conversion_score integer check (conversion_score is null or (conversion_score >= 0 and conversion_score <= 100)),
  issues jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index website_audits_lead_id_idx on public.website_audits (lead_id);
create index website_audits_created_at_idx on public.website_audits (created_at desc);

create trigger website_audits_set_updated_at
before update on public.website_audits
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- generated_websites
-- ---------------------------------------------------------------------------
create table public.generated_websites (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  status text not null check (
    status in ('building', 'review_required', 'approved', 'live', 'failed')
  ),
  template text,
  preview_url text,
  production_url text,
  repository_url text,
  seo_score integer check (seo_score is null or (seo_score >= 0 and seo_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generated_websites_lead_id_idx on public.generated_websites (lead_id);
create index generated_websites_status_idx on public.generated_websites (status);

create trigger generated_websites_set_updated_at
before update on public.generated_websites
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status text not null default 'disabled' check (
    status in ('disabled', 'inactive', 'not_configured')
  ),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agents_set_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- agent_runs
-- ---------------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  status text not null check (
    status in ('queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled')
  ),
  trigger_type text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  model text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  actual_cost_usd numeric(12, 6) check (actual_cost_usd is null or actual_cost_usd >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index agent_runs_agent_id_idx on public.agent_runs (agent_id);
create index agent_runs_lead_id_idx on public.agent_runs (lead_id);
create index agent_runs_status_idx on public.agent_runs (status);
create index agent_runs_started_at_idx on public.agent_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- agent_tool_calls
-- ---------------------------------------------------------------------------
create table public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs (id) on delete cascade,
  tool_name text not null,
  action text,
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  status text not null check (
    status in ('queued', 'running', 'completed', 'failed', 'cancelled', 'awaiting_approval')
  ),
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  actual_cost_usd numeric(12, 6) check (actual_cost_usd is null or actual_cost_usd >= 0),
  requires_approval boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index agent_tool_calls_run_id_idx on public.agent_tool_calls (agent_run_id);
create index agent_tool_calls_requires_approval_idx on public.agent_tool_calls (requires_approval);

-- ---------------------------------------------------------------------------
-- approvals
-- ---------------------------------------------------------------------------
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  approval_type text not null check (
    approval_type in (
      'website_deployment',
      'external_email',
      'website_modification',
      'payment_action',
      'paid_ai_usage',
      'dns_change',
      'destructive_infrastructure_action'
    )
  ),
  status text not null check (
    status in ('pending', 'approved', 'rejected', 'expired', 'executed', 'failed')
  ),
  title text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  approved_cost_limit_usd numeric(12, 6) check (approved_cost_limit_usd is null or approved_cost_limit_usd >= 0),
  actual_cost_usd numeric(12, 6) check (actual_cost_usd is null or actual_cost_usd >= 0),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index approvals_lead_id_idx on public.approvals (lead_id);
create index approvals_agent_run_id_idx on public.approvals (agent_run_id);
create index approvals_status_idx on public.approvals (status);
create index approvals_type_idx on public.approvals (approval_type);
create index approvals_requested_at_idx on public.approvals (requested_at desc);

-- ---------------------------------------------------------------------------
-- outreach
-- ---------------------------------------------------------------------------
create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  approval_id uuid references public.approvals (id) on delete set null,
  subject text,
  body text,
  recipient_email text,
  status text not null check (
    status in ('draft', 'awaiting_approval', 'approved', 'sent', 'failed', 'replied')
  ),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outreach_lead_id_idx on public.outreach (lead_id);
create index outreach_status_idx on public.outreach (status);
create index outreach_approval_id_idx on public.outreach (approval_id);

create trigger outreach_set_updated_at
before update on public.outreach
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- outreach_events
-- ---------------------------------------------------------------------------
create table public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  outreach_id uuid not null references public.outreach (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index outreach_events_outreach_id_idx on public.outreach_events (outreach_id);
create index outreach_events_type_idx on public.outreach_events (event_type);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  business_name text not null,
  contact_name text,
  contact_email text,
  plan text not null check (plan in ('website_only', 'managed')),
  status text not null check (status in ('active', 'pending_setup', 'cancelled')),
  production_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_lead_id_idx on public.customers (lead_id);
create index customers_status_idx on public.customers (status);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  amount_usd numeric(10, 2) not null default 0 check (amount_usd >= 0),
  interval text check (interval in ('one_time', 'month', 'year')),
  status text not null check (status in ('active', 'pending', 'cancelled')),
  started_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_customer_id_idx on public.subscriptions (customer_id);
create index subscriptions_status_idx on public.subscriptions (status);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- integration_status
-- ---------------------------------------------------------------------------
create table public.integration_status (
  id uuid primary key default gen_random_uuid(),
  integration text not null unique,
  status text not null check (status in ('connected', 'not_connected', 'error')),
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger integration_status_set_updated_at
before update on public.integration_status
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activity_events
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_type text,
  actor_id text,
  lead_id uuid references public.leads (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_events_lead_id_idx on public.activity_events (lead_id);
create index activity_events_customer_id_idx on public.activity_events (customer_id);
create index activity_events_created_at_idx on public.activity_events (created_at desc);
create index activity_events_type_idx on public.activity_events (event_type);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- SiteForge still uses temporary custom admin auth, not Supabase Auth.
-- The app only uses the publishable (anon) key.
-- Writes are not granted. There is no service-role key in the application.
-- SELECT is granted to anon/authenticated so the dashboard can read seed data.
-- Anyone holding the publishable key can therefore read these tables via the
-- Data API until Supabase Auth replaces this model. Writes remain blocked.
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.website_audits enable row level security;
alter table public.generated_websites enable row level security;
alter table public.agents enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.approvals enable row level security;
alter table public.outreach enable row level security;
alter table public.outreach_events enable row level security;
alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.integration_status enable row level security;
alter table public.activity_events enable row level security;

revoke all on table public.leads from anon, authenticated, public;
revoke all on table public.website_audits from anon, authenticated, public;
revoke all on table public.generated_websites from anon, authenticated, public;
revoke all on table public.agents from anon, authenticated, public;
revoke all on table public.agent_runs from anon, authenticated, public;
revoke all on table public.agent_tool_calls from anon, authenticated, public;
revoke all on table public.approvals from anon, authenticated, public;
revoke all on table public.outreach from anon, authenticated, public;
revoke all on table public.outreach_events from anon, authenticated, public;
revoke all on table public.customers from anon, authenticated, public;
revoke all on table public.subscriptions from anon, authenticated, public;
revoke all on table public.integration_status from anon, authenticated, public;
revoke all on table public.activity_events from anon, authenticated, public;

grant select on table public.leads to anon, authenticated;
grant select on table public.website_audits to anon, authenticated;
grant select on table public.generated_websites to anon, authenticated;
grant select on table public.agents to anon, authenticated;
grant select on table public.agent_runs to anon, authenticated;
grant select on table public.agent_tool_calls to anon, authenticated;
grant select on table public.approvals to anon, authenticated;
grant select on table public.outreach to anon, authenticated;
grant select on table public.outreach_events to anon, authenticated;
grant select on table public.customers to anon, authenticated;
grant select on table public.subscriptions to anon, authenticated;
grant select on table public.integration_status to anon, authenticated;
grant select on table public.activity_events to anon, authenticated;

create policy leads_select_authenticated_or_anon
  on public.leads for select to anon, authenticated using (true);
create policy website_audits_select_authenticated_or_anon
  on public.website_audits for select to anon, authenticated using (true);
create policy generated_websites_select_authenticated_or_anon
  on public.generated_websites for select to anon, authenticated using (true);
create policy agents_select_authenticated_or_anon
  on public.agents for select to anon, authenticated using (true);
create policy agent_runs_select_authenticated_or_anon
  on public.agent_runs for select to anon, authenticated using (true);
create policy agent_tool_calls_select_authenticated_or_anon
  on public.agent_tool_calls for select to anon, authenticated using (true);
create policy approvals_select_authenticated_or_anon
  on public.approvals for select to anon, authenticated using (true);
create policy outreach_select_authenticated_or_anon
  on public.outreach for select to anon, authenticated using (true);
create policy outreach_events_select_authenticated_or_anon
  on public.outreach_events for select to anon, authenticated using (true);
create policy customers_select_authenticated_or_anon
  on public.customers for select to anon, authenticated using (true);
create policy subscriptions_select_authenticated_or_anon
  on public.subscriptions for select to anon, authenticated using (true);
create policy integration_status_select_authenticated_or_anon
  on public.integration_status for select to anon, authenticated using (true);
create policy activity_events_select_authenticated_or_anon
  on public.activity_events for select to anon, authenticated using (true);
