-- ════════════════════════════════════════════════════════════════════════
-- Grouped listings for the map and the list (28 November 2026)
--
--   1. Projects: condo buildings and new developments whose units are listed
--      separately, often by several agencies. One pin and one card
--      ("From $X · N units") per project. Grouped by the Python job
--      scraper/terminal_spider/projects.py after each Index.
--   2. Co-listings: one home listed by several agencies is already one
--      property_master row (raw_listings keeps every agency's own row). Each
--      row now carries the agencies that list it and their own prices and
--      links (offers), kept current by a trigger on raw_listings.
--   3. A latest-activity date (new listing or last price drop) for the
--      default sort: Newest & recent price drops.
--   4. RPCs the dashboard calls instead of loading every listing:
--        get_map_pins       one light pin per group, for Mapbox
--        get_listing_page   one page of groups, keyset (cursor) paging
--        get_market_facets  counts for the status tabs, summary and filters
--        get_group_detail   everything about one pin, loaded on click
--
-- Group keys: 'p:<project id>' (a project), 'h:<property id>' (one home,
-- possibly listed by several agencies), 'm:<agent listing id>' (a member's
-- hand-added listing). Every RPC runs as the member (security invoker), so
-- the existing row-level security decides what they see.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Projects ---------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  market_id   text not null default 'aw-lux',
  name        text not null check (char_length(name) between 1 and 160),
  district    text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
create policy "Members read projects" on public.projects for select to authenticated using (true);
revoke all on public.projects from anon;
revoke insert, update, delete on public.projects from authenticated;
grant select on public.projects to authenticated;
grant all on public.projects to service_role;

alter table public.property_master
  add column project_id   uuid references public.projects (id) on delete set null,
  add column agency_ids   text[] not null default '{}',   -- every agency listing this home
  add column offers       jsonb  not null default '[]',   -- each agency's own price and link
  add column last_drop_on date,                            -- day of the last price drop (Aruba time)
  add column activity_on  date generated always as (greatest(first_seen, coalesce(last_drop_on, first_seen))) stored;

-- each agency's own asking price in USD (written by the normaliser)
alter table public.raw_listings add column price_usd numeric(14, 2);

-- 2. Indexes ------------------------------------------------------------------
create index property_master_project_idx  on public.property_master (project_id) where project_id is not null;
create index property_master_geo_idx      on public.property_master using gist (point(lng, lat)) where status = 'active';
create index property_master_rooms_idx    on public.property_master (district, bedrooms, bathrooms) where status = 'active';
create index property_master_activity_idx on public.property_master (activity_on desc, id desc) where status = 'active';
create index property_master_updated_idx  on public.property_master (updated_at desc, id desc) where status = 'active';
create index property_master_agencies_idx on public.property_master using gin (agency_ids);
create index if not exists raw_listings_property_idx on public.raw_listings (property_id) where property_id is not null;

-- 3. Price drops stamp their day -----------------------------------------------
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
    if new.asking_price_usd < old.asking_price_usd then
      new.last_drop_on := public.aruba_today();
    end if;
  end if;
  if new.listing_status is distinct from old.listing_status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

update public.property_master pm
   set last_drop_on = d.day
  from (select property_id, max(observed_on) as day
          from public.listing_events where event = 'Price drop' group by property_id) d
 where d.property_id = pm.id;

-- 4. Who lists each home, at what price -------------------------------------------
create or replace function public.property_master_refresh_offers(p_ids uuid[])
returns void
language sql
security definer set search_path = ''
as $$
  with x as (
    select pm.id,
           coalesce(array_agg(distinct r.agency_id) filter (where r.id is not null), array[pm.agency_id]) as ids,
           coalesce(jsonb_agg(jsonb_build_object(
               'agency_id',  r.agency_id,
               'agency',     a.name,
               'logo_url',   a.logo_url,
               'website',    a.website,
               'price_usd',  coalesce(r.price_usd, case when r.agency_id = pm.agency_id then pm.asking_price_usd end),
               'source_url', r.source_url,
               'last_seen',  r.last_scraped_at,
               'primary',    r.agency_id = pm.agency_id)
             order by coalesce(r.price_usd, pm.asking_price_usd), a.name) filter (where r.id is not null), '[]'::jsonb) as offers
      from public.property_master pm
      left join public.raw_listings r on r.property_id = pm.id and r.process_error is null
      left join public.agencies a on a.id = r.agency_id
     where pm.id = any (p_ids)
     group by pm.id, pm.agency_id
  )
  update public.property_master pm
     set agency_ids = x.ids, offers = x.offers
    from x
   where pm.id = x.id
     and (pm.agency_ids is distinct from x.ids or pm.offers is distinct from x.offers);
$$;
revoke all on function public.property_master_refresh_offers(uuid[]) from public, anon, authenticated;

create or replace function public.raw_listings_sync_offers()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.property_master_refresh_offers(array_remove(array[
    case when tg_op <> 'INSERT' then old.property_id end,
    case when tg_op <> 'DELETE' then new.property_id end], null));
  return null;
end;
$$;
create trigger raw_listings_sync_offers
  after insert or delete or update of property_id, price_usd, process_error, source_url, last_scraped_at on public.raw_listings
  for each row execute function public.raw_listings_sync_offers();

-- The normaliser also records each agency's own price.
drop function public.mark_raw_processed(bigint, uuid, text);
create function public.mark_raw_processed(p_raw_id bigint, p_property_id uuid, p_error text default null, p_price_usd numeric default null)
returns void
language sql
security definer set search_path = ''
as $$
  update public.raw_listings
     set property_id  = coalesce(p_property_id, property_id),
         processed_at = case when p_error is null then now() end,
         process_error = p_error,
         price_usd    = coalesce(p_price_usd, price_usd)
   where id = p_raw_id;
$$;
revoke all on function public.mark_raw_processed(bigint, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.mark_raw_processed(bigint, uuid, text, numeric) to service_role;

-- 5. Where pinless member listings sit (near the district centre) -------------------
create or replace function public.district_spot(p_district text, p_seed text)
returns point
language sql
immutable
set search_path = ''
as $$
  with c(d, lat, lng) as (values
    ('Arashi', 12.6105, -70.048), ('Tierra del Sol', 12.6051, -70.0401), ('Malmok', 12.6017, -70.0453),
    ('Boca Catalina', 12.5979, -70.0441), ('Gold Coast', 12.6005, -70.0395), ('Palm Beach', 12.5735, -70.041),
    ('Noord', 12.58, -70.031), ('Eagle Beach', 12.5545, -70.051), ('Oranjestad', 12.521, -70.0335),
    ('Pos Chiquito', 12.476, -69.97), ('Savaneta', 12.4545, -69.945), ('Santa Cruz', 12.506, -69.984)),
  h(v) as (select abs(hashtext(p_seed)))
  select point(
    coalesce((select lng from c where d = p_district), -70.0) + cos((v % 1000) / 1000.0 * 2 * pi()) * (0.002 + ((v / 1024) % 100) / 100.0 * 0.003) * 0.6,
    coalesce((select lat from c where d = p_district), 12.52) + sin((v % 1000) / 1000.0 * 2 * pi()) * (0.002 + ((v / 1024) % 100) / 100.0 * 0.003))
  from h;
$$;

-- 6. Everything a member can see, one row per listing ---------------------------------
create view public.v_market_items
with (security_invoker = true) as
select pm.listing_id                                                     as ref,
       'indexed'::text                                                   as kind,
       pm.id                                                             as property_id,
       null::uuid                                                        as member_id,
       pm.project_id,
       case when pm.project_id is not null then 'p:' || pm.project_id else 'h:' || pm.id end as group_key,
       case when pm.project_id is not null then 'project' else 'property' end              as group_type,
       pm.market_id,
       pm.asset_class                                                    as category,
       pm.property_type,
       case pm.asset_class when 'Land' then pm.zoning when 'Commercial' then pm.commercial_use else pm.property_type end as subtype,
       pm.asset_name,
       pr.name                                                           as project_name,
       pm.district,
       pm.lat,
       pm.lng,
       pm.asking_price_usd                                               as price,
       pm.price_per_sqft_usd                                             as psf,
       pm.bedrooms,
       pm.bathrooms,
       pm.built_sqft,
       pm.lot_sqft,
       case when pm.asset_class = 'Land' then pm.lot_sqft else pm.built_sqft end as size_sqft,
       pm.pool,
       pm.tenure,
       case when pm.asset_class = 'Property' and pm.comps_count > 0 then pm.signal else 'NO_SIGNAL' end as signal,
       case when pm.asset_class = 'Property' and pm.comps_count > 0 then pm.price_vs_comps_pct end      as vs_comps_pct,
       pm.listing_status                                                 as status,
       greatest(pm.days_on_market, public.aruba_today() - pm.first_seen) as days_on_market,
       pm.first_seen = public.aruba_today()                              as is_new,
       pm.price_change_pct,
       pm.activity_on,
       pm.confidence_score,
       pm.agency_id,
       a.name                                                            as agency_name,
       pm.agency_ids,
       pm.photo_url,
       pm.last_scraped_at,
       pm.updated_at
  from public.property_master pm
  join public.agencies a on a.id = pm.agency_id
  left join public.projects pr on pr.id = pm.project_id
 where pm.status = 'active' and pm.confidence_score > 0
union all
select al.ref,
       'member',
       null,
       al.id,
       null,
       'm:' || al.id,
       'member',
       al.market_id,
       al.asset_class,
       al.property_type,
       case al.asset_class when 'Land' then al.zoning when 'Commercial' then al.commercial_use else al.property_type end,
       al.asset_name,
       null,
       al.district,
       coalesce(al.lat, (public.district_spot(al.district, al.id::text))[1]),
       coalesce(al.lng, (public.district_spot(al.district, al.id::text))[0]),
       al.asking_price_usd,
       round(al.asking_price_usd / nullif(case when al.asset_class = 'Land' then al.lot_sqft else al.built_sqft end, 0)),
       al.bedrooms,
       al.bathrooms,
       al.built_sqft,
       al.lot_sqft,
       case when al.asset_class = 'Land' then al.lot_sqft else al.built_sqft end,
       case when al.asset_class = 'Land' then null else al.pool end,
       al.tenure,
       'NO_SIGNAL',
       null,
       case al.listing_status when 'Withdrawn' then 'De-listed' else al.listing_status end,
       public.aruba_today() - (al.created_at at time zone 'America/Aruba')::date,
       (al.created_at at time zone 'America/Aruba')::date = public.aruba_today(),
       0,
       (al.created_at at time zone 'America/Aruba')::date,
       100,
       'member-' || al.owner_id,
       coalesce(nullif(trim(p.company), ''), p.name),
       array['member-' || al.owner_id],
       al.photo_url,
       al.updated_at,
       al.updated_at
  from public.agent_listings al
  join public.profiles p on p.id = al.owner_id;

revoke all on public.v_market_items from anon;
grant select on public.v_market_items to authenticated, service_role;

-- 7. The filters, shared by every RPC ---------------------------------------------------
-- f: { status, category, subtypes[], district, agency (agency id), signal,
--      tenure ('Eigendom'|'Erfpacht'|'None'), pool ('Has pool'|...), new_today,
--      off_market, price_min, price_max, beds_min, size_min_m2, new_7d, drops,
--      reliable, q, bbox: [west, south, east, north] }  (missing = no filter)
create or replace function public.market_items(f jsonb, p_with_status boolean default true)
returns setof public.v_market_items
language sql
stable
security invoker
set search_path = ''
as $$
  select i.*
    from public.v_market_items i
   where (not p_with_status or f->>'status' is null or i.status = f->>'status')
     and (coalesce(f->>'category', 'All') = 'All' or i.category = f->>'category')
     and (coalesce(jsonb_array_length(f->'subtypes'), 0) = 0
          or (case when coalesce(f->>'category', 'All') = 'All' then i.property_type else i.subtype end)
             in (select jsonb_array_elements_text(f->'subtypes')))
     and (f->>'district' is null or i.district = f->>'district')
     and (f->>'agency' is null or f->>'agency' = any (i.agency_ids))
     and (f->>'signal' is null or i.status in ('Sold', 'De-listed') or i.signal = f->>'signal')
     and (f->>'tenure' is null or (case when f->>'tenure' = 'None' then i.tenure is null else i.tenure = f->>'tenure' end))
     and (f->>'pool' is null
          or (f->>'pool' = 'Has pool' and i.pool in ('Private pool', 'Shared pool'))
          or i.pool = f->>'pool')
     and (not coalesce((f->>'new_today')::boolean, false) or i.is_new)
     and (not coalesce((f->>'off_market')::boolean, false) or i.kind = 'member')
     and (f->>'price_min' is null or i.price >= (f->>'price_min')::numeric)
     and (f->>'price_max' is null or i.price <= (f->>'price_max')::numeric)
     and (f->>'beds_min' is null or (i.category = 'Property' and i.bedrooms >= (f->>'beds_min')::int))
     and (f->>'size_min_m2' is null or coalesce(round(i.size_sqft / 10.7639), 0) >= (f->>'size_min_m2')::int)
     and (not coalesce((f->>'new_7d')::boolean, false) or i.days_on_market <= 7)
     and (not coalesce((f->>'drops')::boolean, false) or i.price_change_pct < 0)
     and (not coalesce((f->>'reliable')::boolean, false) or i.confidence_score >= 80)
     and (coalesce(f->>'q', '') = ''
          or concat_ws(' ', i.asset_name, i.project_name, i.district, i.ref, i.agency_name, i.subtype, i.property_type,
                       coalesce(i.tenure, 'Title not stated')) ilike '%' || (f->>'q') || '%')
     and (f->'bbox' is null
          or point(i.lng, i.lat) <@ box(point((f->'bbox'->>0)::float8, (f->'bbox'->>1)::float8),
                                        point((f->'bbox'->>2)::float8, (f->'bbox'->>3)::float8)));
$$;

-- One row per group over the filtered listings. The group's representative
-- is its cheapest matching listing.
create or replace function public.market_groups(f jsonb)
returns table (
  group_key text, group_type text, title text, lat float8, lng float8,
  min_price numeric, max_price numeric, unit_count int, agency_ids text[],
  rep_ref text, rep_kind text, rep_property_id uuid, category text, signal text, district text,
  bedrooms int, bathrooms numeric, size_sqft int, psf numeric, vs_comps_pct numeric, days_on_market int,
  is_new boolean, price_change_pct numeric, activity_on date, confidence_score int, status text,
  thumbnail_url text, asset_name text, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.group_key,
         min(i.group_type),
         coalesce(min(i.project_name), (array_agg(i.asset_name order by i.price, i.ref))[1]),
         avg(i.lat),
         avg(i.lng),
         min(i.price),
         max(i.price),
         count(*)::int,
         -- every agency across the group (agency ids hold no commas)
         array(select distinct x from unnest(string_to_array(string_agg(array_to_string(i.agency_ids, ','), ','), ',')) x order by 1),
         (array_agg(i.ref order by i.price, i.ref))[1],
         (array_agg(i.kind order by i.price, i.ref))[1],
         (array_agg(i.property_id order by i.price, i.ref))[1],
         (array_agg(i.category order by i.price, i.ref))[1],
         (array_agg(i.signal order by i.price, i.ref))[1],
         min(i.district),
         (array_agg(i.bedrooms order by i.price, i.ref))[1]::int,
         (array_agg(i.bathrooms order by i.price, i.ref))[1],
         (array_agg(i.size_sqft order by i.price, i.ref))[1]::int,
         (array_agg(i.psf order by i.price, i.ref))[1],
         (array_agg(i.vs_comps_pct order by i.price, i.ref))[1],
         min(i.days_on_market)::int,
         bool_or(i.is_new),
         min(i.price_change_pct),
         max(i.activity_on),
         max(i.confidence_score)::int,
         (array_agg(i.status order by i.price, i.ref))[1],
         (array_agg(i.photo_url order by (i.photo_url is null), i.price, i.ref))[1],
         (array_agg(i.asset_name order by i.price, i.ref))[1],
         max(i.updated_at)
    from public.market_items(f) i
   group by i.group_key;
$$;

-- 8. get_map_pins: one light pin per group ------------------------------------------------
create or replace function public.get_map_pins(f jsonb default '{}')
returns table (
  group_key text, group_type text, title text, lat float8, lng float8,
  min_price numeric, max_price numeric, unit_count int, agency_count int, agency_ids text[],
  rep_ref text, category text, signal text, district text, bedrooms int, bathrooms numeric,
  size_sqft int, is_new boolean, price_change_pct numeric, thumbnail_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.group_key, g.group_type, g.title, g.lat, g.lng, g.min_price, g.max_price, g.unit_count,
         cardinality(g.agency_ids), g.agency_ids, g.rep_ref, g.category, g.signal, g.district,
         g.bedrooms, g.bathrooms, g.size_sqft, g.is_new, g.price_change_pct, g.thumbnail_url
    from public.market_groups(f - 'bbox') g;
$$;

-- 9. get_listing_page: keyset (cursor) paging over groups -----------------------------------
-- p_sort: activity (default: newest & recent price drops) | listed | asking | psf | vsDistrict |
--         beds | baths | built | lot | confidence | name | district | status
-- p_cursor: the next_cursor of the previous page ({"n": number|null, "t": text|null, "k": group_key}).
-- Returns { total, items: [...], next_cursor } with the representative listing of each
-- indexed group in the same shape as v_master_market (so the list renders it as before).
create or replace function public.get_listing_page(
  f jsonb default '{}',
  p_sort text default 'activity',
  p_dir text default 'desc',
  p_cursor jsonb default null,
  p_limit int default 24
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with g as (
    select g.*,
           case p_sort
             when 'activity'   then extract(epoch from g.activity_on)::numeric
             when 'listed'     then g.days_on_market
             when 'asking'     then case when p_dir = 'desc' then g.max_price else g.min_price end
             when 'psf'        then g.psf
             when 'vsDistrict' then case when g.category = 'Property' and g.signal <> 'NO_SIGNAL' then g.vs_comps_pct end
             when 'beds'       then case when g.category = 'Property' then g.bedrooms end
             when 'baths'      then case when g.category = 'Property' then g.bathrooms end
             when 'built'      then case when g.category <> 'Land' then g.size_sqft end
             when 'lot'        then case when g.category = 'Land' then g.size_sqft end
             when 'confidence' then g.confidence_score
             when 'status'     then array_position(array['For sale', 'Under contract', 'Sold', 'De-listed'], g.status)
           end as sn,
           case p_sort when 'name' then lower(g.title) when 'district' then lower(g.district) end as st
      from public.market_groups(f) g
  ),
  -- N/A always last, whichever way
  k as (
    select g.*,
           case when p_dir = 'desc' then coalesce(sn, -1e18) else coalesce(sn, 1e18) end as kn,
           case when p_dir = 'desc' then coalesce(st, '') else coalesce(st, chr(1114111)) end as kt
      from g
  ),
  c as (
    select (p_cursor->>'n')::numeric as n, p_cursor->>'t' as t, p_cursor->>'k' as k
  ),
  page as (
    select k.*
      from k, c
     where p_cursor is null
        or (p_dir = 'desc' and (k.kn < c.n or (k.kn = c.n and (k.kt < c.t or (k.kt = c.t and k.group_key > c.k)))))
        or (p_dir <> 'desc' and (k.kn > c.n or (k.kn = c.n and (k.kt > c.t or (k.kt = c.t and k.group_key > c.k)))))
     order by case when p_dir = 'desc' then k.kn end desc,
              case when p_dir <> 'desc' then k.kn end asc,
              case when p_dir = 'desc' then k.kt end desc,
              case when p_dir <> 'desc' then k.kt end asc,
              k.group_key
     limit greatest(1, least(p_limit, 100)) + 1
  ),
  numbered as (
    select page.*, row_number() over (order by
             case when p_dir = 'desc' then kn end desc, case when p_dir <> 'desc' then kn end asc,
             case when p_dir = 'desc' then kt end desc, case when p_dir <> 'desc' then kt end asc, group_key) as rn
      from page
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'group_key', n.group_key, 'group_type', n.group_type, 'title', n.title,
               'lat', n.lat, 'lng', n.lng, 'min_price', n.min_price, 'max_price', n.max_price,
               'unit_count', n.unit_count, 'agency_ids', n.agency_ids, 'agency_count', cardinality(n.agency_ids),
               'rep_ref', n.rep_ref, 'rep_kind', n.rep_kind,
               'rep', (select to_jsonb(v) from public.v_master_market v where v.property_id = n.rep_property_id))
             order by n.rn)
        from numbered n
       where n.rn <= greatest(1, least(p_limit, 100))), '[]'::jsonb),
    'next_cursor', (
      select jsonb_build_object('n', n.kn, 't', n.kt, 'k', n.group_key)
        from numbered n
       where n.rn = greatest(1, least(p_limit, 100))
         and exists (select 1 from numbered m where m.rn > n.rn))
  );
$$;

-- 10. get_market_facets: status tabs, summary tiles and filter choices ----------------------
create or replace function public.get_market_facets(f jsonb default '{}')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with all_status as (select * from public.market_items(f, false)),
       here as (select * from all_status where f->>'status' is null or status = f->>'status'),
       groups as (select group_key from here group by group_key),
       everything as (select * from public.market_items(jsonb_build_object('status', f->>'status'), true))
  select jsonb_build_object(
    'status_counts', (select coalesce(jsonb_object_agg(status, n), '{}') from
                        (select status, count(distinct group_key) as n from all_status group by status) s),
    'groups', (select count(*) from groups),
    'listings', (select count(*) from here),
    'residential', (select count(*) from here where category = 'Property'),
    'land', (select count(*) from here where category = 'Land'),
    'commercial', (select count(*) from here where category = 'Commercial'),
    'median_price', (select percentile_cont(0.5) within group (order by price) from here),
    'below_market', (select count(*) from here where signal = 'UNDERVALUED'),
    'new_today', (select count(*) from everything where is_new),
    'off_market', (select count(*) from everything where kind = 'member'),
    'agencies', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url, 'count', n) order by n desc, name), '[]')
                   from (select x.id, coalesce(a.name, min(e.agency_name)) as name, a.logo_url, count(*) as n
                           from everything e cross join lateral unnest(e.agency_ids) as x(id)
                           left join public.agencies a on a.id = x.id
                          group by x.id, a.name, a.logo_url) s),
    'districts', (select coalesce(jsonb_agg(d order by d), '[]') from (select distinct district as d from public.v_market_items) s),
    'updated_at', (select max(last_scraped_at) from public.v_market_items where kind = 'indexed')
  );
