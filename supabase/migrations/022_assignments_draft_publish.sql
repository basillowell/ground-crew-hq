-- Assignments draft/publish state.
-- Visibility (drafts hidden from employee views, visible to admin/manager board-building
-- views) is enforced at the application query level, not RLS — existing
-- SELECT/manage policies on assignments are unchanged.

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES public.employees(id);
