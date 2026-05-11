begin;

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
  limit 1
$$;

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
  limit 1
$$;

commit;
