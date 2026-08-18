-- Question images: hosts upload in the editor; live rooms read via public URL.
-- Run in the Supabase SQL editor after schema.sql.

insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Hosts can upload question media" on storage.objects;
create policy "Hosts can upload question media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'question-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Hosts can update own question media" on storage.objects;
create policy "Hosts can update own question media"
on storage.objects for update to authenticated
using (
  bucket_id = 'question-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Hosts can delete own question media" on storage.objects;
create policy "Hosts can delete own question media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'question-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Anyone can read question media" on storage.objects;
create policy "Anyone can read question media"
on storage.objects for select
using (bucket_id = 'question-media');
