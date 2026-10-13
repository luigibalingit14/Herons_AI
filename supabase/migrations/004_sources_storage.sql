insert into storage.buckets (id, name, public)
values ('sources', 'sources', false)
on conflict (id) do update set public = false;

drop policy if exists "source files read own" on storage.objects;
drop policy if exists "source files upload own" on storage.objects;
drop policy if exists "source files delete own" on storage.objects;

create policy "source files read own" on storage.objects for select
using (bucket_id = 'sources' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "source files upload own" on storage.objects for insert
with check (bucket_id = 'sources' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "source files delete own" on storage.objects for delete
using (bucket_id = 'sources' and auth.uid()::text = (storage.foldername(name))[1]);
