-- Speed for get_map_pins / get_listing_page at 10,000+ listings (28 November 2026).
--
--  * v_market_items called aruba_today() for every row (a function call with
--    its own search_path, ~25 µs each: most of the time at 10k rows). It is
--    now worked out once per query (a scalar subquery).
--  * market_groups picked each group's representative with 17 sorted
--    aggregates; it now takes the cheapest listing once (distinct on) and
--    joins the group totals to it.

create or replace view public.v_market_items
with (security_invoker = true) as
with today as (select public.aruba_today() as d)
select pm.listing_id as ref, 'indexed'::text as kind, pm.id as property_id, null::uuid as member_id, pm.project_id,
       case when pm.project_id is not null then 'p:' || pm.project_id else 'h:' || pm.id end as group_key,
       case when pm.project_id is not null then 'project' else 'property' end as group_type,
       pm.market_id, pm.asset_class as category, pm.property_type,
       case pm.asset_class when 'Land' then pm.zoning when 'Commercial' then pm.commercial_use else pm.property_type end as subtype,
       pm.asset_name, pr.name as project_name, pm.district, pm.lat, pm.lng,
       pm.asking_price_usd as price, pm.price_per_sqft_usd as psf, pm.bedrooms, pm.bathrooms, pm.built_sqft, pm.lot_sqft,
       case when pm.asset_class = 'Land' then pm.lot_sqft else pm.built_sqft end as size_sqft,
       pm.pool, pm.tenure,
       case when pm.asset_class = 'Property' and pm.comps_count > 0 then pm.signal else 'NO_SIGNAL' end as signal,
       case when pm.asset_class = 'Property' and pm.comps_count > 0 then pm.price_vs_comps_pct end as vs_comps_pct,
       pm.listing_status as status,
       greatest(pm.days_on_market, today.d - pm.first_seen) as days_on_market,
       pm.first_seen = today.d as is_new,
       pm.price_change_pct, pm.activity_on, pm.confidence_score, pm.agency_id, a.name as agency_name, pm.agency_ids,
       pm.photo_url, pm.last_scraped_at, pm.updated_at
  from public.property_master pm
  cross join today
  join public.agencies a on a.id = pm.agency_id
  left join public.projects pr on pr.id = pm.project_id
 where pm.status = 'active' and pm.confidence_score > 0
union all
select al.ref, 'member', null, al.id, null, 'm:' || al.id, 'member', al.market_id, al.asset_class, al.property_type,
       case al.asset_class when 'Land' then al.zoning when 'Commercial' then al.commercial_use else al.property_type end,
       al.asset_name, null, al.district,
       coalesce(al.lat, (public.district_spot(al.district, al.id::text))[1]),
       coalesce(al.lng, (public.district_spot(al.district, al.id::text))[0]),
       al.asking_price_usd,
       round(al.asking_price_usd / nullif(case when al.asset_class = 'Land' then al.lot_sqft else al.built_sqft end, 0)),
       al.bedrooms, al.bathrooms, al.built_sqft, al.lot_sqft,
       case when al.asset_class = 'Land' then al.lot_sqft else al.built_sqft end,
       case when al.asset_class = 'Land' then null else al.pool end,
       al.tenure, 'NO_SIGNAL', null,
       case al.listing_status when 'Withdrawn' then 'De-listed' else al.listing_status end,
       today.d - (al.created_at at time zone 'America/Aruba')::date,
       (al.created_at at time zone 'America/Aruba')::date = today.d,
       0, (al.created_at at time zone 'America/Aruba')::date, 100,
       'member-' || al.owner_id, coalesce(nullif(trim(p.company), ''), p.name), array['member-' || al.owner_id],
       al.photo_url, al.updated_at, al.updated_at
  from public.agent_listings al
  cross join today
  join public.profiles p on p.id = al.owner_id;

create or replace function public.market_groups(f jsonb)
returns table (
  group_key text, group_type text, title text, lat float8, lng float8,
  min_price numeric, max_price numeric, unit_count int, agency_ids text[],
  rep_ref text, rep_kind text, rep_property_id uuid, category text, signal text, district text,
  bedrooms int, bathrooms numeric, size_sqft int, psf numeric, vs_comps_pct numeric, days_on_market int,
  is_new boolean, price_change_pct numeric, activity_on date, confidence_score int, status text,
  thumbnail_url text, asset_name text, updated_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  with i as materialized (select * from public.market_items(f)),
  rep as (select distinct on (i.group_key) i.* from i order by i.group_key, i.price, i.ref),
  tot as (
    select i.group_key, count(*)::int as n, min(i.price) as mn, max(i.price) as mx, avg(i.lat) as la, avg(i.lng) as lo,
           bool_or(i.is_new) as nw, min(i.days_on_market)::int as dom, max(i.activity_on) as act, max(i.confidence_score)::int as conf,
           min(i.price_change_pct) as pc, max(i.updated_at) as up, min(i.project_name) as pn,
           (array_agg(i.photo_url order by i.price, i.ref) filter (where i.photo_url is not null))[1] as thumb
      from i group by i.group_key
  ),
  ag as (
    select i.group_key, array_agg(distinct x order by x) as ids
      from i cross join lateral unnest(i.agency_ids) as x
     group by i.group_key
  )
  select t.group_key, r.group_type, coalesce(t.pn, r.asset_name), t.la, t.lo, t.mn, t.mx, t.n, coalesce(ag.ids, '{}'),
         r.ref, r.kind, r.property_id, r.category, r.signal, r.district,
         r.bedrooms::int, r.bathrooms, r.size_sqft::int, r.psf, r.vs_comps_pct, t.dom,
         t.nw, t.pc, t.act, t.conf, r.status, coalesce(t.thumb, r.photo_url), r.asset_name, t.up
    from tot t
    join rep r on r.group_key = t.group_key
    left join ag on ag.group_key = t.group_key;
$$;
