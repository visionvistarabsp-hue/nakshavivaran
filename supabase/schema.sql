-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard)

CREATE TABLE IF NOT EXISTS plots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  cx DOUBLE PRECISION NOT NULL,
  cy DOUBLE PRECISION NOT NULL,
  polygon JSONB NOT NULL DEFAULT '[]',
  area_px DOUBLE PRECISION DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'booked', 'hold', 'reserved', 'agreement_signed')),
  khasara TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  size TEXT DEFAULT '',
  agreement BOOLEAN DEFAULT FALSE,
  facing TEXT DEFAULT '',
  road TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast label lookups
CREATE INDEX IF NOT EXISTS idx_plots_label ON plots (label);
CREATE INDEX IF NOT EXISTS idx_plots_status ON plots (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plots_updated_at ON plots;
CREATE TRIGGER plots_updated_at
  BEFORE UPDATE ON plots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) - allow all for now, tighten later
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
CREATE POLICY "Allow public read" ON plots
  FOR SELECT USING (true);

-- Allow anonymous insert/update/delete (for admin - tighten with auth later)
CREATE POLICY "Allow public insert" ON plots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON plots
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON plots
  FOR DELETE USING (true);
