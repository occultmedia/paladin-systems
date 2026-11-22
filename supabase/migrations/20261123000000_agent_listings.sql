-- Terminal: listings uploaded by agents, with a duplicate watch.
--
-- Agents add properties by hand (off-market pocket listings, or anything the
-- scraper has not picked up). Each one is either
--   'members'  Off-market: every signed-in member sees it on the dashboard
--   'private'  Only the agent who added it sees it
--
-- Duplicate watch (same rules as src/lib/duplicates.ts):
--   * Before a listing is saved it is compared with every active Master
--     Market listing and every agent listing the uploader can see. A likely
--     duplicate (score >= 70) is refused with DUPLICATE_LISTING unless the
--     agent confirmed it is a different property (dup_acknowledged).
--   * When the scraper later adds a Master Market listing that matches an
--     agent listing, the agent listing is linked to it (market_listing_id,
--     went_public_at): "your off-market listing is now on a public site".

create extension if not exists pg_trgm with schema extensions;

-- Match score ------------------------------------------------------------
-- 0-100. Category must match. Location (pins, else district), size, bedrooms,
-- price and name each add points; a clear mismatch in size or bedrooms takes
-- points away. >= 70 likely the same listing, >= 50 possibly.
create or replace function public.listing_match_score(
  a_class text, b_class text,
  a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision,
  a_district text, b_district text,
  a_beds integer, b_beds integer,
  a_built integer, b_built integer, a_lot integer, b_lot integer,
  a_price numeric, b_price numeric,
  a_name text, b_name text
) returns integer
language plpgsql immutable
set search_path = ''
as $$
declare
  s integer := 0;
  d double precision;
  a_size integer := coalesce(a_built, a_lot);
  b_size integer := coalesce(b_built, b_lot);
  size_diff double precision;
  price_diff double precision;
  sim real;
begin
  if a_class is distinct from b_class then return 0; end if;

  if a_lat is not null and a_lng is not null and b_lat is not null and b_lng is not null then
    -- equirectangular distance in metres (plenty for an island)
    d := sqrt(power((b_lat - a_lat) * 111320, 2) + power((b_lng - a_lng) * 111320 * cos(radians((a_lat + b_lat) / 2)), 2));
    if d > 1000 then return 0; end if;
    s := s + case when d <= 40 then 40 when d <= 120 then 28 when d <= 300 then 12 else 0 end;
  elsif lower(trim(a_district)) = lower(trim(b_district)) then
    s := s + 25;
  else
    return 0;
  end if;

  -- compare built area when both have it, otherwise lot size
  if a_built is not null and b_built is not null then
    size_diff := abs(a_built - b_built)::double precision / greatest(a_built, b_built);
  elsif a_lot is not null and b_lot is not null then
    size_diff := abs(a_lot - b_lot)::double precision / greatest(a_lot, b_lot);
  elsif a_size is not null and b_size is not null then
    size_diff := null; -- one has built, the other only lot: no signal
  end if;
  if size_diff is not null then
    s := s + case when size_diff <= 0.02 then 30 when size_diff <= 0.06 then 20 when size_diff <= 0.12 then 8
                  when size_diff > 0.25 then -20 else 0 end;
  end if;

  if a_beds is not null and b_beds is not null then
    s := s + case when a_beds = b_beds then 10 else -15 end;
  end if;

  if a_price > 0 and b_price > 0 then
    price_diff := abs(a_price - b_price) / greatest(a_price, b_price);
    s := s + case when price_diff <= 0.03 then 12 when price_diff <= 0.10 then 7 else 0 end;
  end if;

  sim := extensions.similarity(lower(coalesce(a_name, '')), lower(coalesce(b_name, '')));
  s := s + case when sim >= 0.55 then 15 when sim >= 0.35 then 7 else 0 end;

  return greatest(0, least(100, s));
end;
$$;

