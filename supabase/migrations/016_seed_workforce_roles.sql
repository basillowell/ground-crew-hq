begin;

with seed(org_id, name, active) as (
  values
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Field Manager'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Lead Technician'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Field Staff'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Equipment Operator'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Irrigation Specialist'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Superintendent'::text, true)
),
updated as (
  update public.workforce_roles wr
  set
    name = seed.name,
    active = true
  from seed
  where wr.org_id = seed.org_id
    and lower(wr.name) = lower(seed.name)
  returning wr.id
)
insert into public.workforce_roles (org_id, name, active)
select seed.org_id, seed.name, seed.active
from seed
where not exists (
  select 1
  from public.workforce_roles wr
  where wr.org_id = seed.org_id
    and lower(wr.name) = lower(seed.name)
);

commit;
