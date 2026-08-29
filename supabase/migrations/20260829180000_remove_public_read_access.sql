-- Remove public Data API read access from application tables.
-- RLS stays enabled. No write policies are added.
-- Server-side reads use SUPABASE_SECRET_KEY (service_role), which bypasses RLS.
-- Existing rows are preserved.

drop policy if exists leads_select_authenticated_or_anon on public.leads;
drop policy if exists website_audits_select_authenticated_or_anon on public.website_audits;
drop policy if exists generated_websites_select_authenticated_or_anon on public.generated_websites;
drop policy if exists agents_select_authenticated_or_anon on public.agents;
drop policy if exists agent_runs_select_authenticated_or_anon on public.agent_runs;
drop policy if exists agent_tool_calls_select_authenticated_or_anon on public.agent_tool_calls;
drop policy if exists approvals_select_authenticated_or_anon on public.approvals;
drop policy if exists outreach_select_authenticated_or_anon on public.outreach;
drop policy if exists outreach_events_select_authenticated_or_anon on public.outreach_events;
drop policy if exists customers_select_authenticated_or_anon on public.customers;
drop policy if exists subscriptions_select_authenticated_or_anon on public.subscriptions;
drop policy if exists integration_status_select_authenticated_or_anon on public.integration_status;
drop policy if exists activity_events_select_authenticated_or_anon on public.activity_events;

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
