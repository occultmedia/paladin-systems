-- ════════════════════════════════════════════════════════════════════════
-- Terminal: the Delta Pipeline.
-- Run after 20261121000000_profiles_feed.sql (Supabase SQL editor or
-- `supabase db push`). Replaces the earlier confidence/kill-switch draft.
--
--   scraper (service role)                       members (authenticated)
--   ──────────────────────                       ───────────────────────
--   scrape_runs        one row per nightly run
--   raw_listings       extraction layer:          never readable
--                      one row per source URL,
--                      content_hash = delta key
--        │ normalise + dedupe (Python)
--        ▼
--   property_master    golden record              read (active, score > 0)
--   listing_events     price/status deltas,       read (via the views)
--                      written by trigger
--   agencies, listing_agents                      read
--
--   property_flags     the Kill Switch            insert own, read own
--                      (trigger archives the listing and zeroes its score)
--   deal_desk_posts    the blind bid/ask feed     insert/update/delete own,
--                      (14-day TTL)               read via deal_desk_feed
--   deal_desk_interest "I'm interested" on a      insert/delete own; the poster
--                      blind post                 sees who (v_deal_desk_interest)
--
-- RLS is on for every table. Only the service role (the scraper and the
-- nightly jobs) writes raw_listings, property_master, listing_events,
-- scrape_runs, agencies and listing_agents.
-- ════════════════════════════════════════════════════════════════════════

-- Shared ----------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Today's date in Aruba (UTC-4, no daylight saving): what "new today" and
-- "days on market" are counted against.
create or replace function public.aruba_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Aruba')::date $$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Extraction layer
-- ════════════════════════════════════════════════════════════════════════

-- One row per nightly scrape: the "Updated 2:00 AM AST" stamp and the
-- counters on the daily feed.
create table public.scrape_runs (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  sources_checked   integer not null default 0 check (sources_checked >= 0),
  listings_checked  integer not null default 0 check (listings_checked >= 0),
  rows_new          integer not null default 0 check (rows_new >= 0),
  rows_changed      integer not null default 0 check (rows_changed >= 0),
  rows_unchanged    integer not null default 0 check (rows_unchanged >= 0),
  error             text
);

