-- Allow tasks to be org-wide (not tied to a specific property)
ALTER TABLE public.tasks
ALTER COLUMN property_id DROP NOT NULL;

-- Update RLS policy for tasks to allow org-wide tasks
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
CREATE POLICY "tasks select"
ON public.tasks FOR SELECT
USING (org_id = current_org_id());

DROP POLICY IF EXISTS "tasks manage" ON public.tasks;
CREATE POLICY "tasks manage"
ON public.tasks FOR ALL
USING (
  org_id = current_org_id()
  AND current_user_role() IN ('admin', 'manager')
)
WITH CHECK (
  org_id = current_org_id()
  AND current_user_role() IN ('admin', 'manager')
);
