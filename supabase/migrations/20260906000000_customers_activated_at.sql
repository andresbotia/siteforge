-- M10 fulfillment follow-up: there is currently no operator-facing way to
-- move a customer from pending_setup to active (the manual "domain
-- registered, DNS pointed, site deployed" confirmation) except a direct
-- table edit. This column records when that manual confirmation happened,
-- so it can be shown next to the "Mark site live" action. It records a
-- fact the operator asserts by clicking a button -- it is not, and must
-- never become, a signal derived from real deployment/DNS state, since no
-- such automation exists (see AGENTS.md: no production deployment or DNS
-- action).
alter table public.customers
  add column if not exists activated_at timestamptz;
