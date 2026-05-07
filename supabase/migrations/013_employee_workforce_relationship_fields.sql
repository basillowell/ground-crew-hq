begin;

alter table public.employees
  add column if not exists group_id uuid references public.employee_groups(id) on delete set null,
  add column if not exists group_name text,
  add column if not exists role_id uuid references public.workforce_roles(id) on delete set null,
  add column if not exists hourly_rate numeric,
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists language text,
  add column if not exists worker_type_id uuid references public.worker_types(id) on delete set null,
  add column if not exists worker_type text,
  add column if not exists default_location_id uuid references public.work_locations(id) on delete set null,
  add column if not exists preferred_shift_template_id uuid references public.shift_templates(id) on delete set null,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists login_email text;

create index if not exists idx_employees_group_id on public.employees(group_id);
create index if not exists idx_employees_role_id on public.employees(role_id);
create index if not exists idx_employees_department_id on public.employees(department_id);
create index if not exists idx_employees_worker_type_id on public.employees(worker_type_id);
create index if not exists idx_employees_default_location_id on public.employees(default_location_id);
create index if not exists idx_employees_preferred_shift_template_id on public.employees(preferred_shift_template_id);

commit;
