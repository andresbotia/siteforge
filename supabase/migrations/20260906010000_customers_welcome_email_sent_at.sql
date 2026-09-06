-- M10 fulfillment follow-up: the one-time "welcome" email sent once a
-- customer's site is confirmed live. `welcome_email_sent_at` is the
-- timestamp guard that makes the send action non-repeatable (mirrors
-- `activated_at`, added in 20260906000000). `production_url` already
-- existed on this table (initial schema) but had no real writer anywhere in
-- the codebase; the welcome-email send action is the first thing that
-- actually populates it, from the URL the operator enters when sending.
alter table public.customers
  add column if not exists welcome_email_sent_at timestamptz;
