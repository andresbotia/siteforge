-- M10.5 Task 0: widen the DEVELOPMENT seed so the /today queue shows a
-- realistic mix of work-item types rather than exercising one path.
--
-- These rows are fictional and additive, keyed on fixed UUIDs and all
-- referencing the fictional seed leads from
-- 20260829120000_seed_development_data.sql. `on conflict do nothing` keeps
-- `supabase db reset` idempotent. This does not touch production data: it
-- only inserts fixtures against seed-lead UUIDs that do not exist outside a
-- development database.
--
-- Context: the base seed already spans lifecycle stages (discovered,
-- audited, contacted, interested, website_built, approved, customer,
-- rejected) and already produces handle_reply / confirm_intent /
-- fulfill_site / review_site / approve_outreach / qualify_lead items. What it
-- lacked was coverage of the two newest paths -- `review_visuals` via a
-- Designer Job, and `approve_follow_up` -- so those are what this adds.

-- A Designer Job awaiting human visual sign-off -> one `review_visuals` item
-- keyed on `designer_job:<id>` for Ridgeway Roofing (whose Builder draft is
-- still `building`, so the website path does not also fire).
insert into public.designer_jobs (
  id, lead_id, is_fixture, mode, template_family, reason, status,
  visual_review_status
) values (
  'd0000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003',
  true,
  'new_master',
  'home_services',
  'Fictional development fixture: a roofing master template awaiting visual sign-off.',
  'visual_review_required',
  'pending'
)
on conflict (id) do nothing;

-- A payment follow-up email awaiting send approval -> one `approve_follow_up`
-- item for Tidewash Pressure Washing (interested, customer in pending_setup).
-- The `action` payload key is what src/lib/work-items/derive.ts routes on.
insert into public.approvals (
  id, agent_run_id, lead_id, approval_type, status, title, description,
  payload, estimated_cost_usd, approved_cost_limit_usd, actual_cost_usd,
  requested_at, resolved_at, created_at
) values (
  '60000000-0000-4000-8000-000000000107',
  null,
  '10000000-0000-4000-8000-000000000007',
  'external_email',
  'pending',
  'Send payment follow-up to Tidewash Pressure Washing',
  'Fictional development fixture: a payment follow-up email awaiting send approval.',
  '{"agent_slug":"sales","risk_level":"medium","action":"send_follow_up_email"}'::jsonb,
  0, 0, null,
  '2026-08-22 10:00:00+00', null, '2026-08-22 10:00:00+00'
)
on conflict (id) do nothing;
