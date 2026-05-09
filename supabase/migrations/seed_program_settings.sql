begin;

create unique index if not exists idx_program_settings_org_id_unique
  on public.program_settings (org_id);

alter table public.program_settings enable row level security;

drop policy if exists "program_settings_select_org_scope" on public.program_settings;
create policy "program_settings_select_org_scope"
on public.program_settings
for select
using (
  org_id = (
    select au.org_id
    from public.app_users au
    where au.id = auth.uid()
  )
);

commit;
