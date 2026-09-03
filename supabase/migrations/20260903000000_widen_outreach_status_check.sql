-- M10 Task 0: widen public.outreach.status CHECK to match the code's full
-- dbStatuses set (src/data/outreach.ts).
--
-- Additive only. The constraint is WIDENED in place (drop + re-add, the same
-- idiom 20260902000000 and 20260901020000 use). Every value legal before is
-- still legal; no row can violate the wider constraint, and no data is
-- rewritten. RLS/grants on public.outreach are unchanged.
--
-- Before: draft, awaiting_approval, approved, sent, failed, replied
-- After : + interested, declined, unsubscribed
--
-- Today these three are only ever DERIVED from outreach_events in
-- displayStatus() and never written to the column, but dbStatuses treats them
-- as valid persisted values and a future writer may persist them; the schema
-- should not be narrower than the code's own contract.

alter table public.outreach
  drop constraint if exists outreach_status_check;

alter table public.outreach
  add constraint outreach_status_check check (
    status in (
      'draft',
      'awaiting_approval',
      'approved',
      'sent',
      'failed',
      'replied',
      'interested',
      'declined',
      'unsubscribed'
    )
  );
