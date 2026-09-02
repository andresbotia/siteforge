-- M9.7 customer purchase experience: opaque public purchase links for an
-- approved commercial offer, following the same hash+hint philosophy
-- already used for preview/outreach tokens (see
-- 20260830000000_preview_deployments_tracking.sql). Additive only: new
-- nullable columns, no data rewritten, no destructive change, RLS/grants
-- on public.commercial_offers are unchanged (already revoked from
-- anon/authenticated/public in 20260830142525_stripe_customer_conversion.sql).
--
-- Only a hash + short hint is stored, never the raw token -- the raw token
-- is shown to the admin exactly once at publish time and is not
-- recoverable afterward (matching preview_deployments.token_hash/token_hint).

alter table public.commercial_offers
  add column if not exists purchase_token_hash text,
  add column if not exists purchase_token_hint text,
  add column if not exists purchase_link_published_at timestamptz,
  add column if not exists purchase_link_revoked_at timestamptz;

create unique index if not exists commercial_offers_purchase_token_hash_idx
  on public.commercial_offers (purchase_token_hash)
  where purchase_token_hash is not null;
