-- Milestone 3: paid AI cost controls.
--
-- Authoritative money unit is integer ticks.
--   1 USD = 10_000_000_000 ticks (xAI cost_in_usd_ticks).
-- Numeric USD columns remain for display/legacy only.
--
-- Functions are INVOKER rights (not SECURITY DEFINER).
-- Execute is revoked from anon, authenticated, and public.
-- SiteForge calls them only via the server secret key (service_role).
--
-- Stale reservations: if a process dies after reserve and before finalize,
-- the reserved row stays until an operator calls siteforge_finalize_ai_run
-- or updates ai_budget_reservations. No background cleanup job in this
-- milestone.

alter table public.agent_runs drop constraint if exists agent_runs_status_check;
alter table public.agent_runs
  add constraint agent_runs_status_check check (
    status in (
      'queued',
      'draft',
      'awaiting_approval',
      'approved',
      'running',
      'succeeded',
      'completed',
      'failed',
      'rejected',
      'budget_blocked',
      'cancelled'
    )
  );

alter table public.agent_runs
  add column if not exists provider text,
  add column if not exists purpose text,
  add column if not exists failure_reason text,
  add column if not exists estimated_cost_ticks bigint not null default 0 check (estimated_cost_ticks >= 0),
  add column if not exists approved_cost_limit_ticks bigint not null default 0 check (approved_cost_limit_ticks >= 0),
  add column if not exists actual_cost_ticks bigint not null default 0 check (actual_cost_ticks >= 0),
  add column if not exists usage_metadata jsonb not null default '{}'::jsonb,
  add column if not exists execution_nonce bigint not null default 0;

alter table public.agent_tool_calls
  add column if not exists provider text,
  add column if not exists estimated_cost_ticks bigint not null default 0 check (estimated_cost_ticks >= 0),
  add column if not exists actual_cost_ticks bigint not null default 0 check (actual_cost_ticks >= 0),
  add column if not exists started_at timestamptz;

alter table public.approvals
  add column if not exists requested_cost_ticks bigint not null default 0 check (requested_cost_ticks >= 0),
  add column if not exists approved_cost_limit_ticks bigint not null default 0 check (approved_cost_limit_ticks >= 0),
  add column if not exists actual_cost_ticks bigint not null default 0 check (actual_cost_ticks >= 0),
  add column if not exists resolved_by text;

