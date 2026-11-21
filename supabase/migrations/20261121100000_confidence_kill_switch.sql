-- Terminal: Confidence Score + Kill Switch.
-- Run once in the Supabase SQL editor (or `supabase db push`), after
-- 20261121000000_profiles_feed.sql.
--
-- property_master   one row per scraped listing. The scraper writes it with
--                   the service role; members can only read active rows.
-- confidence_score  0-100, overwritten nightly by scripts/confidence_score.py.
-- property_flags    every "Flag delisted" click, with the member's user id.
-- flag_delisted()   the Kill Switch RPC: log the flag, archive the listing,
--                   force its score to 0. One transaction.

-- Listings ----------------------------------------------------------------
create table if not exists public.property_master (
  listing_id            text primary key,
  market_id             text not null default 'aw-lux',
  category              text not null check (category in ('Property', 'Land', 'Commercial')),
  asset_name            text not null,
  district              text,
  source                text not null,                -- agency name
  source_url            text,                         -- the listing's page on the agency site
  asking_price_usd      numeric check (asking_price_usd > 0),
  first_seen            date not null default current_date,
  days_on_market        integer not null default 0,
  last_price_change_at  timestamptz,                  -- null = price never changed since first_seen
  last_scraped_at       timestamptz not null default now(), -- last time the scraper FOUND it on the source site
  status                text not null default 'active' check (status in ('active', 'archived')),
  confidence_score      smallint not null default 100 check (confidence_score between 0 and 100),
  confidence_updated_at timestamptz,
  archived_at           timestamptz,
  archived_by           uuid references auth.users (id) on delete set null,
  data                  jsonb not null default '{}'::jsonb -- everything else the scraper captures
);

create index if not exists property_master_market_idx on public.property_master (market_id, status, confidence_score);

alter table public.property_master enable row level security;

-- Master Market view: members only ever see active listings with a score above 0.
-- No insert/update/delete policies: only the scraper and the nightly job
-- (service role) and the security-definer functions below write here.
create policy "Members read the master market"
  on public.property_master for select to authenticated
  using (status = 'active' and confidence_score > 0);

-- Flags -------------------------------------------------------------------
create table if not exists public.property_flags (
  id              bigint generated always as identity primary key,
  listing_id      text not null references public.property_master (listing_id) on delete cascade,
  flagged_by      uuid not null references auth.users (id) on delete cascade,
  reason          text not null check (reason in ('sold', 'off_market', 'ghost', 'duplicate')),
  note            text check (char_length(note) <= 280),
  previous_status text not null,
  previous_score  smallint not null,
  created_at      timestamptz not null default now(),
  undone_at       timestamptz,
  -- Set by the nightly job when the scraper still finds the listing live on
  -- its source site after it was flagged: a flag worth reviewing.
  disputed        boolean not null default false
);

create index if not exists property_flags_listing_idx on public.property_flags (listing_id);
create index if not exists property_flags_member_idx on public.property_flags (flagged_by, created_at desc);

alter table public.property_flags enable row level security;

-- Members see their own flags only. Writes go through the RPCs.
create policy "Members read their own flags"
  on public.property_flags for select to authenticated using (flagged_by = auth.uid());

-- Kill Switch ---------------------------------------------------------------
create or replace function public.flag_delisted(p_listing_id text, p_reason text, p_note text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur record;
begin
  if uid is null then
    raise exception 'Log in to flag listings.';
  end if;

  if p_reason not in ('sold', 'off_market', 'ghost', 'duplicate') then
    raise exception 'Unknown reason.';
  end if;

  -- Guard against abuse (e.g. flagging a competitor's live deals): every flag
  -- is tied to the member, and nobody can flag more than 10 listings a day.
  if (select count(*) from public.property_flags f
      where f.flagged_by = uid and f.created_at > now() - interval '24 hours' and f.undone_at is null) >= 10 then
    raise exception 'Daily limit reached: you can flag up to 10 listings a day. Email us if more are wrong.';
  end if;

  select status, confidence_score into cur
    from public.property_master where listing_id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if cur.status = 'archived' then
    return; -- someone already removed it
  end if;

  -- 1. log who flagged it
  insert into public.property_flags (listing_id, flagged_by, reason, note, previous_status, previous_score)
  values (p_listing_id, uid, p_reason, nullif(left(trim(coalesce(p_note, '')), 280), ''), cur.status, cur.confidence_score);

  -- 2. archive it and 3. force the score to 0: gone from the Master Market for everyone
  update public.property_master
     set status = 'archived', confidence_score = 0, archived_at = now(), archived_by = uid
   where listing_id = p_listing_id;
end;
$$;

-- The member who flagged a listing can undo it for 15 minutes.
create or replace function public.undo_flag(p_listing_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  f record;
begin
  select id, previous_status, previous_score, created_at into f
    from public.property_flags
   where listing_id = p_listing_id and flagged_by = uid and undone_at is null
   order by created_at desc limit 1
   for update;
  if not found then
    raise exception 'No flag of yours to undo on this listing.';
  end if;
  if f.created_at < now() - interval '15 minutes' then
    raise exception 'The undo window has passed. Email us to restore this listing.';
  end if;

  update public.property_flags set undone_at = now() where id = f.id;
  update public.property_master
     set status = f.previous_status, confidence_score = f.previous_score, archived_at = null, archived_by = null
   where listing_id = p_listing_id and archived_by = uid;
end;
$$;

revoke all on function public.flag_delisted(text, text, text) from public, anon;
revoke all on function public.undo_flag(text) from public, anon;
grant execute on function public.flag_delisted(text, text, text) to authenticated;
grant execute on function public.undo_flag(text) to authenticated;

-- For review in the Supabase dashboard: who flags what, and which flags the
-- scraper disagrees with.
create or replace view public.v_flag_review
with (security_invoker = true) as
select f.created_at, f.listing_id, p.asset_name, p.source, f.reason, f.note, f.disputed, f.undone_at,
       f.flagged_by, pr.name as flagged_by_name, pr.company as flagged_by_company,
       count(*) over (partition by f.flagged_by) as member_flag_count
  from public.property_flags f
  join public.property_master p using (listing_id)
  left join public.profiles pr on pr.id = f.flagged_by;

revoke all on public.v_flag_review from anon, authenticated;
