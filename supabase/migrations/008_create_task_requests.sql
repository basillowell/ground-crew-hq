create table if not exists public.task_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  property_id uuid references public.properties(id),
  employee_id uuid references public.employees(id),
  date date not null,
  title text not null,
  description text,
  status text default 'pending',
  priority text default 'medium',
  created_at timestamptz default now()
);

alter table public.task_requests enable row level security;

drop policy if exists "org_isolation" on public.task_requests;
create policy "org_isolation"
on public.task_requests
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
