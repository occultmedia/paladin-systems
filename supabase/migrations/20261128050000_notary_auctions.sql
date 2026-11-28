-- ════════════════════════════════════════════════════════════════════════
-- Notary auctions and "Track auction date" (Baseline Pro, 28 November 2026)
--
--   notary_auctions        upcoming foreclosure and voluntary auctions (and
--                          tenders) from Aruba's five civil-law notary offices,
--                          indexed nightly by scraper/terminal_spider/notary/.
--   notary_auction_events  what changed (listed, new date, new status, removed),
--                          so alerts can say what happened.
--   tracked_auctions       a member's tracked auctions and alert choices.
--   auction_alerts         reminders and change notices, queued by the nightly
--                          check and sent by e-mail (Resend) once configured.
--
-- Pro only: members see auctions and track them when app_metadata.plan = 'pro'
-- (set by the server, see src/lib/plan.ts). The service role writes.
-- Nothing personal is stored: PDF texts are read for the property facts only.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.is_pro()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'plan') = 'pro', false)
$$;

-- 1. The auctions ----------------------------------------------------------------
create table public.notary_auctions (
  id                       uuid primary key default gen_random_uuid(),
  -- one auction, however often it changes: hash of the office and its page (and title on one-page sites)
  auction_key              text not null unique,
  -- hash of everything read from the notice; a new value means the notice changed
  content_hash             text not null,

  notary_office            text not null check (notary_office in
                             ('Johnson Notary Services', 'NewLeaf Notary', 'Notary Yarzagaray', 'Notaris Tromp', 'Notaris Helmeyer')),
  notary_slug              text not null,
  source_url               text not null,
  pdf_brochure_url         text,                    -- the auction or special conditions PDF
  documents                jsonb not null default '[]', -- [{label, url}] every PDF the notice links to

  title                    text not null check (char_length(title) between 1 and 300),
  address                  text,
  district                 text check (district in ('Oranjestad', 'Noord', 'Santa Cruz', 'Savaneta', 'San Nicolas', 'Paradera')),
  area                     text,                    -- Baseline's finer map district (Palm Beach, Eagle Beach...)
  property_type            text check (property_type in ('Residential House', 'Commercial', 'Land / Kavel', 'Condo')),
  land_tenure              text check (land_tenure in ('Eigendom', 'Erfpacht')),
  kadaster_id              text,                    -- e.g. "1-P-621" (division-section-number)
  land_m2                  integer check (land_m2 > 0),

  sale_type                text not null default 'public_auction' check (sale_type in ('public_auction', 'voluntary_auction', 'tender')),
  auction_date             timestamptz,             -- America/Aruba wall time, stored as an instant
  auction_place            text,
  private_bids_allowed     boolean,
  private_bid_deadline     timestamptz,
  private_bid_deadline_estimated boolean not null default false, -- true = auction date minus 14 days, not stated
  starting_bid_awg         numeric(14, 2) check (starting_bid_awg > 0),
  starting_bid_usd         numeric(14, 2) generated always as (round(starting_bid_awg / 1.79, 2)) stored, -- the florin is pegged

  status                   text not null default 'upcoming'
                             check (status in ('upcoming', 'suspended_private_bid', 'postponed_or_cancelled', 'completed')),
  status_changed_at        timestamptz,
  previous_auction_date    timestamptz,
  auction_date_changed_at  timestamptz,

  lat                      double precision check (lat between 12.3 and 12.7),
  lng                      double precision check (lng between -70.2 and -69.8),
  pin_source               text check (pin_source in ('mapbox', 'listing', 'district')),
  geocoded_address         text,                    -- the address the pin was found for (re-geocode when it changes)

  first_seen_at            timestamptz not null default now(),
  last_seen_at             timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint notary_auctions_pin check ((lat is null) = (lng is null))
);
create trigger notary_auctions_updated_at before update on public.notary_auctions
  for each row execute function public.set_updated_at();

create index notary_auctions_date_idx on public.notary_auctions (auction_date) where status in ('upcoming', 'suspended_private_bid');
create index notary_auctions_status_idx on public.notary_auctions (status, auction_date);
create index notary_auctions_office_idx on public.notary_auctions (notary_slug);

