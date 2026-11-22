-- Sequence Terminal: member profiles and the Feed.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Members must be signed in to read anything; each member can only change
-- their own profile, their own posts and their own images.
-- Profiles are created with the account (from the sign-up form's details).
-- Feed posts are deleted automatically 48 hours after they are published.

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

-- Create the profile row when someone signs up, from the sign-up form's details.
-- (The photo and logo are uploaded by the app on the member's first sign-in.)
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r text := meta ->> 'role';
begin
  insert into public.profiles (id, name, role, company, title, email, whatsapp)
  values (
    new.id,
    left(coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Member'), 80),
    case when r in ('Agent', 'Investor', 'Brokerage') then r else 'Agent' end,
    left(coalesce(trim(meta ->> 'company'), ''), 120),
    nullif(left(trim(coalesce(meta ->> 'title', '')), 80), ''),
    left(new.email, 160),
    nullif(left(trim(coalesce(meta ->> 'whatsapp', '')), 40), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_member();

-- Only the trigger runs this; nobody can call it through the API.
revoke all on function public.handle_new_member() from public, anon, authenticated;

-- Feed posts --------------------------------------------------------------
create table if not exists public.feed_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('Update', 'Off-market', 'For sale', 'Buyer request', 'For rent', 'Partnership')),
  title       text not null check (char_length(title) between 6 and 90),
  body        text not null check (char_length(body) between 20 and 600),
  price_usd   numeric check (price_usd > 0),
  district    text check (char_length(district) <= 60),
  listing_id  text check (char_length(listing_id) <= 40), -- a Terminal listing attached to the post
  created_at  timestamptz not null default now()
);

create index if not exists feed_posts_created_at_idx on public.feed_posts (created_at desc);

alter table public.feed_posts enable row level security;

-- Only posts from the last 48 hours are visible, even before the cleanup job runs.
create policy "Members can read the feed"
  on public.feed_posts for select to authenticated using (created_at > now() - interval '48 hours');
create policy "Members post as themselves"
  on public.feed_posts for insert to authenticated with check (auth.uid() = author_id);
create policy "Members delete their own posts"
  on public.feed_posts for delete to authenticated using (auth.uid() = author_id);

-- Delete posts older than 48 hours, every 15 minutes (Supabase pg_cron).
create extension if not exists pg_cron;
select cron.schedule(
  'feed-posts-expire-48h',
  '*/15 * * * *',
  $$delete from public.feed_posts where created_at < now() - interval '48 hours'$$
);

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
