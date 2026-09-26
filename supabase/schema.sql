-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard)

-- ---------------------------------------------------------------------------
-- maps
-- ---------------------------------------------------------------------------
-- Each map owns its own coordinate space. `width`/`height` are the CANVAS
-- dimensions that plot polygons are expressed in, which is NOT necessarily the
-- pixel size of `image_url` (JALI polygons live in a 7200x4000 space while the
-- served JPEG is 3600x2000).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO maps (slug, name, image_url, width, height, is_default, sort_order)
VALUES
  ('jali',  'JALI Map', '/JALI_3600_base.jpg', 7200, 4000, TRUE,  1),
  ('map-2', 'Map 2',    '/map_2.png',          1615,  904, FALSE, 2)
ON CONFLICT (slug) DO UPDATE SET
  name       = EXCLUDED.name,
  image_url  = EXCLUDED.image_url,
  width      = EXCLUDED.width,
  height     = EXCLUDED.height,
  is_default = EXCLUDED.is_default,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- plots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  -- label is unique per map, not globally: JALI "10" and Map 2 "10" are
  -- different plots, so there is no global UNIQUE on this column.
  label TEXT NOT NULL,
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

  -- Plot Area Statement metadata (source of truth, verbatim from the document)
  plot_number   INTEGER,
  plot_type     TEXT CHECK (plot_type IS NULL OR plot_type IN ('PLOT', 'LIG', 'EWS')),
  length        DOUBLE PRECISION,
  width         DOUBLE PRECISION,
  area_sq_ft    DOUBLE PRECISION,
  length_is_avg BOOLEAN NOT NULL DEFAULT FALSE,
  width_is_avg  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast per-map lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_plots_map_label ON plots (map_id, label);
CREATE INDEX IF NOT EXISTS idx_plots_map_id     ON plots (map_id);
CREATE INDEX IF NOT EXISTS idx_plots_map_status ON plots (map_id, status);

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

-- Row Level Security: public read, admin-only writes.
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;

-- maps is reference data: public read, no writes from the client
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON maps;
CREATE POLICY "Allow public read" ON maps
  FOR SELECT USING (true);

-- Anonymous visitors may read the survey, but must not be able to change it.
-- Plot geometry and the transcribed Plot Area Statement are authoritative data,
-- so writes are restricted to the admins allowlist.
DROP POLICY IF EXISTS "Allow public read" ON plots;
CREATE POLICY "Allow public read" ON plots
  FOR SELECT USING (true);

-- Allowlist of editor emails. Kept deliberately small and hand-managed: there is
-- no INSERT policy on this table, so it cannot be self-served or tampered with
-- from the client.
CREATE TABLE IF NOT EXISTS public.admins (
  email text PRIMARY KEY CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Intentionally NO select policy. Nothing in the app reads this table directly -
-- `is_admin()` is SECURITY DEFINER and reads it with elevated privileges - so a
-- select policy would only let any signed-in user list the admin emails.

-- SECURITY DEFINER because a policy's own table is subject to RLS: without the
-- elevated privileges a non-admin would never be able to read the row that says
-- they are an admin, and the check would always be false. search_path is pinned so
-- the function cannot be hijacked through a shadowed schema.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE email = lower(auth.jwt() ->> 'email')
  );
$$;

-- Default EXECUTE is granted to PUBLIC on new functions, and Supabase's default
-- privileges additionally grant it to `anon` at CREATE time. Revoke from PUBLIC
-- alone is therefore not enough - both have to go, and it is then handed back
-- only to signed-in users.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Allow public insert" ON plots;
DROP POLICY IF EXISTS "Allow public update" ON plots;
DROP POLICY IF EXISTS "Allow public delete" ON plots;

CREATE POLICY "Allow admin insert" ON plots
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update" ON plots
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete" ON plots
  FOR DELETE TO authenticated USING (public.is_admin());