-- 2. What changed -----------------------------------------------------------------
create table public.notary_auction_events (
  id          bigint generated always as identity primary key,
  auction_id  uuid not null references public.notary_auctions (id) on delete cascade,
  event       text not null check (event in ('listed', 'date_changed', 'status_changed', 'removed', 'relisted')),
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index notary_auction_events_auction_idx on public.notary_auction_events (auction_id, created_at);
create index notary_auction_events_day_idx on public.notary_auction_events (created_at);

-- Stamp status and date changes on the row, log them as events.
create or replace function public.notary_auctions_track_changes()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notary_auction_events (auction_id, event, new_value) values (new.id, 'listed', new.status);
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.notary_auction_events (auction_id, event, old_value, new_value) values (new.id, 'status_changed', old.status, new.status);
  end if;
  if new.auction_date is distinct from old.auction_date and old.auction_date is not null then
    insert into public.notary_auction_events (auction_id, event, old_value, new_value)
    values (new.id, 'date_changed', old.auction_date::text, new.auction_date::text);
  end if;
  return null;
end;
$$;
create or replace function public.notary_auctions_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      new.status_changed_at := now();
    end if;
    if new.auction_date is distinct from old.auction_date and old.auction_date is not null then
      new.previous_auction_date := old.auction_date;
      new.auction_date_changed_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger notary_auctions_stamp before insert or update on public.notary_auctions
  for each row execute function public.notary_auctions_stamp();
create trigger notary_auctions_events after insert or update of status, auction_date on public.notary_auctions
  for each row execute function public.notary_auctions_track_changes();

-- 3. Tracking -------------------------------------------------------------------
create table public.tracked_auctions (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  auction_id                  uuid not null references public.notary_auctions (id) on delete cascade,
  notify_private_bid_deadline boolean not null default true,
  notify_7d_before            boolean not null default true,
  notify_24h_before           boolean not null default true,
  notify_status_change        boolean not null default true,
  user_notes                  text check (char_length(user_notes) <= 2000),
  created_at                  timestamptz not null default now(),
  unique (user_id, auction_id)
);
create index tracked_auctions_auction_idx on public.tracked_auctions (auction_id);

-- 4. Alerts ---------------------------------------------------------------------
create table public.auction_alerts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  auction_id  uuid not null references public.notary_auctions (id) on delete cascade,
  kind        text not null check (kind in ('private_bid_deadline', 'auction_7d', 'auction_24h', 'status_change', 'date_change')),
  ref         text not null default '',      -- what it is about (an event id, a date), so each alert is sent once
  subject     text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  attempts    smallint not null default 0,
  last_error  text,
  unique (user_id, auction_id, kind, ref)
);
create index auction_alerts_unsent_idx on public.auction_alerts (created_at) where sent_at is null;

-- 5. Access ---------------------------------------------------------------------
alter table public.notary_auctions enable row level security;
alter table public.notary_auction_events enable row level security;
alter table public.tracked_auctions enable row level security;
alter table public.auction_alerts enable row level security;

create policy "Pro members read auctions" on public.notary_auctions for select to authenticated using (public.is_pro());
create policy "Pro members read auction changes" on public.notary_auction_events for select to authenticated using (public.is_pro());

create policy "Members read their tracked auctions" on public.tracked_auctions for select to authenticated
  using (user_id = auth.uid());
create policy "Pro members track auctions" on public.tracked_auctions for insert to authenticated
  with check (user_id = auth.uid() and public.is_pro());
create policy "Members edit their tracked auctions" on public.tracked_auctions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Members stop tracking" on public.tracked_auctions for delete to authenticated
  using (user_id = auth.uid());

create policy "Members read their auction alerts" on public.auction_alerts for select to authenticated using (user_id = auth.uid());

revoke all on public.notary_auctions, public.notary_auction_events, public.tracked_auctions, public.auction_alerts from anon;
revoke insert, update, delete on public.notary_auctions, public.notary_auction_events, public.auction_alerts from authenticated;
grant select on public.notary_auctions, public.notary_auction_events, public.auction_alerts to authenticated;
grant select, insert, update, delete on public.tracked_auctions to authenticated;
grant all on public.notary_auctions, public.notary_auction_events, public.tracked_auctions, public.auction_alerts to service_role;
revoke all on function public.notary_auctions_track_changes() from public, anon, authenticated;
