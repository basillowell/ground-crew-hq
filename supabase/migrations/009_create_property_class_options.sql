create table if not exists public.property_class_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  name text not null,
  created_at timestamptz default now()
);

alter table public.property_class_options enable row level security;

drop policy if exists "org_isolation" on public.property_class_options;
create policy "org_isolation"
on public.property_class_options
using (
  org_id = (
    select org_id from public.app_users where id = auth.uid()
  )
)
with check (
  org_id = (
    select org_id from public.app_users where id = auth.uid()
  )
);

insert into public.property_class_options (org_id, name)
select o.id, seed.name
from public.organizations o
cross join (
  values
    ('Golf Course'::text),
    ('Resort'::text),
    ('HOA'::text),
    ('Commercial'::text),
    ('Residential'::text)
) as seed(name)
where not exists (
  select 1
  from public.property_class_options pco
  where pco.org_id = o.id
    and pco.name = seed.name
);
