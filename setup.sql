-- Run in Supabase SQL Editor. IMPORTANT: first invite exactly three users
-- in Authentication > Users > Invite user, then insert their UUIDs below.
create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50)
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.members(id),
  title text not null check (char_length(title) between 1 and 100),
  caption text not null default '' check (char_length(caption) <= 3000),
  memory_date date not null,
  created_at timestamptz not null default now()
);
create table if not exists public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id),
  storage_path text not null unique,
  sort_order integer not null check (sort_order between 0 and 11),
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.members(id),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create or replace function public.is_member() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.members where id=(select auth.uid()));
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;
alter table public.members enable row level security;
alter table public.posts enable row level security;
alter table public.post_photos enable row level security;
alter table public.messages enable row level security;
create policy "members can see members" on public.members for select to authenticated using (public.is_member());
create policy "members can read posts" on public.posts for select to authenticated using (public.is_member());
create policy "members can add posts as self" on public.posts for insert to authenticated with check (public.is_member() and author_id=(select auth.uid()));
create policy "members can read photos" on public.post_photos for select to authenticated using (public.is_member());
create policy "members can add photos to own posts" on public.post_photos for insert to authenticated with check (public.is_member() and exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid()) and storage_path like (auth.uid()::text || '/' || p.id::text || '/%')));
create policy "members can read messages" on public.messages for select to authenticated using (public.is_member());
create policy "members can send messages as self" on public.messages for insert to authenticated with check (public.is_member() and author_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('memories','memories',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create policy "members can view memory files" on storage.objects for select to authenticated using (bucket_id='memories' and public.is_member());
create policy "members can upload memory files" on storage.objects for insert to authenticated with check (bucket_id='memories' and public.is_member() and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Enable realtime for new posts, photos and chat messages.
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_photos;
alter publication supabase_realtime add table public.messages;

-- AFTER inviting your 3 friends, run this with their actual Auth user UUIDs:
-- insert into public.members (id,display_name) values
-- ('UUID_OF_FRIEND_1','朋友一'),
-- ('UUID_OF_FRIEND_2','朋友二'),
-- ('UUID_OF_FRIEND_3','朋友三');
-- Only these three UUIDs will have access. Do not create other member rows.
