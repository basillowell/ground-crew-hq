ALTER TABLE public.schedule_entries
ADD COLUMN IF NOT EXISTS notes text;
