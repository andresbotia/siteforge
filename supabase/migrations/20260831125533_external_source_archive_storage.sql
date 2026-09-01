-- Store imported external source ZIP archives privately. Application-table
-- metadata remains in public.external_site_artifacts; archive bytes stay in
-- Supabase Storage and are accessed only by backend service-role code.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'external-site-artifacts',
  'external-site-artifacts',
  false,
  10000000,
  array['application/zip', 'application/x-zip-compressed']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
