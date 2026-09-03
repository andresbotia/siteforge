-- M9.9 lifecycle states + payment follow-up outreach.
--
-- Additive only. Every pre-existing allowed value is preserved, no column or
-- table is renamed or dropped, and no data is rewritten. The two CHECK
-- constraints touched below are WIDENED in place (drop + re-add of the
-- constraint definition only -- the standard Postgres idiom for widening,
-- already used by 20260901020000_stripe_subscription_status.sql); no data
-- is affected and every value that was legal before is still legal.
--
-- RLS/grants on public.leads and public.outreach are unchanged (already
-- revoked from anon/authenticated/public since
-- 20260829180000_remove_public_read_access.sql and
-- 20260830100000_sales_outreach_approvals.sql).

-- ---------------------------------------------------------------------------
-- 1. Lead lifecycle: add `archived`, which always carries a reason.
--    `interested` was already an allowed value and is unchanged here; the
--    interested -> contacted fallback is a transition rule, enforced in
--    src/lib/leads/lifecycle.ts, not a schema change.
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists archived_reason text,
  add column if not exists archived_at timestamptz;

alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'discovered',
      'qualified',
      'audited',
      'website_built',
      'approved',
      'contacted',
      'interested',
      'customer',
      'rejected',
      'archived'
    )
  );

-- An archived lead must record why. No existing row can violate this because
-- 'archived' is a brand-new status value introduced by this migration.
alter table public.leads
  drop constraint if exists leads_archived_reason_check;

alter table public.leads
  add constraint leads_archived_reason_check check (
    status <> 'archived' or archived_reason is not null
  );

-- ---------------------------------------------------------------------------
-- 2. Operator-supplied suggested domain (M9.9 cold outreach).
--    Manually filled by an operator who has checked availability themselves.
--    SiteForge never asserts availability -- see src/lib/sales/draft.ts.
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists suggested_domain text;

-- ---------------------------------------------------------------------------
-- 3. Outreach kinds: the existing cold prospect email plus the new
--    post-intent payment follow-up that carries a purchase link.
--    Existing rows default to 'cold_outreach', which is what they all are.
-- ---------------------------------------------------------------------------
alter table public.outreach
  add column if not exists kind text not null default 'cold_outreach',
  add column if not exists commercial_offer_id uuid references public.commercial_offers (id) on delete set null,
  add column if not exists purchase_token_hash text;

alter table public.outreach
  drop constraint if exists outreach_kind_check;

alter table public.outreach
  add constraint outreach_kind_check check (kind in ('cold_outreach', 'follow_up'));

-- A follow-up must be bound to an offer and to the exact purchase link hash
-- it was approved against; a cold outreach must carry neither.
alter table public.outreach
  drop constraint if exists outreach_follow_up_binding_check;

alter table public.outreach
  add constraint outreach_follow_up_binding_check check (
    (kind = 'follow_up' and commercial_offer_id is not null and purchase_token_hash is not null)
    or (kind <> 'follow_up' and commercial_offer_id is null and purchase_token_hash is null)
  );

create index if not exists outreach_kind_lead_id_idx
  on public.outreach (lead_id, kind);

create index if not exists outreach_commercial_offer_id_idx
  on public.outreach (commercial_offer_id)
  where commercial_offer_id is not null;
