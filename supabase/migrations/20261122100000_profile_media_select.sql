-- Profile photos and logos: let members read back their own objects.
-- Storage uploads return the stored row (and upserts check for an existing
-- one), which RLS treats as a SELECT. Without this policy every upload to
-- profile-media failed with "new row violates row-level security policy".
-- Public URLs keep working for everyone because the bucket is public.
create policy "Members read their own images"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
