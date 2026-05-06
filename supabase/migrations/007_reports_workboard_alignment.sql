-- Align reporting/workboard schema with latest app behavior.
-- Safe to run multiple times.

alter table public.employees
add column if not exists hourly_rate numeric;

alter table public.assignments
add column if not exists notes text,
add column if not exists order_index integer;