create table if not exists public.ai_budget_limits (
  id integer primary key check (id = 1),
  daily_limit_ticks bigint not null check (daily_limit_ticks >= 0),
  monthly_limit_ticks bigint not null check (monthly_limit_ticks >= 0),
  per_run_ceiling_ticks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.ai_budget_limits (
  id, daily_limit_ticks, monthly_limit_ticks, per_run_ceiling_ticks
) values (
  1,
  10000000000,
  100000000000,
  '{"scout":2500000000,"auditor":1000000000,"builder":5000000000,"sales":1000000000,"manager":1000000000}'::jsonb
) on conflict (id) do nothing;

create table if not exists public.ai_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null unique references public.agent_runs (id) on delete cascade,
  approval_id uuid references public.approvals (id) on delete set null,
  reserved_ticks bigint not null check (reserved_ticks > 0),
  status text not null check (status in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  actual_cost_ticks bigint not null default 0 check (actual_cost_ticks >= 0)
);

create index if not exists ai_budget_reservations_status_idx
  on public.ai_budget_reservations (status);

alter table public.ai_budget_limits enable row level security;
alter table public.ai_budget_reservations enable row level security;

revoke all on table public.ai_budget_limits from anon, authenticated, public;
revoke all on table public.ai_budget_reservations from anon, authenticated, public;

grant select, insert, update, delete on table public.ai_budget_limits to service_role;
grant select, insert, update, delete on table public.ai_budget_reservations to service_role;

create or replace function public.siteforge_reserve_ai_run(p_run_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_run public.agent_runs%rowtype;
  v_approval public.approvals%rowtype;
  v_limits public.ai_budget_limits%rowtype;
  v_existing public.ai_budget_reservations%rowtype;
  v_agent_slug text;
  v_ceiling bigint;
  v_day_start timestamptz;
  v_month_start timestamptz;
  v_actual_day bigint;
  v_actual_month bigint;
  v_reserved bigint;
  v_request bigint;
begin
  -- Serialize all budget mutations for this process.
  perform pg_advisory_xact_lock(8726341);

  select * into v_run from public.agent_runs where id = p_run_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'run_not_found');
  end if;

  if v_run.status in ('succeeded', 'completed') then
    return jsonb_build_object('ok', false, 'reason', 'already_completed');
  end if;

  if v_run.status = 'running' then
    select * into v_existing
    from public.ai_budget_reservations
    where agent_run_id = p_run_id and status = 'reserved';
    if found then
      return jsonb_build_object('ok', false, 'reason', 'already_running');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'illegal_state');
  end if;

  if v_run.status <> 'approved' then
    return jsonb_build_object('ok', false, 'reason', 'run_not_approved');
  end if;

  select * into v_approval
  from public.approvals
  where agent_run_id = p_run_id
    and approval_type = 'paid_ai_usage'
    and status = 'approved'
  order by resolved_at desc nulls last
  limit 1
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'approval_missing');
  end if;

  if v_run.approved_cost_limit_ticks is null
     or v_run.approved_cost_limit_ticks <= 0
     or v_approval.approved_cost_limit_ticks is null
     or v_approval.approved_cost_limit_ticks <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'approved_limit_zero');
  end if;

  -- Never reserve more than either the run or the approval authorized.
  v_request := least(
    v_run.approved_cost_limit_ticks,
    v_approval.approved_cost_limit_ticks
  );

  select a.slug into v_agent_slug from public.agents a where a.id = v_run.agent_id;
  select * into v_limits from public.ai_budget_limits where id = 1 for update;

  v_ceiling := coalesce((v_limits.per_run_ceiling_ticks ->> v_agent_slug)::bigint, 0);
  if v_ceiling > 0 and v_request > v_ceiling then
    update public.agent_runs
      set status = 'budget_blocked', failure_reason = 'per_run_ceiling'
      where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', 'per_run_ceiling');
  end if;

  v_day_start := date_trunc('day', timezone('utc', now()));
  v_month_start := date_trunc('month', timezone('utc', now()));

  select coalesce(sum(actual_cost_ticks), 0) into v_actual_day
  from public.agent_runs
  where actual_cost_ticks > 0
    and coalesce(completed_at, started_at, created_at) >= v_day_start;

  select coalesce(sum(actual_cost_ticks), 0) into v_actual_month
  from public.agent_runs
  where actual_cost_ticks > 0
    and coalesce(completed_at, started_at, created_at) >= v_month_start;

  select coalesce(sum(reserved_ticks), 0) into v_reserved
  from public.ai_budget_reservations
  where status = 'reserved';

  if v_actual_day + v_reserved + v_request > v_limits.daily_limit_ticks then
    update public.agent_runs
      set status = 'budget_blocked', failure_reason = 'daily_budget_exhausted'
      where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', 'daily_budget_exhausted');
  end if;

  if v_actual_month + v_reserved + v_request > v_limits.monthly_limit_ticks then
    update public.agent_runs
      set status = 'budget_blocked', failure_reason = 'monthly_budget_exhausted'
      where id = p_run_id;
    return jsonb_build_object('ok', false, 'reason', 'monthly_budget_exhausted');
  end if;

  insert into public.ai_budget_reservations (
    agent_run_id, approval_id, reserved_ticks, status
  ) values (
    p_run_id, v_approval.id, v_request, 'reserved'
  );

  update public.agent_runs
    set status = 'running',
        started_at = timezone('utc', now()),
        execution_nonce = execution_nonce + 1,
        failure_reason = null
    where id = p_run_id
      and status = 'approved';

  if not found then
    -- Abort the transaction so the reservation insert is not committed.
    raise exception 'siteforge_reserve_ai_run: run % lost approved status', p_run_id;
  end if;

  return jsonb_build_object('ok', true, 'reserved_ticks', v_request);
