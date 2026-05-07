create table if not exists public.workforce_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_workforce_roles_org_id on public.workforce_roles(org_id);
create unique index if not exists uq_workforce_roles_org_name on public.workforce_roles(org_id, lower(name));

alter table public.workforce_roles enable row level security;

drop policy if exists "workforce_roles select" on public.workforce_roles;
create policy "workforce_roles select"
on public.workforce_roles
for select
using (
  org_id = public.current_org_id()
);

drop policy if exists "workforce_roles manage" on public.workforce_roles;
create policy "workforce_roles manage"
on public.workforce_roles
for all
using (
  org_id = public.current_org_id()
  and public.current_user_role() in ('admin', 'manager')
)
with check (
  org_id = public.current_org_id()
  and public.current_user_role() in ('admin', 'manager')
);
