-- raw_listings_sync_offers only runs as a trigger; nobody calls it through the API.
revoke all on function public.raw_listings_sync_offers() from public, anon, authenticated;
