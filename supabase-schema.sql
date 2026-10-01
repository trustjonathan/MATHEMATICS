-- Storage bucket used by upload-study-hub.mjs.
-- Public access is appropriate for resources intended to be downloadable by site visitors.
insert into storage.buckets (id, name, public)
values ('study-hub-resources', 'study-hub-resources', true)
on conflict (id) do update
set public = excluded.public;

-- Allow visitors to list resource objects. Public buckets already allow file downloads.
drop policy if exists "Public can read study hub resources" on storage.objects;
create policy "Public can read study hub resources"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'study-hub-resources');

-- Live catalog of files uploaded under documents/math/notes/ or documents/math/papers/.
create or replace view public.study_resources
with (security_invoker = true)
as
select
  objects.id,
  split_part(objects.name, '/', 4) as file_name,
  split_part(objects.name, '/', 3) as category,
  objects.name as storage_path,
  nullif(objects.metadata ->> 'mimetype', '') as content_type,
  nullif(objects.metadata ->> 'size', '')::bigint as size_bytes,
  objects.created_at,
  objects.updated_at
from storage.objects as objects
where objects.bucket_id = 'study-hub-resources'
  and objects.name like 'documents/math/%'
  and split_part(objects.name, '/', 3) in ('notes', 'papers');

grant select on public.study_resources to anon, authenticated;