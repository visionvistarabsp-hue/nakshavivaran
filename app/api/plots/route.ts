import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin";

/**
 * GET /api/plots[?map=<slug-or-uuid>]
 *
 * Plots live in per-map coordinate spaces, so callers must scope by map. Omitting
 * `map` returns the default map's plots rather than every map mixed together.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const requested = request.nextUrl.searchParams.get("map");

  let map: { id: string; slug: string } | null = null;

  if (requested) {
    // Slug and UUID are looked up separately on purpose: a single
    // `.or(slug.eq.x,id.eq.x)` makes PostgREST cast the slug to uuid and fail
    // with "invalid input syntax for type uuid".
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const bySlug = await supabase
      .from("maps")
      .select("id, slug")
      .eq("slug", requested)
      .maybeSingle();

    if (bySlug.error) {
      return NextResponse.json({ error: bySlug.error.message }, { status: 500 });
    }
    map = bySlug.data;

    if (!map && UUID_RE.test(requested)) {
      const byId = await supabase
        .from("maps")
        .select("id, slug")
        .eq("id", requested)
        .maybeSingle();

      if (byId.error) {
        return NextResponse.json({ error: byId.error.message }, { status: 500 });
      }
      map = byId.data;
    }
  } else {
    const { data, error } = await supabase
      .from("maps")
      .select("id, slug")
      .eq("is_default", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    map = data;
  }

  if (!map) {
    return NextResponse.json(
      { error: requested ? `Map "${requested}" not found` : "No default map configured" },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("plots")
    .select("*")
    .eq("map_id", map.id)
    .order("label", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ map, plots: data });
}

/**
 * Columns a new plot may be created with. The official statement fields
 * (length/width/area_sq_ft/plot_type) are intentionally excluded: they come from
 * the image survey, and a hand-entered value there would read as surveyed data.
 * Spreading the raw body instead would let a caller set `id`, `created_at` or any
 * statement column.
 */
const INSERTABLE = [
  "label",
  "polygon",
  "x",
  "y",
  "cx",
  "cy",
  "area_px",
  "plot_number",
  "status",
  "khasara",
  "owner_name",
  "size",
  "agreement",
  "facing",
  "road",
  "notes",
] as const;

/**
 * POST /api/plots
 *
 * `map` (slug) or `map_id` picks the target map; both omitted means the default
 * map. `map_id` is NOT NULL, so an unscoped insert must never reach the database
 * as a raw body.
 */
export async function POST(request: Request) {
  // RLS already rejects non-admin inserts, but checking first turns an
  // unauthenticated write into a clean 401 rather than an RLS error string.
  const admin = await authorizeAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized: admin sign-in required to create plots" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { map, map_id, polygon, ...rest } = body ?? {};

  // Drop anything not explicitly insertable rather than forwarding it.
  const row: Record<string, unknown> = {};
  for (const key of INSERTABLE) {
    if (key in rest) row[key] = rest[key];
  }

  let mapQuery = supabase.from("maps").select("id, slug");
  mapQuery = map ? mapQuery.eq("slug", map) : mapQuery.eq("is_default", true);

  const { data: target, error: mapError } = await mapQuery.maybeSingle();
  if (mapError) {
    return NextResponse.json({ error: mapError.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json(
      { error: map ? `Map "${map}" not found` : "No default map configured" },
      { status: 404 }
    );
  }
  if (map_id && map_id !== target.id) {
    return NextResponse.json(
      { error: "map and map_id refer to different maps" },
      { status: 400 }
    );
  }

  // jsonb columns arrive as strings from form posts and from the legacy
  // single-map clients, so normalise before writing. A malformed string is a
  // client error, not a 500.
  if (typeof polygon === "string") {
    try {
      row.polygon = JSON.parse(polygon);
    } catch {
      return NextResponse.json(
        { error: "polygon must be a JSON array of [x, y] pairs" },
        { status: 400 }
      );
    }
  } else {
    row.polygon = polygon ?? [];
  }

  row.map_id = target.id;

  if (typeof row.label !== "string" || row.label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("plots")
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ map: target, plot: data }, { status: 201 });
}