-- The agencies, brokers and developers whose sites are scraped. Every listing
-- in the UI shows its agency logo and links to its site.
create table public.agencies (
  id          text primary key check (id ~ '^[a-z0-9-]{2,40}$'),  -- slug, e.g. 'tradewind'
  name        text not null check (char_length(name) between 1 and 120),
  website     text,
  logo_url    text,                                                 -- null = the UI shows a monogram
  color       text not null default '#18181B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active   boolean not null default true,                        -- still scraped every night
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger agencies_updated_at before update on public.agencies
  for each row execute function public.set_updated_at();

-- The agent named on a listing page (call / WhatsApp / e-mail buttons).
create table public.listing_agents (
  id          text primary key,                                     -- '<agency>-<slug>'
  agency_id   text not null references public.agencies (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  title       text check (char_length(title) <= 120),
  phone       text check (char_length(phone) <= 40),                -- international format
  whatsapp    boolean not null default false,
  email       text check (char_length(email) <= 160),
  photo_url   text,
  updated_at  timestamptz not null default now()
);

create index listing_agents_agency_idx on public.listing_agents (agency_id);
create trigger listing_agents_updated_at before update on public.listing_agents
  for each row execute function public.set_updated_at();

-- Staging: exactly what the scraper saw on each source page, unparsed.
-- Upsert on source_url every night. A row is a *delta* (needs normalising)
-- when it is new or its content_hash changed; the trigger below stamps that.
create table public.raw_listings (
  id                 bigint generated always as identity primary key,
  agency_id          text not null references public.agencies (id),
  source_url         text not null unique,
  source_listing_id  text,                                          -- the agency's own reference, if shown
  raw_title          text,
  raw_price          text,                                          -- as printed: '$1,250,000', 'Afl. 2.1M', 'Price on request'
  raw_currency       text,
  raw_beds           text,
  raw_baths          text,
  raw_built_area     text,                                          -- with its unit: '2,400 sq ft', '220 m2'
  raw_lot_area       text,
  raw_property_type  text,
  raw_status         text,                                          -- 'For sale', 'Under offer', 'SOLD', ...
  raw_address        text,
  raw_district       text,
  raw_tenure         text,                                          -- 'Eigendom', 'Erfpacht', 'Long lease', ...
  raw_description    text,
  raw_agent          jsonb,                                         -- { name, title, phone, email, photo }
  raw_photos         text[] not null default '{}',
  raw_lat            double precision,
  raw_lng            double precision,
  raw_payload        jsonb not null default '{}'::jsonb,            -- anything else captured
  content_hash       text not null,                                 -- hash of the fields above: the delta key
  first_scraped_at   timestamptz not null default now(),
  last_scraped_at    timestamptz not null default now(),            -- last run that FOUND this URL
  last_changed_at    timestamptz not null default now(),            -- last time content_hash changed
  first_run_id       bigint references public.scrape_runs (id) on delete set null,
  last_run_id        bigint references public.scrape_runs (id) on delete set null,
  scrape_count       integer not null default 1 check (scrape_count >= 1),
  -- the golden record this source page was merged into (dedupe);
  -- several agencies can list the same property
  property_id        uuid,                                          -- fk added below
  processed_at       timestamptz,                                   -- null = delta waiting to be normalised
  process_error      text
);

create index raw_listings_pending_idx on public.raw_listings (last_changed_at) where processed_at is null;
create index raw_listings_property_idx on public.raw_listings (property_id);
create index raw_listings_agency_seen_idx on public.raw_listings (agency_id, last_scraped_at);

-- Delta detection: unchanged content only bumps last_scraped_at/scrape_count;
-- changed content is re-queued for normalisation.
create or replace function public.raw_listings_track_delta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.first_scraped_at := coalesce(new.first_scraped_at, now());
    new.last_changed_at := new.first_scraped_at;
    new.first_run_id := coalesce(new.first_run_id, new.last_run_id);
    new.processed_at := null;
    return new;
  end if;

  new.first_scraped_at := old.first_scraped_at;
  new.first_run_id := old.first_run_id;
  if new.last_scraped_at is distinct from old.last_scraped_at then
    new.scrape_count := old.scrape_count + 1;
  end if;
  if new.content_hash is distinct from old.content_hash then
    new.last_changed_at := now();
    new.processed_at := null;                                     -- back in the queue
    new.process_error := null;
  end if;
  return new;
end;
$$;

create trigger raw_listings_delta
  before insert or update on public.raw_listings
  for each row execute function public.raw_listings_track_delta();

-- The queue the normaliser reads: new or changed pages only.
create view public.raw_listing_deltas
with (security_invoker = true) as
select r.*, (r.property_id is null) as is_new_source
  from public.raw_listings r
 where r.processed_at is null
 order by r.last_changed_at;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Golden record
-- ════════════════════════════════════════════════════════════════════════

create table public.property_master (
  id                     uuid primary key default gen_random_uuid(),
  listing_id             text not null unique check (listing_id ~ '^[A-Z]{2}-[0-9A-Z]{3,12}$'), -- public ref, 'AW-0388'
  market_id              text not null default 'aw-lux',

  -- what it is
  asset_class            text not null check (asset_class in ('Property', 'Land', 'Commercial')),
  property_type          text not null check (property_type in
                           ('Villa', 'Estate', 'Penthouse', 'Beach House', 'Condo', 'Apartment', 'Townhouse', 'Land', 'Commercial')),
  commercial_use         text check (commercial_use in ('Retail', 'Office', 'Hospitality', 'Mixed-use', 'Warehouse')),
  zoning                 text check (zoning in ('Residential', 'Tourism', 'Commercial', 'Agricultural')),
  asset_name             text not null check (char_length(asset_name) between 1 and 160),
  bedrooms               smallint check (bedrooms between 0 and 60),
  bathrooms              numeric(4, 1) check (bathrooms between 0 and 60),
  built_sqft             integer check (built_sqft > 0),
  lot_sqft               integer check (lot_sqft > 0),
  pool                   text check (pool in ('Private pool', 'Shared pool', 'No pool')),
  tenure                 text not null default 'Eigendom' check (tenure in ('Eigendom', 'Erfpacht')),
  lease_years_left       smallint check (lease_years_left between 0 and 99),

  -- where it is (Mapbox)
  district               text not null check (char_length(district) between 1 and 60),
  address                text,
  lat                    double precision not null check (lat between 12.3 and 12.7),  -- Aruba
  lng                    double precision not null check (lng between -70.2 and -69.8),

  -- price
  asking_price_usd       numeric(14, 2) not null check (asking_price_usd > 0),
  first_price_usd        numeric(14, 2) not null check (first_price_usd > 0),
  price_per_sqft_usd     numeric(12, 2) generated always as (
                           case when asset_class = 'Land' then round(asking_price_usd / nullif(lot_sqft, 0), 2)
                                else round(asking_price_usd / nullif(built_sqft, 0), 2) end) stored,
  price_change_pct       numeric(7, 2) generated always as (
                           round((asking_price_usd - first_price_usd) / first_price_usd * 100, 2)) stored,
  last_price_change_at   timestamptz,                               -- null = never changed since first_seen

  -- value signal, written by the nightly comps job
  signal                 text not null default 'AT_MARKET' check (signal in ('UNDERVALUED', 'AT_MARKET', 'OVERPRICED')),
  comps_psf_usd          numeric(12, 2),                            -- homes: median $/ft² of comparable listings
  comps_count            smallint check (comps_count >= 0),
  price_vs_comps_pct     numeric(7, 2),
  district_psf_usd       numeric(12, 2),                            -- land/commercial: district average $/ft²
  price_vs_district_pct  numeric(7, 2),
  signal_updated_at      timestamptz,

  -- who is selling it
  agency_id              text not null references public.agencies (id),
  agent_id               text references public.listing_agents (id) on delete set null,
  source_url             text,                                      -- primary source page (raw_listings.source_url)
  photo_url              text,
  photos                 text[] not null default '{}',

  -- lifecycle
  listing_status         text not null default 'For sale' check (listing_status in ('For sale', 'Under contract', 'Sold', 'De-listed')),
  status_changed_at      timestamptz,                               -- null = for sale since listed
  first_seen             date not null default public.aruba_today(),
  days_on_market         integer not null default 0 check (days_on_market >= 0), -- as reported by the source, if shown
  last_scraped_at        timestamptz not null default now(),        -- last time any source FOUND it (Confidence input)
  last_run_id            bigint references public.scrape_runs (id) on delete set null,

  -- Kill Switch / Confidence Score
  status                 text not null default 'active' check (status in ('active', 'archived')),
  confidence_score       smallint not null default 100 check (confidence_score between 0 and 100),
  confidence_updated_at  timestamptz,
  archived_at            timestamptz,
  archived_by            uuid references auth.users (id) on delete set null,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint property_master_shape check (
    case asset_class
      when 'Property'   then property_type not in ('Land', 'Commercial') and bedrooms is not null and built_sqft is not null
      when 'Land'       then property_type = 'Land' and lot_sqft is not null and zoning is not null
      when 'Commercial' then property_type = 'Commercial' and commercial_use is not null and built_sqft is not null
    end),
  constraint property_master_lease check (tenure = 'Erfpacht' or lease_years_left is null),
  constraint property_master_archived check ((status = 'archived') = (archived_at is not null))
);

alter table public.raw_listings
  add constraint raw_listings_property_fk foreign key (property_id) references public.property_master (id) on delete set null;

create index property_master_market_idx on public.property_master (market_id, status, confidence_score);
create index property_master_signal_idx on public.property_master (signal) where status = 'active';
create index property_master_agency_idx on public.property_master (agency_id);
create index property_master_district_idx on public.property_master (district);

create trigger property_master_updated_at before update on public.property_master
  for each row execute function public.set_updated_at();

-- Price and status deltas, captured by the database itself so the scraper
-- only has to upsert the latest values. Feeds the price history, the daily
-- feed ("new today", "price cut", "under contract") and watchlist alerts.
create table public.listing_events (
  id           bigint generated always as identity primary key,
  property_id  uuid not null references public.property_master (id) on delete cascade,
  run_id       bigint references public.scrape_runs (id) on delete set null,
  event        text not null check (event in ('Listed', 'Price drop', 'Price increase', 'Status change')),
  observed_on  date not null default public.aruba_today(),
  price_usd    numeric(14, 2),
  change_pct   numeric(7, 2),                                       -- vs the previous price
  old_status   text,
  new_status   text,
  created_at   timestamptz not null default now()
);

create index listing_events_property_idx on public.listing_events (property_id, created_at);
create index listing_events_day_idx on public.listing_events (observed_on desc, event);

create or replace function public.property_master_capture_events()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.listing_events (property_id, run_id, event, observed_on, price_usd, new_status)
    values (new.id, new.last_run_id, 'Listed', new.first_seen, new.asking_price_usd, new.listing_status);
    return null;
  end if;

  if new.asking_price_usd is distinct from old.asking_price_usd then
    insert into public.listing_events (property_id, run_id, event, price_usd, change_pct)
    values (new.id, new.last_run_id,
            case when new.asking_price_usd < old.asking_price_usd then 'Price drop' else 'Price increase' end,
            new.asking_price_usd,
            round((new.asking_price_usd - old.asking_price_usd) / old.asking_price_usd * 100, 2));
  end if;

  if new.listing_status is distinct from old.listing_status then
    insert into public.listing_events (property_id, run_id, event, price_usd, old_status, new_status)
    values (new.id, new.last_run_id, 'Status change', new.asking_price_usd, old.listing_status, new.listing_status);
  end if;
  return null;
end;
$$;

-- Stamp the change dates on the row itself (BEFORE), log them (AFTER).
create or replace function public.property_master_stamp_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.first_price_usd := coalesce(new.first_price_usd, new.asking_price_usd);
    return new;
  end if;
  new.first_price_usd := old.first_price_usd;                     -- the "listed at" price never moves
  new.first_seen := old.first_seen;
  if new.asking_price_usd is distinct from old.asking_price_usd then
    new.last_price_change_at := now();
  end if;
  if new.listing_status is distinct from old.listing_status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger property_master_stamp
  before insert or update on public.property_master
  for each row execute function public.property_master_stamp_changes();

create trigger property_master_events
  after insert or update of asking_price_usd, listing_status on public.property_master
  for each row execute function public.property_master_capture_events();

-- When a source page that belongs to a golden record is seen again, the record
-- was "found" tonight: keep property_master.last_scraped_at current so the
-- Confidence Score only decays for listings that really disappeared.
create or replace function public.raw_listings_touch_master()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.property_id is not null then
    update public.property_master
       set last_scraped_at = greatest(last_scraped_at, new.last_scraped_at),
           last_run_id = coalesce(new.last_run_id, last_run_id)
     where id = new.property_id
       and last_scraped_at < new.last_scraped_at;
  end if;
  return null;
end;
$$;

create trigger raw_listings_touch_master
  after insert or update of last_scraped_at, property_id on public.raw_listings
  for each row execute function public.raw_listings_touch_master();

-- Mark a raw row as normalised (or failed) once Python has merged it.
create or replace function public.mark_raw_processed(p_raw_id bigint, p_property_id uuid, p_error text default null)
returns void
language sql
security definer set search_path = ''
as $$
  update public.raw_listings
     set property_id  = coalesce(p_property_id, property_id),
         processed_at = case when p_error is null then now() end,
         process_error = p_error
   where id = p_raw_id;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Kill Switch
-- ════════════════════════════════════════════════════════════════════════

create table public.property_flags (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id      uuid not null references public.property_master (id) on delete cascade,
  flag_type        text not null check (flag_type in ('sold', 'off_market', 'ghost', 'duplicate')),
  note             text check (char_length(note) <= 280),
  previous_status  text,                                            -- filled by the trigger, used by undo
  previous_score   smallint,
  created_at       timestamptz not null default now(),
  undone_at        timestamptz,
  -- set by the nightly job when a source still shows the listing live after
  -- it was flagged: a flag worth reviewing
  disputed         boolean not null default false
);

create index property_flags_property_idx on public.property_flags (property_id);
create index property_flags_user_idx on public.property_flags (user_id, created_at desc);
-- one open flag per member per listing
create unique index property_flags_one_open_idx on public.property_flags (user_id, property_id) where undone_at is null;

-- BEFORE INSERT: guard rails + remember what the listing looked like.
create or replace function public.property_flags_before_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  cur record;
begin
  -- members can only flag as themselves (service role may flag on behalf)
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    raise exception 'You can only flag as yourself.' using errcode = '42501';
  end if;

  -- abuse guard (e.g. flagging a competitor's live deals): 10 flags a day
  if (select count(*) from public.property_flags f
       where f.user_id = new.user_id and f.created_at > now() - interval '24 hours' and f.undone_at is null) >= 10 then
    raise exception 'Daily limit reached: you can flag up to 10 listings a day. Email us if more are wrong.'
      using errcode = 'P0001';
  end if;

  select status, confidence_score into cur
    from public.property_master where id = new.property_id for update;
  if not found then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;
  if cur.status = 'archived' then
    raise exception 'This listing has already been removed.' using errcode = 'P0001';
  end if;

  new.note := nullif(left(trim(coalesce(new.note, '')), 280), '');
  new.previous_status := cur.status;
  new.previous_score := cur.confidence_score;
  new.created_at := now();
  new.undone_at := null;
  new.disputed := false;
  return new;
end;
$$;

-- AFTER INSERT: the Kill Switch itself. The listing leaves the Master Market
-- for everyone: confidence 0, status archived.
create or replace function public.property_flags_kill_switch()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.property_master
     set confidence_score = 0,
         confidence_updated_at = now(),
         status = 'archived',
         archived_at = now(),
         archived_by = new.user_id
   where id = new.property_id;
  return null;
end;
$$;

create trigger property_flags_guard
  before insert on public.property_flags
  for each row execute function public.property_flags_before_insert();

create trigger property_flags_kill_switch
  after insert on public.property_flags
  for each row execute function public.property_flags_kill_switch();

-- RPC used by the "Flag delisted" dialog (takes the public listing ref).
create or replace function public.flag_delisted(p_listing_id text, p_reason text, p_note text default null)
returns void
language plpgsql
security invoker set search_path = ''
as $$
declare
  pid uuid;
begin
  if auth.uid() is null then
    raise exception 'Log in to flag listings.' using errcode = '42501';
  end if;
  select id into pid from public.property_master where listing_id = p_listing_id;
  if pid is null then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;
  -- the triggers above do the guarding and the archiving
  insert into public.property_flags (user_id, property_id, flag_type, note)
  values (auth.uid(), pid, p_reason, p_note);
end;
$$;

-- The member who flagged a listing can undo it for 15 minutes (the UI's
-- UNDO_MINUTES). Restores the previous status and score.
create or replace function public.undo_flag(p_listing_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  f record;
begin
  select pf.id, pf.property_id, pf.previous_status, pf.previous_score, pf.created_at into f
    from public.property_flags pf
    join public.property_master pm on pm.id = pf.property_id
   where pm.listing_id = p_listing_id and pf.user_id = uid and pf.undone_at is null
   order by pf.created_at desc
   limit 1
   for update of pf;
  if not found then
    raise exception 'No flag of yours to undo on this listing.' using errcode = 'P0002';
  end if;
  if f.created_at < now() - interval '15 minutes' then
    raise exception 'The undo window has passed. Email us to restore this listing.' using errcode = 'P0001';
  end if;

  update public.property_flags set undone_at = now() where id = f.id;
  update public.property_master
     set status = coalesce(f.previous_status, 'active'),
         confidence_score = coalesce(f.previous_score, 100),
         confidence_updated_at = now(),
         archived_at = null,
         archived_by = null
   where id = f.property_id and archived_by = uid;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Deal Desk: the blind bid/ask feed
-- ════════════════════════════════════════════════════════════════════════

create table public.deal_desk_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  side          text not null check (side in ('bid', 'ask')),       -- bid = wants to buy, ask = has to sell
  kind          text not null default 'Off-market' check (kind in
                  ('Off-market', 'For sale', 'Buyer request', 'For rent', 'Partnership')),
  asset_class   text not null check (asset_class in ('Property', 'Land', 'Commercial')),
  property_type text check (property_type in
                  ('Villa', 'Estate', 'Penthouse', 'Beach House', 'Condo', 'Apartment', 'Townhouse', 'Land', 'Commercial')),
  district      text check (char_length(district) <= 60),
  title         text not null check (char_length(title) between 6 and 90),
  notes         text not null check (char_length(notes) between 20 and 600),
  budget_min    numeric(14, 2) check (budget_min > 0),              -- ask: lowest acceptable / bid: low end
  budget_max    numeric(14, 2) check (budget_max > 0),              -- ask: asking price  / bid: ceiling
  listing_id    uuid references public.property_master (id) on delete set null, -- a Terminal listing attached
  is_blind      boolean not null default true,                      -- hide who posted until they reveal
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  constraint deal_desk_budget check (budget_min is null or budget_max is null or budget_max >= budget_min),
  constraint deal_desk_side_kind check (
    (side = 'bid' and kind = 'Buyer request') or (side = 'ask' and kind <> 'Buyer request')),
  constraint deal_desk_ttl check (expires_at > created_at and expires_at <= created_at + interval '14 days')
);

create index deal_desk_posts_live_idx on public.deal_desk_posts (expires_at desc);
create index deal_desk_posts_author_idx on public.deal_desk_posts (author_id, created_at desc);
create index deal_desk_posts_filter_idx on public.deal_desk_posts (side, asset_class);

-- TTL: posts can be shortened but never live past 14 days; edits keep the clock.
create or replace function public.deal_desk_enforce_ttl()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.expires_at := least(coalesce(new.expires_at, now() + interval '14 days'), now() + interval '14 days');
  else
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    new.expires_at := least(new.expires_at, old.created_at + interval '14 days');
  end if;
  return new;
end;
$$;

create trigger deal_desk_ttl
  before insert or update on public.deal_desk_posts
  for each row execute function public.deal_desk_enforce_ttl();

-- Physical cleanup of expired posts (reads already hide them).
create or replace function public.purge_expired_deal_desk_posts()
returns integer
language sql
security definer set search_path = ''
as $$
  with gone as (delete from public.deal_desk_posts where expires_at < now() returning 1)
  select count(*)::integer from gone;
$$;

select cron.schedule('deal-desk-expire-14d', '7 * * * *', $$select public.purge_expired_deal_desk_posts()$$);

-- "I'm interested": how members respond to a blind post. The responder stays
-- visible only to the poster, who decides whether to reach out.
create table public.deal_desk_interest (
  post_id     uuid not null references public.deal_desk_posts (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  note        text check (char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index deal_desk_interest_user_idx on public.deal_desk_interest (user_id, created_at desc);

-- A live post by someone else (members cannot read other members' rows in
-- deal_desk_posts, so the insert policy asks this definer function).
create or replace function public.deal_post_open_for_interest(p_post_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.deal_desk_posts d
                  where d.id = p_post_id and d.expires_at > now() and d.author_id <> auth.uid());
$$;

-- The feed members read. Blind posts show the poster's role only (Agent,
-- Investor, Brokerage); name, company and contact stay hidden. Members never
-- read the base table directly except their own rows (author_id stays private).
-- Owned by postgres so it can read other members' rows; RLS-equivalent
-- filtering (signed in, not expired) is applied here.
create view public.deal_desk_feed
with (security_invoker = false) as
select d.id,
       d.side, d.kind, d.asset_class, d.property_type, d.district,
       d.title, d.notes, d.budget_min, d.budget_max,
       pm.listing_id                                  as listing_ref,
       d.is_blind, d.created_at, d.expires_at,
       (d.author_id = auth.uid())                     as is_mine,
       p.role                                         as author_role,
       case when d.is_blind then null else p.name     end as author_name,
       case when d.is_blind then null else p.company  end as author_company,
       case when d.is_blind then null else p.title    end as author_title,
       case when d.is_blind then null else p.photo_url end as author_photo_url,
       case when d.is_blind then null else p.logo_url end as author_logo_url,
       case when d.is_blind then null else p.email    end as author_email,
       case when d.is_blind then null else p.phone    end as author_phone,
       case when d.is_blind then null else p.whatsapp end as author_whatsapp,
       case when d.author_id = auth.uid()
            then (select count(*)::integer from public.deal_desk_interest i where i.post_id = d.id) end as interest_count,
       exists (select 1 from public.deal_desk_interest i where i.post_id = d.id and i.user_id = auth.uid()) as i_am_interested
  from public.deal_desk_posts d
  join public.profiles p on p.id = d.author_id
  left join public.property_master pm on pm.id = d.listing_id
 where auth.uid() is not null
   and d.expires_at > now();

-- The poster's list of members interested in their posts, with contact details.
create view public.v_deal_desk_interest
with (security_invoker = true) as
select i.post_id, i.user_id, i.note, i.created_at,
       p.name, p.role, p.company, p.title, p.email, p.phone, p.whatsapp, p.photo_url, p.logo_url
  from public.deal_desk_interest i
  join public.deal_desk_posts d on d.id = i.post_id
  join public.profiles p on p.id = i.user_id
 where d.author_id = auth.uid();

-- ════════════════════════════════════════════════════════════════════════
-- 5. What the UI reads
-- ════════════════════════════════════════════════════════════════════════

-- One flat row per listing, named like the frontend's `Listing` type
-- (src/lib/aruba-data.ts). security_invoker: property_master RLS applies, so
-- members only ever get active listings with a score above 0.
create view public.v_master_market
with (security_invoker = true) as
select pm.id                                                   as property_id,
       pm.listing_id,
       pm.market_id,
       pm.asset_class                                          as category,
       pm.property_type,
       pm.commercial_use,
       pm.zoning,
       pm.asset_name,
       pm.district,
       pm.address,
       pm.lat,
       pm.lng,
       pm.bedrooms,
       pm.bathrooms,
       pm.built_sqft,
       pm.lot_sqft,
       pm.pool,
       pm.tenure,
       pm.lease_years_left,
       pm.asking_price_usd,
       pm.first_price_usd,
       pm.price_per_sqft_usd,
       pm.price_change_pct,
       pm.last_price_change_at,
       pm.signal,
       pm.comps_psf_usd,
       pm.comps_count,
       pm.price_vs_comps_pct,
       pm.district_psf_usd,
       pm.price_vs_district_pct,
       pm.listing_status                                       as status,
       pm.status_changed_at,
       pm.first_seen,
       greatest(pm.days_on_market, public.aruba_today() - pm.first_seen) as days_on_market,
       (pm.first_seen = public.aruba_today())                  as is_new,
       pm.last_scraped_at                                      as last_found_at,
       pm.updated_at                                           as last_scraped,
       pm.confidence_score,
       pm.source_url,
       pm.photo_url,
       pm.photos,
       a.name                                                  as source,
       jsonb_build_object('id', a.id, 'name', a.name, 'website', a.website, 'logo_url', a.logo_url, 'color', a.color) as agency,
       case when ag.id is null then null else
         jsonb_build_object('id', ag.id, 'name', ag.name, 'title', ag.title, 'phone', ag.phone, 'whatsapp', ag.whatsapp,
                            'email', ag.email, 'photo_url', ag.photo_url, 'agency_id', ag.agency_id) end as agent,
       coalesce((
         select jsonb_agg(jsonb_build_object('date', e.observed_on, 'event', e.event, 'price_usd', e.price_usd, 'change_pct', e.change_pct)
                          order by e.created_at)
           from public.listing_events e
          where e.property_id = pm.id and e.event in ('Listed', 'Price drop', 'Price increase')
       ), '[]'::jsonb)                                          as price_history
  from public.property_master pm
  join public.agencies a on a.id = pm.agency_id
  left join public.listing_agents ag on ag.id = pm.agent_id;

-- The daily updates feed: what each scrape saw change (new, price, status).
create view public.v_market_events
with (security_invoker = true) as
select e.id, e.run_id, e.observed_on, e.event, e.price_usd, e.change_pct, e.old_status, e.new_status, e.created_at,
       pm.listing_id, pm.asset_name, pm.district, pm.asset_class as category, pm.agency_id
  from public.listing_events e
  join public.property_master pm on pm.id = e.property_id;

-- For review in the Supabase dashboard (service role only): who flags what,
-- and which flags the scraper disagrees with.
create view public.v_flag_review
with (security_invoker = true) as
select f.created_at, pm.listing_id, pm.asset_name, a.name as source, f.flag_type, f.note, f.disputed, f.undone_at,
       f.user_id, pr.name as flagged_by_name, pr.company as flagged_by_company,
       count(*) over (partition by f.user_id) as member_flag_count
  from public.property_flags f
  join public.property_master pm on pm.id = f.property_id
  join public.agencies a on a.id = pm.agency_id
  left join public.profiles pr on pr.id = f.user_id;

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════

alter table public.scrape_runs      enable row level security;
alter table public.agencies         enable row level security;
alter table public.listing_agents   enable row level security;
alter table public.raw_listings     enable row level security;
alter table public.property_master  enable row level security;
alter table public.listing_events   enable row level security;
alter table public.property_flags   enable row level security;
alter table public.deal_desk_posts  enable row level security;
alter table public.deal_desk_interest enable row level security;

-- Extraction layer: backend only. No policies = no access for anon or
-- authenticated; the service role bypasses RLS. Grants removed as well.
revoke all on public.raw_listings, public.raw_listing_deltas from anon, authenticated;
revoke all on public.scrape_runs from anon;
revoke insert, update, delete on public.scrape_runs from authenticated;

-- Members read the run stamp ("Updated 2:00 AM AST").
create policy "Members read scrape runs"
  on public.scrape_runs for select to authenticated using (true);

-- Reference data: read-only for members.
create policy "Members read agencies"
  on public.agencies for select to authenticated using (true);
create policy "Members read listing agents"
  on public.listing_agents for select to authenticated using (true);
revoke all on public.agencies, public.listing_agents from anon;
revoke insert, update, delete on public.agencies, public.listing_agents from authenticated;

-- Golden record: members read the Master Market (active, score > 0); only the
-- service role and the security-definer triggers write.
create policy "Members read the master market"
  on public.property_master for select to authenticated
  using (status = 'active' and confidence_score > 0);
revoke all on public.property_master from anon;
revoke insert, update, delete on public.property_master from authenticated;

create policy "Members read events of visible listings"
  on public.listing_events for select to authenticated
  using (exists (select 1 from public.property_master pm
                  where pm.id = listing_events.property_id and pm.status = 'active' and pm.confidence_score > 0));
revoke all on public.listing_events from anon;
revoke insert, update, delete on public.listing_events from authenticated;

-- Kill Switch: members insert flags as themselves and read their own.
create policy "Members flag as themselves"
  on public.property_flags for insert to authenticated
  with check (user_id = auth.uid());
create policy "Members read their own flags"
  on public.property_flags for select to authenticated
  using (user_id = auth.uid());
revoke all on public.property_flags from anon;
revoke update, delete on public.property_flags from authenticated;
grant select, insert on public.property_flags to authenticated;

-- Deal Desk: members post as themselves and manage their own posts. Other
-- members' posts are read through deal_desk_feed (blind).
create policy "Members post to the Deal Desk as themselves"
  on public.deal_desk_posts for insert to authenticated
  with check (author_id = auth.uid());
create policy "Members read their own Deal Desk posts"
  on public.deal_desk_posts for select to authenticated
  using (author_id = auth.uid());
create policy "Members edit their own live Deal Desk posts"
  on public.deal_desk_posts for update to authenticated
  using (author_id = auth.uid() and expires_at > now())
  with check (author_id = auth.uid());
create policy "Members delete their own Deal Desk posts"
  on public.deal_desk_posts for delete to authenticated
  using (author_id = auth.uid());
revoke all on public.deal_desk_posts from anon;
grant select, insert, update, delete on public.deal_desk_posts to authenticated;

create policy "Members show interest as themselves in live posts"
  on public.deal_desk_interest for insert to authenticated
  with check (user_id = auth.uid() and public.deal_post_open_for_interest(post_id));
create policy "Members read their own interest and interest in their posts"
  on public.deal_desk_interest for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.deal_desk_posts d where d.id = post_id and d.author_id = auth.uid()));
create policy "Members withdraw their own interest"
  on public.deal_desk_interest for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.deal_desk_interest from anon;
revoke update on public.deal_desk_interest from authenticated;

-- Views
revoke all on public.v_master_market, public.v_market_events, public.deal_desk_feed, public.v_deal_desk_interest from anon;
grant select on public.v_master_market, public.v_market_events, public.deal_desk_feed, public.v_deal_desk_interest to authenticated;
revoke all on public.v_flag_review from anon, authenticated;

-- Functions: lock everything down, then open what the UI calls.
revoke all on function public.flag_delisted(text, text, text) from public, anon;
revoke all on function public.undo_flag(text) from public, anon;
revoke all on function public.mark_raw_processed(bigint, uuid, text) from public, anon, authenticated;
revoke all on function public.purge_expired_deal_desk_posts() from public, anon, authenticated;
revoke all on function public.deal_post_open_for_interest(uuid) from public, anon;
grant execute on function public.deal_post_open_for_interest(uuid) to authenticated;
revoke all on function public.property_master_capture_events() from public, anon, authenticated;
revoke all on function public.raw_listings_touch_master() from public, anon, authenticated;
revoke all on function public.property_flags_before_insert() from public, anon, authenticated;
revoke all on function public.property_flags_kill_switch() from public, anon, authenticated;
grant execute on function public.flag_delisted(text, text, text) to authenticated;
grant execute on function public.undo_flag(text) to authenticated;
grant execute on function public.mark_raw_processed(bigint, uuid, text) to service_role;
grant execute on function public.purge_expired_deal_desk_posts() to service_role;
