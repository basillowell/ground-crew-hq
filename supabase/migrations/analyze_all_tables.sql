-- Populate planner statistics for all public tables.
-- Safe maintenance operation: no schema changes.
analyze public.organizations;
analyze public.app_users;
analyze public.employees;
analyze public.properties;
analyze public.schedule_entries;
analyze public.assignments;
analyze public.tasks;
analyze public.equipment_types;
analyze public.equipment_units;
analyze public.work_orders;
analyze public.clock_events;
analyze public.notes;
analyze public.program_settings;
analyze public.department_options;
analyze public.group_options;
analyze public.role_options;
analyze public.language_options;
analyze public.shift_templates;
analyze public.work_locations;
analyze public.weather_locations;
analyze public.weather_stations;
analyze public.weather_daily_logs;
analyze public.manual_rainfall_entries;
analyze public.chemical_application_logs;
analyze public.chemical_products;
analyze public.chemical_application_tank_mix_items;
analyze public.task_requests;
analyze public.property_class_options;
analyze public.application_areas;
analyze public.departments;
analyze public.employee_groups;
analyze public.workforce_roles;
analyze public.worker_types;
analyze public.job_descriptions;
analyze public.employment_statuses;
analyze public.wage_categories;
analyze public.overtime_rules;

-- Audit approximate row counts after ANALYZE.
select
  c.relname as table_name,
  c.reltuples::bigint as reltuples_estimate
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
