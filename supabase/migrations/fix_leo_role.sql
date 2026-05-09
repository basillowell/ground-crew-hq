begin;

-- Ensure baseline workforce roles exist for this org (idempotent, case-insensitive)
with seed_roles(org_id, name, active) as (
  values
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Field Crew'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Crew Lead'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Field Manager'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Equipment Operator'::text, true),
    ('bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid, 'Irrigation Specialist'::text, true)
)
insert into public.workforce_roles (org_id, name, active)
select sr.org_id, sr.name, sr.active
from seed_roles sr
where not exists (
  select 1
  from public.workforce_roles wr
  where wr.org_id = sr.org_id
    and lower(wr.name) = lower(sr.name)
);

-- Fix Leo Tsosie empty role
update public.employees
set role = 'Field Crew'
where id = '234973b0-c4a3-44e1-b7a8-1a7133795bf2'::uuid
  and org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid
  and coalesce(trim(role), '') = '';

commit;

-- Verification
select id, org_id, first_name, last_name, department, role
from public.employees
where id = '234973b0-c4a3-44e1-b7a8-1a7133795bf2'::uuid
  and org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid;
