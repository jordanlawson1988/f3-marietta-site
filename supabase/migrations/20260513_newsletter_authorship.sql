ALTER TABLE newsletters
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS last_edited_by text,
  ADD COLUMN IF NOT EXISTS posted_by text;