end;
$$;

create or replace function public.siteforge_finalize_ai_run(
  p_run_id uuid,
  p_success boolean,
  p_actual_ticks bigint,
  p_failure_reason text default null,
  p_usage jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_run public.agent_runs%rowtype;
  v_reservation public.ai_budget_reservations%rowtype;
  v_actual bigint;
begin
  perform pg_advisory_xact_lock(8726341);

  select * into v_run from public.agent_runs where id = p_run_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'run_not_found');
  end if;

  if v_run.status <> 'running' then
    return jsonb_build_object('ok', false, 'reason', 'not_running');
  end if;

  v_actual := greatest(coalesce(p_actual_ticks, 0), 0);

  select * into v_reservation
  from public.ai_budget_reservations
  where agent_run_id = p_run_id and status = 'reserved'
  for update;

  if found then
    update public.ai_budget_reservations
      set status = case when v_actual > 0 then 'consumed' else 'released' end,
          actual_cost_ticks = v_actual,
          finalized_at = timezone('utc', now())
      where id = v_reservation.id;
  end if;

  update public.agent_runs
    set status = case when p_success then 'succeeded' else 'failed' end,
        actual_cost_ticks = v_actual,
        actual_cost_usd = (v_actual::numeric / 10000000000::numeric),
        completed_at = timezone('utc', now()),
        failure_reason = case when p_success then null else p_failure_reason end,
        usage_metadata = coalesce(p_usage, '{}'::jsonb)
    where id = p_run_id;

  update public.approvals
    set status = case when p_success then 'executed' else status end,
        actual_cost_ticks = v_actual,
        actual_cost_usd = (v_actual::numeric / 10000000000::numeric)
    where agent_run_id = p_run_id
      and approval_type = 'paid_ai_usage';

  return jsonb_build_object('ok', true, 'actual_ticks', v_actual);
end;
$$;

revoke all on function public.siteforge_reserve_ai_run(uuid) from public, anon, authenticated;
revoke all on function public.siteforge_finalize_ai_run(uuid, boolean, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.siteforge_reserve_ai_run(uuid) to service_role;
grant execute on function public.siteforge_finalize_ai_run(uuid, boolean, bigint, text, jsonb) to service_role;

insert into public.agent_runs (
  id, agent_id, status, provider, model, purpose, trigger_type,
  estimated_cost_ticks, approved_cost_limit_ticks, estimated_cost_usd, input, output, created_at
) values (
  'd0000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'awaiting_approval',
  'xai',
  'grok-4.6',
  'Estimate copy for a fictional plumbing landing page. No live inference.',
  'manual',
  300000000,
  0,
  0.03,
  '{"input_tokens":1200,"max_output_tokens":800}'::jsonb,
  '{}'::jsonb,
  timezone('utc', now())
) on conflict (id) do nothing;

insert into public.approvals (
  id, agent_run_id, approval_type, status, title, description, payload,
  estimated_cost_usd, requested_cost_ticks, approved_cost_limit_usd, approved_cost_limit_ticks,
  requested_at, created_at
) values (
  'e0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'paid_ai_usage',
  'pending',
  'Authorize paid xAI usage for Scout copy estimate',
  'No inference will run until a human approves a maximum spend. This is a development sample. Approving authorizes a dollar ceiling only; it does not call xAI.',
  '{"agent_slug":"scout","risk_level":"medium","model":"grok-4.6","purpose":"Estimate copy for a fictional plumbing landing page. No live inference.","estimated_cost_ticks":300000000,"requested_cost_ticks":1000000000}'::jsonb,
  0.03,
  1000000000,
  null,
  0,
  timezone('utc', now()),
  timezone('utc', now())
) on conflict (id) do nothing;