-- Agent listings ---------------------------------------------------------
create table public.agent_listings (
  id                 uuid primary key default gen_random_uuid(),
  ref                text generated always as ('AG-' || upper(left(replace(id::text, '-', ''), 8))) stored unique,
  owner_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  market_id          text not null default 'aw-lux',
  visibility         text not null default 'members' check (visibility in ('members', 'private')),

  asset_class        text not null check (asset_class in ('Property', 'Land', 'Commercial')),
  property_type      text not null check (property_type in
                       ('Villa', 'Estate', 'Penthouse', 'Beach House', 'Condo', 'Apartment', 'Townhouse', 'Land', 'Commercial')),
  commercial_use     text check (commercial_use in ('Retail', 'Office', 'Hospitality', 'Mixed-use', 'Warehouse')),
  zoning             text check (zoning in ('Residential', 'Tourism', 'Commercial', 'Agricultural')),
  asset_name         text not null check (char_length(asset_name) between 3 and 120),
  bedrooms           smallint check (bedrooms between 0 and 60),
  bathrooms          numeric(4, 1) check (bathrooms between 0 and 60),
  built_sqft         integer check (built_sqft between 50 and 2000000),
  lot_sqft           integer check (lot_sqft between 50 and 50000000),
  pool               text check (pool in ('Private pool', 'Shared pool', 'No pool')),
  tenure             text not null default 'Eigendom' check (tenure in ('Eigendom', 'Erfpacht')),
  lease_years_left   smallint check (lease_years_left between 0 and 99),

  district           text not null check (char_length(district) between 1 and 60),
  address            text check (char_length(address) <= 160),
  lat                double precision check (lat between 12.3 and 12.7),   -- Aruba; null = district only
  lng                double precision check (lng between -70.2 and -69.8),

  asking_price_usd   numeric(14, 2) not null check (asking_price_usd between 1000 and 1000000000),
  listing_status     text not null default 'For sale' check (listing_status in ('For sale', 'Under contract', 'Sold', 'Withdrawn')),
  notes              text check (char_length(notes) <= 1000),
  photo_url          text check (char_length(photo_url) <= 500),

  -- duplicate watch (written by the triggers below)
  dup_acknowledged   boolean not null default false,
  match_kind         text check (match_kind in ('market', 'member')),
  match_ref          text,
  match_name         text,
  match_score        smallint,
  market_listing_id  text,          -- the Master Market listing it turned up as
  went_public_at     timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint agent_listings_shape check (
    case asset_class
      when 'Property'   then property_type not in ('Land', 'Commercial') and bedrooms is not null and built_sqft is not null
      when 'Land'       then property_type = 'Land' and lot_sqft is not null and zoning is not null
      when 'Commercial' then property_type = 'Commercial' and commercial_use is not null and built_sqft is not null
    end),
  constraint agent_listings_lease check (tenure = 'Erfpacht' or lease_years_left is null),
  constraint agent_listings_pin check ((lat is null) = (lng is null))
);

create index agent_listings_owner_idx on public.agent_listings (owner_id);
create index agent_listings_visible_idx on public.agent_listings (market_id, visibility, listing_status);
create index agent_listings_district_idx on public.agent_listings (asset_class, district);

create trigger agent_listings_updated_at before update on public.agent_listings
  for each row execute function public.set_updated_at();

-- Best match for one agent listing among what its owner can see.
create or replace function public.agent_listing_best_match(l public.agent_listings)
returns table (kind text, ref text, name text, score integer)
language sql stable
security definer set search_path = ''
as $$
  select * from (
    select 'market'::text, m.listing_id, m.asset_name,
           public.listing_match_score(l.asset_class, m.asset_class, l.lat, l.lng, m.lat, m.lng, l.district, m.district,
             l.bedrooms, m.bedrooms, l.built_sqft, m.built_sqft, l.lot_sqft, m.lot_sqft, l.asking_price_usd, m.asking_price_usd,
             coalesce(l.address, l.asset_name), coalesce(m.address, m.asset_name))
    from public.property_master m
    where m.status = 'active' and m.confidence_score > 0 and m.asset_class = l.asset_class
      and m.listing_status not in ('Sold', 'De-listed')
    union all
    select 'member'::text, o.ref, o.asset_name,
           public.listing_match_score(l.asset_class, o.asset_class, l.lat, l.lng, o.lat, o.lng, l.district, o.district,
             l.bedrooms, o.bedrooms, l.built_sqft, o.built_sqft, l.lot_sqft, o.lot_sqft, l.asking_price_usd, o.asking_price_usd,
             coalesce(l.address, l.asset_name), coalesce(o.address, o.asset_name))
    from public.agent_listings o
    where o.id <> l.id and o.asset_class = l.asset_class
      and (o.visibility = 'members' or o.owner_id = l.owner_id)
      and o.listing_status not in ('Sold', 'Withdrawn')
  ) c (kind, ref, name, score)
  where c.score >= 50
  order by c.score desc
  limit 1;
$$;

