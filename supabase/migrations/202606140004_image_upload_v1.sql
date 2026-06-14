insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read chat attachments" on storage.objects;
create policy "Public read chat attachments"
on storage.objects
for select
using (bucket_id = 'chat-attachments');

drop policy if exists "Service role manages chat attachments" on storage.objects;
create policy "Service role manages chat attachments"
on storage.objects
for all
to service_role
using (bucket_id = 'chat-attachments')
with check (bucket_id = 'chat-attachments');
