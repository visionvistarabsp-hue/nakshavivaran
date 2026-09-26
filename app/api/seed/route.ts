import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { authorizeAdmin } from "@/lib/admin";

export async function GET() {
  return NextResponse.json({
    message: "Seed endpoint is working. Send a POST request to seed the database.",
    usage: "POST http://localhost:3000/api/seed",
  });
}

export async function POST() {
  // This endpoint writes plots, so it is admin-only. RLS would reject the
  // inserts anyway; failing early keeps the response a clear 401 instead of a
  // mid-batch RLS error after partial work.
  const admin = await authorizeAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized: admin sign-in required to seed" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // This endpoint seeds JALI only, from project/jali/data.json. Map 2 is seeded
  // separately by scripts/seed-map2.mjs from data/map2_qa.json.
  const { data: jaliMap } = await supabase
    .from("maps")
    .select("id, slug")
    .eq("slug", "jali")
    .maybeSingle();

  if (!jaliMap) {
    return NextResponse.json(
      { error: 'Map "jali" not found - run the schema migration first' },
      { status: 409 }
    );
  }

  // Scoped to JALI on purpose: a global count would also block JALI reseeding
  // once Map 2 rows exist, and the JALI sources disagree with the database
  // (179 rows here vs 172 in plots_cv.json and 176 in data/jali_cv.json), so this
  // must never silently overwrite the authoritative 179 rows.
  const { count } = await supabase
    .from("plots")
    .select("*", { count: "exact", head: true })
    .eq("map_id", jaliMap.id);

  if (count && count > 0) {
    return NextResponse.json({
      message: `JALI already has ${count} plots. Skipping seed.`,
      hint: "The JALI polygon sources disagree with the database; delete the JALI rows explicitly if you really intend to reseed.",
    });
  }

  // Read the data.json file
  const dataPath = join(process.cwd(), "project", "jali", "data.json");
  let data;
  try {
    const raw = readFileSync(dataPath, "utf-8");
    data = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json(
      { error: "Could not read data.json" },
      { status: 500 }
    );
  }

  // Map the JSON data to Supabase rows
  const plots = data.plots.map((p: any) => ({
    map_id: jaliMap.id,
    label: p.label,
    x: p.x,
    y: p.y,
    cx: p.cx || p.x,
    cy: p.cy || p.y,
    polygon: JSON.stringify(p.polygon || []),
    area_px: p.area_px || 0,
    status: p.status || "available",
    khasara: p.khasara || "",
    owner_name: p.owner_name || "",
    size: p.size || "",
    agreement: p.agreement || false,
    facing: p.facing || "",
    road: p.road || "",
    notes: p.notes || "",
  }));

  // Insert in batches of 50
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < plots.length; i += batchSize) {
    const batch = plots.slice(i, i + batchSize);
    const { error } = await supabase.from("plots").insert(batch);
    if (error) {
      return NextResponse.json(
        { error: `Failed at batch ${Math.floor(i / batchSize) + 1}: ${error.message}` },
        { status: 500 }
      );
    }
    inserted += batch.length;
  }

  return NextResponse.json({
    message: `Successfully seeded ${inserted} JALI plots into the database.`,
  });
}