$$;

-- 11. get_group_detail: everything about one pin, loaded on click ---------------------------
-- Every listing in the group (v_master_market shape; members' listings by ref only, the
-- dashboard already holds those) with each agency's own price and link.
create or replace function public.get_group_detail(p_group_key text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with items as (select * from public.v_market_items where group_key = p_group_key)
  select jsonb_build_object(
    'group_key', p_group_key,
    'group_type', (select min(group_type) from items),
    'project', (select to_jsonb(p) from public.projects p
                 where p.id = (select project_id from items where project_id is not null limit 1)),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ref', i.ref, 'kind', i.kind,
               'listing', (select to_jsonb(v) from public.v_master_market v where v.property_id = i.property_id),
               'offers', (select pm.offers from public.property_master pm where pm.id = i.property_id))
             order by i.status, i.price, i.ref)
        from items i), '[]'::jsonb)
  );
$$;

revoke all on function public.market_items(jsonb, boolean), public.market_groups(jsonb), public.get_map_pins(jsonb),
  public.get_listing_page(jsonb, text, text, jsonb, int), public.get_market_facets(jsonb), public.get_group_detail(text)
  from public, anon;
grant execute on function public.market_items(jsonb, boolean), public.market_groups(jsonb), public.get_map_pins(jsonb),
  public.get_listing_page(jsonb, text, text, jsonb, int), public.get_market_facets(jsonb), public.get_group_detail(text)
  to authenticated, service_role;

-- Fill agency_ids and offers for every existing home.
select public.property_master_refresh_offers(array(select id from public.property_master));
