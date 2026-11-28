-- Baseline: the landing page's live showcase (28 November 2026).
--
-- The public home page shows the real market in its hero: how many listings
-- are indexed, one map pin per home or building project, and a few real
-- homes to tour (a new listing, one below market, one listed by several
-- agencies, a project, a leasehold, under contract, sold, a price reduced,
-- an upcoming notary auction).
--
-- Visitors are not signed in, and property_master is members-only (RLS), so
-- this one function reads it as its owner and returns only what the page
-- needs. Never returned: agencies, agents, source links, photos, the agency
-- text, or the notary office. Agency names are scrubbed from listing titles.

create or replace function public.landing_showcase()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select
      m.*,
      cardinality(coalesce(m.agency_ids, '{}')) as agencies,
      -- a title without any agency's name in it
      nullif(btrim(regexp_replace(
        regexp_replace(m.asset_name,
          '(re/?max( aruba)?|keller williams( aruba)?|\mkw\M( aruba)?|bold real estate( aruba)?|mpg( real estate)?( aruba)?|weichert( aruba)?( realty)?|coldwell banker( aruba)?( realty)?|all property aruba|berkshire hathaway( homeservices)?( aruba)?( realty)?|\mbhhs\M|sotheby''?s( international realty)?|century ?21)',
          '', 'gi'),
        '\s*[|·–—-]\s*$|^\s*[|·–—-]\s*', '', 'g'), ' |·–—-'), '') as clean_title
    from public.property_master m
    where m.status = 'active' and m.confidence_score > 0
  ),
  card as (
    select l.id, jsonb_build_object(
      'ref', l.listing_id,
      'title', coalesce(l.clean_title, initcap(l.property_type) || ' in ' || l.district),
      'district', l.district,
      'asset_class', l.asset_class,
      'property_type', l.property_type,
      'bedrooms', l.bedrooms,
      'bathrooms', l.bathrooms,
      'built_sqft', l.built_sqft,
      'lot_sqft', l.lot_sqft,
      'price', l.asking_price_usd,
      'tenure', l.tenure,
      'signal', l.signal,
      'vs_comps', l.price_vs_comps_pct,
      'psf', l.price_per_sqft_usd,
      'comps_psf', l.comps_psf_usd,
      'comps_count', l.comps_count,
      'status', l.listing_status,
      'agencies', l.agencies,
      'first_seen', l.first_seen,
      'lat', l.lat,
      'lng', l.lng
    ) as j
    from live l
  ),
  groups as (
    -- one pin per building project or home (sold homes stay off the map)
    select
      coalesce('p:' || l.project_id::text, l.listing_id) as k,
      avg(l.lat) as lat, avg(l.lng) as lng,
      min(l.asset_class) as c,
      (array_agg(coalesce(l.signal, 'NO_SIGNAL') order by l.asking_price_usd))[1] as s,
      count(*) as u,
      max(l.agencies) as n,
      min(l.asking_price_usd) as lo,
      max(l.asking_price_usd) as hi,
      bool_or(l.first_seen::date >= current_date - 1) as fresh
    from live l
    where l.listing_status <> 'Sold' and l.lat is not null
    group by 1
  )
  select jsonb_build_object(
    'as_of', now(),
    'counts', (select jsonb_build_object(
      'indexed', count(*),
      'for_sale', count(*) filter (where listing_status = 'For sale'),
      'under_contract', count(*) filter (where listing_status = 'Under contract'),
      'sold', count(*) filter (where listing_status = 'Sold'),
      'new_today', count(*) filter (where first_seen::date >= current_date - 1),
      'below_market', count(*) filter (where signal = 'UNDERVALUED' and listing_status = 'For sale'),
      'several_agencies', count(*) filter (where agencies > 1),
      'leasehold', count(*) filter (where tenure = 'Erfpacht')
    ) from live),
    'pins', (select coalesce(jsonb_agg(jsonb_build_object(
      'k', g.k, 'lat', g.lat, 'lng', g.lng, 'c', g.c, 's', g.s, 'u', g.u, 'n', g.n, 'lo', g.lo, 'hi', g.hi, 'fresh', g.fresh
    )), '[]') from groups g),
    'picks', jsonb_build_object(
      'newest', (select c.j from card c join live l using (id) where l.asset_class = 'Property' and l.listing_status = 'For sale' and l.lat is not null and l.project_id is null order by l.first_seen desc, l.asking_price_usd desc limit 1),
      'below', (select c.j from card c join live l using (id) where l.signal = 'UNDERVALUED' and l.listing_status = 'For sale' and l.project_id is null order by l.price_vs_comps_pct limit 1),
      'several', (select c.j from card c join live l using (id) where l.agencies > 1 and l.listing_status = 'For sale' and l.project_id is null order by l.agencies desc, l.asking_price_usd desc limit 1),
      'project', (select jsonb_build_object('key', 'p:' || p.id, 'name', p.name, 'district', p.district, 'units', count(*), 'lo', min(l.asking_price_usd), 'hi', max(l.asking_price_usd), 'lat', avg(l.lat), 'lng', avg(l.lng))
                  from public.projects p join live l on l.project_id = p.id
                  where l.listing_status <> 'Sold'
                  group by p.id order by count(*) desc limit 1),
      'leasehold', (select c.j from card c join live l using (id) where l.tenure = 'Erfpacht' and l.asset_class = 'Property' and l.listing_status = 'For sale' and l.project_id is null order by l.asking_price_usd desc limit 1),
      'contract', (select c.j from card c join live l using (id) where l.listing_status = 'Under contract' and l.asset_class = 'Property' and l.project_id is null and l.lat is not null order by l.status_changed_at desc nulls last limit 1),
      'sold', (select c.j from card c join live l using (id) where l.listing_status = 'Sold' and l.asset_class = 'Property' and l.lat is not null order by l.asking_price_usd desc limit 1),
      'reduced', (select c.j from card c join live l using (id)
                  where l.listing_status = 'For sale' and l.project_id is null and exists (
                    select 1 from public.raw_listings r where r.property_id = l.id and r.raw_payload->>'price_reduced_badge' = 'true')
                  order by l.asking_price_usd desc limit 1),
      'homes', (select coalesce(jsonb_agg(x.j), '[]') from (
                  select c.j from card c join live l using (id)
                  where l.asset_class = 'Property' and l.listing_status = 'For sale' and l.project_id is null
                    and l.bedrooms between 2 and 5 and l.asking_price_usd between 350000 and 2500000 and l.lat is not null
                  order by l.listing_id limit 6) x),
      'auction', (select jsonb_build_object(
                    'district', a.district, 'property_type', a.property_type, 'tenure', a.land_tenure,
                    'date', a.auction_date, 'status', a.status, 'lat', a.lat, 'lng', a.lng)
                  from public.notary_auctions a
                  where a.status = 'upcoming' and a.auction_date >= now() and a.lat is not null
                  order by a.auction_date limit 1)
    )
  );
$$;

revoke all on function public.landing_showcase() from public;
grant execute on function public.landing_showcase() to anon, authenticated;

comment on function public.landing_showcase() is
  'Landing page hero: counts, one pin per home or project, and a few real homes to tour. No agencies, agents, links or photos.';
