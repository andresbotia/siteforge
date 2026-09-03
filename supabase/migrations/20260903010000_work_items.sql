-- M10 Task 3: the operator work-item queue.
--
-- A work_item is an index entry saying "this business needs operator
-- attention of kind X". Items are created by the same server-side code paths
-- that already change state (a completed audit, a pending approval, a lead
-- reaching `interested`, a checkout completing). There is NO background job
-- or scheduler -- AGENTS.md forbids them and none is needed.
--
-- Resolution is derived from real state, not a trusted flag: the reconcile
-- pass recomputes the desired set of open items from live data on every
-- /today render and closes any open item whose cause is gone. `resolved_at`
-- is therefore a cache of that derivation, safe to recompute.
--
-- Additive only. Admin-only. RLS enabled; anon/authenticated/public revoked,
-- same pattern as every other application table.

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null check (type in (
    'qualify_lead',
    'review_site',
    'approve_outreach',
    'handle_reply',
    'confirm_intent',
    'approve_follow_up',
    'fulfill_site'
  )),
  -- Stable key for the triggering entity (e.g. 'audit:<id>', 'approval:<id>')
  -- so an item is created once per cause and a genuinely new cause makes a
  -- new item.
  dedupe_key text not null default '',
  priority integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,

  -- Lifecycle. An item is "open" when resolved_at, dismissed_at are both null.
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  -- Operator can defer an item without resolving it.
  snoozed_until timestamptz,
  -- Operator can say "not relevant"; a dismissed item is a tombstone the
  -- reconcile pass will not recreate for the same dedupe_key.
  dismissed_at timestamptz,
  dismissed_reason text
);

-- One open item per (lead, type, cause).
create unique index if not exists work_items_open_unique
  on public.work_items (lead_id, type, dedupe_key)
  where resolved_at is null and dismissed_at is null;

create index if not exists work_items_open_idx
  on public.work_items (priority, created_at)
  where resolved_at is null and dismissed_at is null;

create index if not exists work_items_lead_id_idx
  on public.work_items (lead_id);

alter table public.work_items enable row level security;

revoke all on table public.work_items from anon, authenticated, public;
