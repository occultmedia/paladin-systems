-- market_groups in one pass (28 November 2026).
--
-- Measured on a 10,340-listing copy (PGlite): get_listing_page took 9.5 s for
-- the whole island. market_groups joined two summaries of the same listings
-- (the cheapest listing per group, and the group totals); Postgres cannot
-- estimate how many rows such summaries hold and matched every group against
-- every other one. Now one sort: the group totals are window aggregates over
-- each group, and DISTINCT ON keeps the group's cheapest listing.

create or replace function public.market_groups(f jsonb)
returns table (
  group_key text, group_type text, title text, lat float8, lng float8,
  min_price numeric, max_price numeric, unit_count int, agency_ids text[],
  rep_ref text, rep_kind text, rep_property_id uuid, category text, signal text, district text,
  bedrooms int, bathrooms numeric, size_sqft int, psf numeric, vs_comps_pct numeric, days_on_market int,
  is_new boolean, price_change_pct numeric, activity_on date, confidence_score int, status text,
  thumbnail_url text, asset_name text, updated_at timestamptz
)
language sql stable security invoker
as $$
  with w as (
    select distinct on (i.group_key) i.*,
           count(*) over g                 as n,
           min(i.price) over g             as mn,
           max(i.price) over g             as mx,
           avg(i.lat) over g               as la,
           avg(i.lng) over g               as lo,
           bool_or(i.is_new) over g        as nw,
           min(i.days_on_market) over g    as dom,
           max(i.activity_on) over g       as act,
           max(i.confidence_score) over g  as conf,
           min(i.price_change_pct) over g  as pc,
           max(i.updated_at) over g        as up,
           min(i.project_name) over g      as pn,
           max(i.photo_url) over g         as any_photo,
           -- every agency across the group (agency ids hold no commas)
           string_agg(array_to_string(i.agency_ids, ','), ',') over g as ags
      from public.market_items(f) i
    window g as (partition by i.group_key)
     order by i.group_key, i.price, i.ref
  )
  select w.group_key, w.group_type, coalesce(w.pn, w.asset_name), w.la, w.lo, w.mn, w.mx, w.n::int,
         array(select distinct x from unnest(string_to_array(w.ags, ',')) as x where x <> '' order by 1),
         w.ref, w.kind, w.property_id, w.category, w.signal, w.district,
         w.bedrooms::int, w.bathrooms, w.size_sqft::int, w.psf, w.vs_comps_pct, w.dom::int,
         w.nw, w.pc, w.act, w.conf::int, w.status, coalesce(w.photo_url, w.any_photo), w.asset_name, w.up
    from w;
$$;

-- get_market_facets: the counts beside "New today", "Off-market" and the agency
-- list (whole tab, other filters ignored) read the tab's listings directly
-- instead of re-running every filter with a filter object built per row
-- (75 ms of its 210 ms on the 10,340-listing copy).
create or replace function public.get_market_facets(f jsonb default '{}')
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with all_status as (select * from public.market_items(f, false)),
       here as (select * from all_status where f->>'status' is null or status = f->>'status'),
       groups as (select group_key from here group by group_key),
       everything as (select * from public.v_market_items v where f->>'status' is null or v.status = f->>'status')
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
