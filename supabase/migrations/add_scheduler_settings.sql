begin;

create table if not exists public.scheduler_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  default_shift_start time default '05:00',
  default_shift_end time default '13:30',
  default_shift_days text[] default array['mon','tue','wed','thu','fri'],
  min_shift_hours numeric default 4,
  max_shift_hours numeric default 10,
  overtime_threshold_hours numeric default 40,
  crew_start_time_buffer_minutes int default 0,
  notes text,
  updated_at timestamptz default now()
);

alter table public.scheduler_settings enable row level security;

drop policy if exists "scheduler_settings select" on public.scheduler_settings;
create policy "scheduler_settings select" on public.scheduler_settings
  for select using (org_id = (select org_id from public.app_users where id = auth.uid()));

drop policy if exists "scheduler_settings manage" on public.scheduler_settings;
create policy "scheduler_settings manage" on public.scheduler_settings
  for all using (
    org_id = (select org_id from public.app_users where id = auth.uid())
    and (select role from public.app_users where id = auth.uid()) = any(array['admin','manager'])
  );

insert into public.scheduler_settings (org_id, default_shift_start, default_shift_end)
select
  'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid,
  '05:00'::time,
  '13:30'::time
where not exists (
  select 1
  from public.scheduler_settings
  where org_id = 'bb13da4a-d2de-4fc9-ad5a-bfd266e08807'::uuid
);

commit;
