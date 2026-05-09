-- Add org_id indexes for org-scoped tables.
-- NOTE: CREATE INDEX CONCURRENTLY must run outside a transaction block.

create index concurrently if not exists idx_app_users_org_id on public.app_users (org_id);
create index concurrently if not exists idx_employees_org_id on public.employees (org_id);
create index concurrently if not exists idx_properties_org_id on public.properties (org_id);
create index concurrently if not exists idx_schedule_entries_org_id on public.schedule_entries (org_id);
create index concurrently if not exists idx_assignments_org_id on public.assignments (org_id);
create index concurrently if not exists idx_tasks_org_id on public.tasks (org_id);
create index concurrently if not exists idx_equipment_units_org_id on public.equipment_units (org_id);
create index concurrently if not exists idx_equipment_types_org_id on public.equipment_types (org_id);
create index concurrently if not exists idx_work_orders_org_id on public.work_orders (org_id);
create index concurrently if not exists idx_clock_events_org_id on public.clock_events (org_id);
create index concurrently if not exists idx_notes_org_id on public.notes (org_id);
create index concurrently if not exists idx_program_settings_org_id on public.program_settings (org_id);
create index concurrently if not exists idx_department_options_org_id on public.department_options (org_id);
create index concurrently if not exists idx_group_options_org_id on public.group_options (org_id);
create index concurrently if not exists idx_role_options_org_id on public.role_options (org_id);
create index concurrently if not exists idx_language_options_org_id on public.language_options (org_id);
create index concurrently if not exists idx_shift_templates_org_id on public.shift_templates (org_id);
create index concurrently if not exists idx_work_locations_org_id on public.work_locations (org_id);
create index concurrently if not exists idx_weather_locations_org_id on public.weather_locations (org_id);
create index concurrently if not exists idx_weather_stations_org_id on public.weather_stations (org_id);
create index concurrently if not exists idx_weather_daily_logs_org_id on public.weather_daily_logs (org_id);
create index concurrently if not exists idx_manual_rainfall_entries_org_id on public.manual_rainfall_entries (org_id);
create index concurrently if not exists idx_chemical_application_logs_org_id on public.chemical_application_logs (org_id);
create index concurrently if not exists idx_chemical_products_org_id on public.chemical_products (org_id);
create index concurrently if not exists idx_chemical_application_tank_mix_items_org_id on public.chemical_application_tank_mix_items (org_id);
create index concurrently if not exists idx_task_requests_org_id on public.task_requests (org_id);
create index concurrently if not exists idx_property_class_options_org_id on public.property_class_options (org_id);
create index concurrently if not exists idx_application_areas_org_id on public.application_areas (org_id);
create index concurrently if not exists idx_employee_groups_org_id on public.employee_groups (org_id);
create index concurrently if not exists idx_workforce_roles_org_id on public.workforce_roles (org_id);
create index concurrently if not exists idx_worker_types_org_id on public.worker_types (org_id);
create index concurrently if not exists idx_job_descriptions_org_id on public.job_descriptions (org_id);
create index concurrently if not exists idx_employment_statuses_org_id on public.employment_statuses (org_id);
create index concurrently if not exists idx_wage_categories_org_id on public.wage_categories (org_id);
create index concurrently if not exists idx_overtime_rules_org_id on public.overtime_rules (org_id);
