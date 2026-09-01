-- M9.6: allow external_site_artifacts.provider to record local Designer
-- Worker output (Claude Code today, a future Grok worker later), in addition
-- to the existing manual/Lovable/other import paths. Additive, widens an
-- existing check constraint only; no data migration needed.

alter table public.external_site_artifacts
  drop constraint if exists external_site_artifacts_provider_check;

alter table public.external_site_artifacts
  add constraint external_site_artifacts_provider_check
  check (provider in ('lovable', 'manual', 'claude_code_worker', 'grok_worker', 'other'));
