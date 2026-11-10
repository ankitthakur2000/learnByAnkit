-- LearnNest backend setup for Supabase
-- Paste this entire file into Supabase Dashboard > SQL Editor > New query, then Run.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  title text not null check (char_length(title) between 1 and 140),
  subject text not null check (char_length(subject) between 1 and 80),
  file_path text not null unique check (split_part(file_path, '/', 1) = user_id::text),
  file_name text not null,
  file_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notes_created_at_idx on public.notes (created_at desc);
create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists notes_public_created_at_idx on public.notes (is_public, created_at desc) where is_public = true;

grant usage on schema public to anon, authenticated;
alter table public.notes enable row level security;
revoke all on public.notes from anon;
grant select, insert, update, delete on public.notes to authenticated;
grant insert, update, delete on public.notes to authenticated;

drop policy if exists "Anyone can view shared notes" on public.notes;
drop policy if exists "Owners can view their own notes" on public.notes;
drop policy if exists "Read shared or own notes" on public.notes;
drop policy if exists "LearnNest learners can view published notes" on public.notes;
create policy "LearnNest learners can view published notes" on public.notes
for select to authenticated
using (is_public = true or (select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid);

drop policy if exists "Signed in users can add their own notes" on public.notes;
drop policy if exists "LearnNest owner can add notes" on public.notes;
create policy "LearnNest owner can add notes" on public.notes
for insert to authenticated
with check ((select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid);

drop policy if exists "Owners can edit their own notes" on public.notes;
drop policy if exists "LearnNest owner can edit notes" on public.notes;
create policy "LearnNest owner can edit notes" on public.notes
for update to authenticated
using ((select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid)
with check ((select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid);

drop policy if exists "Owners can delete their own notes" on public.notes;
drop policy if exists "LearnNest owner can delete notes" on public.notes;
create policy "LearnNest owner can delete notes" on public.notes
for delete to authenticated
using ((select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid);

update public.notes set is_public = true
where user_id = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-notes', 'study-notes', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = 26214400, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can upload note files" on storage.objects;
drop policy if exists "LearnNest owner can upload note files" on storage.objects;
create policy "LearnNest owner can upload note files" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'study-notes'
  and (storage.foldername(name))[1] = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'
);

drop policy if exists "Owners and everyone can read permitted note files" on storage.objects;
drop policy if exists "Signed in learners can read published note files" on storage.objects;
create policy "Signed in learners can read published note files" on storage.objects
for select to authenticated
using (
  bucket_id = 'study-notes'
  and exists (
    select 1
    from public.notes as n
    where n.file_path = storage.objects.name
      and (n.is_public = true or (select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid)
  )
);

drop policy if exists "Owners can delete note files" on storage.objects;
drop policy if exists "LearnNest owner can delete note files" on storage.objects;
create policy "LearnNest owner can delete note files" on storage.objects
for delete to authenticated
using (
  bucket_id = 'study-notes'
  and (storage.foldername(name))[1] = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'
);

