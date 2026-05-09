begin;

alter table public.tasks
  add column if not exists color text;

commit;
