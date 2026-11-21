-- Sequence Terminal: member profiles and the Feed.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Members must be signed in to read anything; each member can only change
-- their own profile, their own posts and their own images.

-- Profiles ----------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  role        text not null default 'Agent' check (role in ('Agent', 'Investor', 'Brokerage')),
  company     text not null default '' check (char_length(company) <= 120),
  title       text check (char_length(title) <= 80),
  email       text check (char_length(email) <= 160),
  phone       text check (char_length(phone) <= 40),
  whatsapp    text check (char_length(whatsapp) <= 40),
  photo_url   text,
  logo_url    text,
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Members can read profiles"
  on public.profiles for select to authenticated using (true);
create policy "Members create their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Members update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Feed posts --------------------------------------------------------------
create table if not exists public.feed_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('Off-market', 'For sale', 'Buyer request', 'For rent', 'Partnership')),
  title       text not null check (char_length(title) between 6 and 90),
  body        text not null check (char_length(body) between 20 and 600),
  price_usd   numeric check (price_usd > 0),
  district    text check (char_length(district) <= 60),
  created_at  timestamptz not null default now()
);

create index if not exists feed_posts_created_at_idx on public.feed_posts (created_at desc);

alter table public.feed_posts enable row level security;

create policy "Members can read the feed"
  on public.feed_posts for select to authenticated using (true);
create policy "Members post as themselves"
  on public.feed_posts for insert to authenticated with check (auth.uid() = author_id);
create policy "Members delete their own posts"
  on public.feed_posts for delete to authenticated using (auth.uid() = author_id);

-- Profile photos and company logos ----------------------------------------
-- Public bucket so images load without signed URLs; uploads are limited to
-- each member's own folder (<user id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Members upload to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Members replace their own images"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Members delete their own images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
