-- Fertilizer logging: products catalog + application logs.
-- Mirrors the chemical_products / chemical_application_logs RLS pattern exactly:
--   - "<table> select": any active app_users member of the same org can SELECT
--   - "<table> manage": active admin/manager of the same org can INSERT/UPDATE/DELETE
-- A row with org_id NULL or belonging to another org can never match either
-- policy's EXISTS check, so org_id is effectively required on every write.

CREATE TABLE IF NOT EXISTS public.fertilizer_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  fertilizer_type text NOT NULL,
  rate_unit       text NOT NULL DEFAULT 'lbs/acre',
  org_id          uuid REFERENCES public.organizations(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fertilizer_application_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_date      date NOT NULL,
  start_time            text NOT NULL,
  end_time              text NOT NULL,
  property_id           uuid NOT NULL REFERENCES public.properties(id),
  applicator_id         uuid NOT NULL REFERENCES public.employees(id),
  fertilizer_product_id uuid NOT NULL REFERENCES public.fertilizer_products(id),
  rate                  numeric NOT NULL DEFAULT 0,
  rate_unit             text NOT NULL DEFAULT 'lbs/acre',
  application_speed     numeric NOT NULL DEFAULT 0,
  speed_unit            text NOT NULL DEFAULT 'mph',
  area_treated          numeric NOT NULL DEFAULT 0,
  area_unit             text NOT NULL DEFAULT 'acres',
  total_amount          numeric NOT NULL DEFAULT 0,
  equipment_used_id     uuid REFERENCES public.equipment_units(id),
  notes                 text NOT NULL DEFAULT '',
  org_id                uuid REFERENCES public.organizations(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fertilizer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_application_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fertilizer_products select" ON public.fertilizer_products;
CREATE POLICY "fertilizer_products select" ON public.fertilizer_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.id = auth.uid()
        AND au.status = 'active'
        AND au.org_id = fertilizer_products.org_id
    )
  );

DROP POLICY IF EXISTS "fertilizer_products manage" ON public.fertilizer_products;
CREATE POLICY "fertilizer_products manage" ON public.fertilizer_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.id = auth.uid()
        AND au.status = 'active'
        AND au.role = ANY (ARRAY['admin','manager'])
        AND au.org_id = fertilizer_products.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.id = auth.uid()
        AND au.status = 'active'
        AND au.role = ANY (ARRAY['admin','manager'])
        AND au.org_id = fertilizer_products.org_id
    )
  );

DROP POLICY IF EXISTS "fertilizer_application_logs select" ON public.fertilizer_application_logs;
CREATE POLICY "fertilizer_application_logs select" ON public.fertilizer_application_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.id = auth.uid()
        AND au.status = 'active'
        AND au.org_id = fertilizer_application_logs.org_id
    )
  );

DROP POLICY IF EXISTS "fertilizer_application_logs manage" ON public.fertilizer_application_logs;
CREATE POLICY "fertilizer_application_logs manage" ON public.fertilizer_application_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.id = auth.uid()
        AND au.status = 'active'
        AND au.role = ANY (ARRAY['admin','manager'])
        AND au.org_id = fertilizer_application_logs.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.id = auth.uid()
        AND au.status = 'active'
        AND au.role = ANY (ARRAY['admin','manager'])
        AND au.org_id = fertilizer_application_logs.org_id
    )
  );
