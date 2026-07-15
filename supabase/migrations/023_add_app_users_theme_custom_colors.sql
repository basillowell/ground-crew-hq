begin;

alter table public.app_users
  add column if not exists theme_custom_colors jsonb;

commit;
