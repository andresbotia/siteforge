-- Milestone 9: Stripe Checkout + customer conversion.
-- Additive local migration only. Do not apply to hosted Supabase until approved.

create table if not exists public.commercial_offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  generated_website_id uuid references public.generated_websites (id) on delete set null,
  outreach_id uuid references public.outreach (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  approval_id uuid references public.approvals (id) on delete set null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'awaiting_approval',
      'approved',
      'checkout_created',
      'paid',
      'expired',
      'cancelled'
    )
  ),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  setup_amount_cents integer not null check (setup_amount_cents > 0),
  managed_monthly_amount_cents integer check (
    managed_monthly_amount_cents is null or managed_monthly_amount_cents > 0
  ),
  managed_plan_selected boolean not null default false,
  description text not null,
  content_hash text not null,
  content_version text not null default 'commercial-offer.v1',
  approved_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_offers_managed_amount_check check (
    managed_plan_selected = false or managed_monthly_amount_cents is not null
  )
);

create index if not exists commercial_offers_lead_id_idx
  on public.commercial_offers (lead_id, created_at desc);
create index if not exists commercial_offers_generated_website_id_idx
  on public.commercial_offers (generated_website_id);
create index if not exists commercial_offers_outreach_id_idx
  on public.commercial_offers (outreach_id);
create index if not exists commercial_offers_customer_id_idx
  on public.commercial_offers (customer_id);
create index if not exists commercial_offers_approval_id_idx
  on public.commercial_offers (approval_id);
create index if not exists commercial_offers_status_idx
  on public.commercial_offers (status);

drop trigger if exists commercial_offers_set_updated_at on public.commercial_offers;
create trigger commercial_offers_set_updated_at
before update on public.commercial_offers
for each row execute function public.set_updated_at();

create table if not exists public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  commercial_offer_id uuid not null references public.commercial_offers (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  mode text not null check (mode in ('payment', 'subscription')),
  status text not null default 'created' check (
    status in ('created', 'completed', 'expired', 'cancelled', 'failed')
  ),
  checkout_url text,
  amount_total_cents integer check (amount_total_cents is null or amount_total_cents >= 0),
  currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  expires_at timestamptz,
  completed_at timestamptz,
  last_event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_checkout_sessions_offer_id_idx
  on public.stripe_checkout_sessions (commercial_offer_id, created_at desc);
create index if not exists stripe_checkout_sessions_lead_id_idx
  on public.stripe_checkout_sessions (lead_id);
create index if not exists stripe_checkout_sessions_status_idx
  on public.stripe_checkout_sessions (status);
create unique index if not exists stripe_checkout_sessions_one_completed_per_offer_idx
  on public.stripe_checkout_sessions (commercial_offer_id)
  where status = 'completed';

drop trigger if exists stripe_checkout_sessions_set_updated_at on public.stripe_checkout_sessions;
create trigger stripe_checkout_sessions_set_updated_at
before update on public.stripe_checkout_sessions
for each row execute function public.set_updated_at();

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  object_id text,
  processing_status text not null default 'pending' check (
    processing_status in ('pending', 'processed', 'ignored', 'failed')
  ),
  payload_metadata jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events (event_type);
create index if not exists stripe_webhook_events_status_idx
  on public.stripe_webhook_events (processing_status);

alter table public.customers
  add column if not exists commercial_offer_id uuid references public.commercial_offers (id) on delete set null,
  add column if not exists stripe_customer_id text,
  add column if not exists converted_at timestamptz,
  add column if not exists conversion_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists customers_one_per_lead_idx
  on public.customers (lead_id)
  where lead_id is not null;
create unique index if not exists customers_stripe_customer_id_idx
  on public.customers (stripe_customer_id)
  where stripe_customer_id is not null;
create index if not exists customers_commercial_offer_id_idx
  on public.customers (commercial_offer_id);

alter table public.subscriptions
  add column if not exists commercial_offer_id uuid references public.commercial_offers (id) on delete set null,
  add column if not exists amount_cents integer check (amount_cents is null or amount_cents >= 0),
  add column if not exists currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists conversion_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists subscriptions_provider_subscription_id_idx
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;
create unique index if not exists subscriptions_offer_monthly_idx
  on public.subscriptions (commercial_offer_id)
  where commercial_offer_id is not null and interval = 'month';
create index if not exists subscriptions_commercial_offer_id_idx
  on public.subscriptions (commercial_offer_id);

alter table public.commercial_offers enable row level security;
alter table public.stripe_checkout_sessions enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;

revoke all on table public.commercial_offers from anon, authenticated, public;
revoke all on table public.stripe_checkout_sessions from anon, authenticated, public;
revoke all on table public.stripe_webhook_events from anon, authenticated, public;
revoke all on table public.customers from anon, authenticated, public;
revoke all on table public.subscriptions from anon, authenticated, public;
