import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  return NextResponse.json({
    message: "Seed endpoint is working. Send a POST request to seed the database.",
    usage: "POST http://localhost:3000/api/seed",
  });
}

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Check if plots already exist
  const { count } = await supabase
    .from("plots")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) {
    return NextResponse.json({
      message: `Database already has ${count} plots. Skipping seed.`,
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
    message: `Successfully seeded ${inserted} plots into the database.`,
  });
}
