/**
 * Seeds Map 2 from data/map2_qa.json into the `plots` table.
 *
 * Idempotent: upserts on (map_id, label). Only geometry + Plot Area Statement
 * columns are written, so admin edits to status / khasara / owner_name survive
 * re-runs.
 *
 * Coordinates are copied verbatim. Map 2's canvas is 1615x904 and its polygon
 * bounds are x 19-1385, y 17-865, i.e. already 1:1 with public/map_2.png, so no
 * scaling is applied. JALI is NOT touched by this script.
 *
 *   node scripts/seed-map2.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MAP_SLUG = "map-2";
const DRY_RUN = process.argv.includes("--dry-run");

function loadEnv(path = ".env.local") {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const qa = JSON.parse(readFileSync("data/map2_qa.json", "utf8"));

const { data: map, error: mapErr } = await supabase
  .from("maps")
  .select("id, slug, name, width, height")
  .eq("slug", MAP_SLUG)
  .maybeSingle();

if (mapErr) throw new Error(`maps lookup failed: ${mapErr.message}`);
if (!map) throw new Error(`map "${MAP_SLUG}" not found - run the schema migration first`);

// Guard: the seed must never silently write polygons that fall outside the
// map's declared canvas (that would mean a coordinate-space mistake). Every
// vertex of every ring is checked on both axes - checking only the flattened
// minimum, or only the centroid, would let a stretched polygon through.
const outOfBounds = qa.plots.filter((p) =>
  p.polygon.some(([x, y]) =>
    x < 0 || y < 0 || x > map.width || y > map.height
  )
);
if (outOfBounds.length) {
  const detail = outOfBounds
    .map((p) => {
      const xs = p.polygon.map(([x]) => x);
      const ys = p.polygon.map(([, y]) => y);
      return `${p.label} [x ${Math.min(...xs)}..${Math.max(...xs)}, y ${Math.min(
        ...ys
      )}..${Math.max(...ys)}]`;
    })
    .join("; ");
  throw new Error(
    `${outOfBounds.length} plot(s) fall outside the ${map.width}x${map.height} canvas: ` +
      detail
  );
}

const rows = qa.plots.map((p) => ({
  map_id: map.id,
  label: p.label,
  x: p.polygon[0]?.[0] ?? p.centroid[0],
  y: p.polygon[0]?.[1] ?? p.centroid[1],
  cx: p.centroid[0],
  cy: p.centroid[1],
  polygon: p.polygon,
  area_px: p.area ?? 0,
  plot_number: p.plot_number ?? null,
  plot_type: p.plot_type ?? null,
  length: p.length ?? null,
  width: p.width ?? null,
  area_sq_ft: p.area_sq_ft ?? null,
  length_is_avg: p.length_is_avg ?? false,
  width_is_avg: p.width_is_avg ?? false,
}));

const labels = rows.map((r) => r.label);
if (new Set(labels).size !== labels.length) {
  throw new Error("duplicate labels in map2_qa.json - label is the per-map key");
}

const totalArea = rows.reduce((s, r) => s + (r.area_sq_ft ?? 0), 0);
const byType = rows.reduce((m, r) => {
  const k = r.plot_type ?? "?";
  m[k] = (m[k] ?? 0) + 1;
  return m;
}, {});

console.log(`map      : ${map.name} (${map.slug}) ${map.width}x${map.height}`);
console.log(`plots    : ${rows.length}  ${JSON.stringify(byType)}`);
console.log(`area sum : ${totalArea.toFixed(2)} sq.ft`);

if (DRY_RUN) {
  console.log("\n--dry-run: nothing written.");
  process.exit(0);
}

const { data, error } = await supabase
  .from("plots")
  .upsert(rows, { onConflict: "map_id,label" })
  .select("id, label, plot_number, plot_type, area_sq_ft");

if (error) throw new Error(`upsert failed: ${error.message}`);

console.log(`\nwrote    : ${data.length} rows`);

const { count } = await supabase
  .from("plots")
  .select("id", { count: "exact", head: true })
  .eq("map_id", map.id);

const { count: jaliCount } = await supabase
  .from("plots")
  .select("id", { count: "exact", head: true })
  .neq("map_id", map.id);

console.log(`verified : map-2=${count}, other maps=${jaliCount}`);
if (count !== rows.length) throw new Error(`expected ${rows.length} rows, found ${count}`);
