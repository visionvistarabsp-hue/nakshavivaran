-- Add photo_url and document_url columns to existing plots table
-- Run this in Supabase SQL Editor if the columns don't exist yet

ALTER TABLE plots ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Also add the R2-related columns if missing
ALTER TABLE plots ADD COLUMN IF NOT EXISTS facing TEXT DEFAULT '';
ALTER TABLE plots ADD COLUMN IF NOT EXISTS road TEXT DEFAULT '';
ALTER TABLE plots ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE plots ADD COLUMN IF NOT EXISTS agreement BOOLEAN DEFAULT FALSE;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS khasara TEXT DEFAULT '';
ALTER TABLE plots ADD COLUMN IF NOT EXISTS owner_name TEXT DEFAULT '';
ALTER TABLE plots ADD COLUMN IF NOT EXISTS size TEXT DEFAULT '';