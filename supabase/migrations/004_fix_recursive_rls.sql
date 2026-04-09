create or replace function public.auth_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.app_users
  where id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from public.app_users
  where id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id
  from public.app_users
  where id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where id = auth.uid()
    and status = 'active'
  limit 1
$$;

drop policy if exists "app_users select" on public.app_users;
create policy "app_users select"
on public.app_users
for select
using (
  id = public.auth_app_user_id()
  or (
    org_id = public.current_org_id()
    and (
      employee_id = public.current_employee_id()
      or public.current_user_role() in ('admin', 'manager')
    )
  )
);

drop policy if exists "organizations select" on public.organizations;
create policy "organizations select"
on public.organizations
for select
using (id = public.current_org_id());

drop policy if exists "employees select" on public.employees;
create policy "employees select"
on public.employees
for select
using (
  id = public.current_employee_id()
  or (
    org_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'manager')
  )
);

alter table public.app_users enable row level security;
alter table public.employees enable row level security;
alter table public.organizations enable row level security;
