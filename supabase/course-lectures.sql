-- Add public lecture libraries to the three learnByAnkit courses.
-- Run after setup.sql in Supabase SQL Editor.

create table if not exists public.course_lectures (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (course_id in ('web', 'math', 'science')),
  title text not null check (char_length(title) between 1 and 140),
  lecture_type text not null check (lecture_type in ('video', 'pdf')),
  file_path text not null unique,
  file_name text not null,
  content_type text not null check (content_type in ('application/pdf', 'video/mp4', 'video/webm')),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint course_lecture_owner_path check (
    split_part(file_path, '/', 1) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'
    and split_part(file_path, '/', 2) = course_id
  )
);

create index if not exists course_lectures_course_created_at_idx
  on public.course_lectures (course_id, created_at, id);
create index if not exists course_lectures_created_by_idx
  on public.course_lectures (created_by);

grant usage on schema public to anon, authenticated;
grant select on public.course_lectures to anon, authenticated;
grant insert, update, delete on public.course_lectures to authenticated;
alter table public.course_lectures enable row level security;

drop policy if exists "Anyone can view course lectures" on public.course_lectures;
create policy "Anyone can view course lectures" on public.course_lectures
for select to anon, authenticated
using (true);

drop policy if exists "LearnByAnkit owner can add course lectures" on public.course_lectures;
create policy "LearnByAnkit owner can add course lectures" on public.course_lectures
for insert to authenticated
with check (
  (select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid
  and created_by = (select auth.uid())
);

drop policy if exists "LearnByAnkit owner can edit course lectures" on public.course_lectures;
create policy "LearnByAnkit owner can edit course lectures" on public.course_lectures
for update to authenticated
using ((select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid)
with check (
  (select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid
  and created_by = (select auth.uid())
);

drop policy if exists "LearnByAnkit owner can remove course lectures" on public.course_lectures;
create policy "LearnByAnkit owner can remove course lectures" on public.course_lectures
for delete to authenticated
using ((select auth.uid()) = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'::uuid);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-materials', 'course-materials', true, 52428800, array['application/pdf', 'video/mp4', 'video/webm'])
on conflict (id) do update
set public = true,
    file_size_limit = 52428800,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "LearnByAnkit owner can upload course materials" on storage.objects;
create policy "LearnByAnkit owner can upload course materials" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'
  and (storage.foldername(name))[2] in ('web', 'math', 'science')
);

drop policy if exists "LearnByAnkit owner can remove course materials" on storage.objects;
create policy "LearnByAnkit owner can remove course materials" on storage.objects
for delete to authenticated
using (
  bucket_id = 'course-materials'
  and (storage.foldername(name))[1] = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c'
  and (storage.foldername(name))[2] in ('web', 'math', 'science')
);

