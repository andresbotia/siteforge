-- M9.6 Stripe real integration: widen subscriptions.status so it can
-- reflect real Stripe subscription lifecycle states (trialing/past_due/
-- unpaid), not just the mock flow's active/pending/cancelled. Additive
-- only: every existing allowed value is kept, nothing is renamed or
-- removed, no data is rewritten. RLS/grants on public.subscriptions are
-- unchanged (already revoked from anon/authenticated/public since
-- 20260829180000_remove_public_read_access.sql).

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (
    status in ('active', 'pending', 'cancelled', 'trialing', 'past_due', 'unpaid', 'inactive')
  );
