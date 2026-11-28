-- Let Postgres inline the listing filters into each call (28 November 2026).
-- A set-returning SQL function is only inlined when it has no SET clause.
-- These run as the member (security invoker) and name every object with its
-- schema, so an empty search_path added nothing; without it each call is
-- planned once with its filters as constants (≈10 ms less per call, and the
-- map box can use the location index).
alter function public.market_items(jsonb, boolean) reset search_path;
alter function public.market_groups(jsonb) reset search_path;
alter function public.get_map_pins(jsonb) reset search_path;
