-- ================================================================
-- Workforce Management Platform — Schema v2
-- ================================================================

-- GROUPS
CREATE TABLE IF NOT EXISTS groups (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
  id               SERIAL PRIMARY KEY,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  photo_url        TEXT,
  active           BOOLEAN DEFAULT true,
  group_id         INT REFERENCES groups(id) ON DELETE SET NULL,
  worker_type      TEXT,
  hourly_rate      DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  overtime_rule_id INT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- SHIFTS  ← unique constraint required for upsert
CREATE TABLE IF NOT EXISTS shifts (
  id          SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  is_day_off  BOOLEAN DEFAULT false,
  UNIQUE (employee_id, date)
);

-- TASK GROUPS
CREATE TABLE IF NOT EXISTS task_groups (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  group_id INT REFERENCES task_groups(id) ON DELETE SET NULL
);

-- EQUIPMENT TYPES
CREATE TABLE IF NOT EXISTS equipment_types (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  short_name TEXT
);

-- EQUIPMENT UNITS
CREATE TABLE IF NOT EXISTS equipment_units (
  id                SERIAL PRIMARY KEY,
  equipment_type_id INT REFERENCES equipment_types(id) ON DELETE SET NULL,
  unit_name         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready','issue','maintenance','disabled'))
);

-- TASK ASSIGNMENTS
CREATE TABLE IF NOT EXISTS task_assignments (
  id                SERIAL PRIMARY KEY,
  shift_id          INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  task_id           INT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  duration          DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (duration >= 0),
  position          INT NOT NULL DEFAULT 0,
  equipment_unit_id INT REFERENCES equipment_units(id) ON DELETE SET NULL
);

-- WORK ORDERS
CREATE TABLE IF NOT EXISTS work_orders (
  id                SERIAL PRIMARY KEY,
  equipment_unit_id INT REFERENCES equipment_units(id) ON DELETE SET NULL,
  description       TEXT,
  status            TEXT DEFAULT 'open',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- NOTES
CREATE TABLE IF NOT EXISTS notes (
  id      SERIAL PRIMARY KEY,
  date    DATE NOT NULL,
  type    TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- Indexes for common query patterns
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_shifts_date          ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_date ON shifts(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_task_assignments_shift ON task_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_employees_active     ON employees(active);

-- ================================================================
-- Seed data
-- ================================================================
INSERT INTO groups (name) VALUES ('Field Crew'), ('Office'), ('Management')
  ON CONFLICT DO NOTHING;

INSERT INTO task_groups (name) VALUES ('Installation'), ('Maintenance'), ('Inspection'), ('Admin')
  ON CONFLICT DO NOTHING;

INSERT INTO equipment_types (name, short_name) VALUES
  ('Boom Lift', 'BL'), ('Scissor Lift', 'SL'), ('Forklift', 'FL'), ('Truck', 'TR')
  ON CONFLICT DO NOTHING;
