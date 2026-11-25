-- Land title (Eigendom = owned, Erfpacht = long lease) is null when the agency
-- does not state it. It used to default to Eigendom, which showed a guess as a
-- fact.

alter table public.property_master alter column tenure drop default;
alter table public.property_master alter column tenure drop not null;

comment on column public.property_master.tenure is 'Eigendom (owned) or Erfpacht (long lease); null = not stated by the agency';