revoke all on function public.agent_listing_best_match(public.agent_listings) from public, anon, authenticated;

create or replace function public.agent_listings_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  best record;
  today_count integer;
  -- the API role of the request (null in the SQL editor, service_role for the scraper)
  from_member boolean := coalesce(auth.role(), '') in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if from_member then
      new.owner_id := auth.uid();
      select count(*) into today_count from public.agent_listings
        where owner_id = new.owner_id and created_at > now() - interval '24 hours';
      if today_count >= 30 then
        raise exception 'You can add up to 30 listings a day.' using errcode = 'P0001';
      end if;
    end if;
    new.market_listing_id := null;
    new.went_public_at := null;
  elsif from_member then
    -- members cannot move a listing to someone else or edit the watch links
    new.owner_id := old.owner_id;
    new.market_listing_id := old.market_listing_id;
    new.went_public_at := old.went_public_at;
    -- a real change to what or where it is needs a fresh duplicate check
    if (new.asset_class, new.district, new.lat, new.lng, new.built_sqft, new.lot_sqft, new.bedrooms)
       is distinct from (old.asset_class, old.district, old.lat, old.lng, old.built_sqft, old.lot_sqft, old.bedrooms)
       and new.dup_acknowledged = old.dup_acknowledged then
      new.dup_acknowledged := false;
    end if;
  end if;

  select * into best from public.agent_listing_best_match(new);
  new.match_kind := best.kind;
  new.match_ref := best.ref;
  new.match_name := best.name;
  new.match_score := best.score;

  if from_member and coalesce(best.score, 0) >= 70 and not new.dup_acknowledged then
    raise exception 'DUPLICATE_LISTING'
      using errcode = 'P0001',
            detail = json_build_object('kind', best.kind, 'ref', best.ref, 'name', best.name, 'score', best.score)::text,
            hint = 'Confirm it is a different property to save it anyway.';
  end if;
  return new;
end;
$$;

revoke all on function public.agent_listings_guard() from public, anon, authenticated;

create trigger agent_listings_guard
  before insert or update on public.agent_listings
  for each row execute function public.agent_listings_guard();

-- When the scraper adds a market listing, link any agent listing it matches.
create or replace function public.property_master_link_agent_listings()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.agent_listings a
     set market_listing_id = new.listing_id,
         went_public_at = now()
   where a.market_listing_id is null
     and a.asset_class = new.asset_class
     and a.listing_status not in ('Sold', 'Withdrawn')
     and public.listing_match_score(a.asset_class, new.asset_class, a.lat, a.lng, new.lat, new.lng, a.district, new.district,
           a.bedrooms, new.bedrooms, a.built_sqft, new.built_sqft, a.lot_sqft, new.lot_sqft, a.asking_price_usd, new.asking_price_usd,
           coalesce(a.address, a.asset_name), coalesce(new.address, new.asset_name)) >= 70;
  return new;
end;
$$;

revoke all on function public.property_master_link_agent_listings() from public, anon, authenticated;

create trigger property_master_link_agent_listings
  after insert on public.property_master
  for each row execute function public.property_master_link_agent_listings();

-- Access -------------------------------------------------------------------
alter table public.agent_listings enable row level security;

create policy "Members read off-market listings and their own"
  on public.agent_listings for select to authenticated
  using (visibility = 'members' or owner_id = auth.uid());
create policy "Members add listings as themselves"
  on public.agent_listings for insert to authenticated
  with check (owner_id = auth.uid());
create policy "Members edit their own listings"
  on public.agent_listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Members delete their own listings"
  on public.agent_listings for delete to authenticated
  using (owner_id = auth.uid());

revoke all on public.agent_listings from anon;
grant select, insert, update, delete on public.agent_listings to authenticated;
grant all on public.agent_listings to service_role;

-- One row per visible agent listing with the agent's public profile
-- (security_invoker: the table's policies decide what each member sees).
create view public.v_agent_listings
with (security_invoker = true) as
select a.*,
       p.name      as owner_name,
       p.role      as owner_role,
       p.company   as owner_company,
       p.title     as owner_title,
       p.email     as owner_email,
       p.phone     as owner_phone,
       p.whatsapp  as owner_whatsapp,
       p.photo_url as owner_photo_url,
       p.logo_url  as owner_logo_url
from public.agent_listings a
join public.profiles p on p.id = a.owner_id;

revoke all on public.v_agent_listings from anon;
grant select on public.v_agent_listings to authenticated, service_role;
