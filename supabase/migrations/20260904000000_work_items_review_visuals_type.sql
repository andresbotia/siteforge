-- M10.5 Task 0: add the `review_visuals` work-item type.
--
-- M10's `review_site` means "this lead has an audit but no website has been
-- produced yet". Approving the VISUALS of a site that already exists (from the
-- deterministic Builder or from a Designer Job sitting in
-- `visual_review_required`) is a different, and during the first campaign far
-- more common, operator action. It gets its own type, slotted between
-- `fulfill_site` and `review_site` by revenue proximity (see
-- src/lib/work-items/types.ts, which is the authority on ordering).
--
-- Additive: drop + re-add of the unnamed inline CHECK (Postgres auto-names it
-- `work_items_type_check`). No data is touched -- no existing row carries the
-- new value. Same shape as 20260903000000_widen_outreach_status_check.sql.

alter table public.work_items
  drop constraint if exists work_items_type_check;

alter table public.work_items
  add constraint work_items_type_check check (type in (
    'qualify_lead',
    'review_site',
    'review_visuals',
    'approve_outreach',
    'handle_reply',
    'confirm_intent',
    'approve_follow_up',
    'fulfill_site'
  ));
