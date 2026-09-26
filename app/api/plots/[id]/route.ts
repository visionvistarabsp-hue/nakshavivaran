import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin";

/**
 * Columns that may be edited through the admin UI. Geometry, plot identity and
 * the transcribed Plot Area Statement are all intentionally absent: polygons are
 * the surveyed source data, `label` is the join key used by the seed and by
 * external references, and the statement must stay traceable to its document.
 */
const EDITABLE = new Set([
  "status",
  "khasara",
  "owner_name",
  "size",
  "agreement",
  "facing",
  "road",
  "notes",
]);

const IMMUTABLE = new Set([
  "polygon",
  "label",
  "map_id",
  "x",
  "y",
  "cx",
  "cy",
  "area_px",
  "plot_number",
  "plot_type",
  "length",
  "width",
  "area_sq_ft",
  "length_is_avg",
  "width_is_avg",
]);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await authorizeAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized: admin sign-in required to edit plots" },
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

  const attempted = Object.keys(body ?? {});
  const rejected = attempted.filter((k) => IMMUTABLE.has(k));
  if (rejected.length > 0) {
    return NextResponse.json(
      {
        error: `These fields are read-only: ${rejected.join(", ")}`,
        rejected,
      },
      { status: 400 }
    );
  }

  const unknown = attempted.filter((k) => !EDITABLE.has(k));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Unknown field(s): ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("plots")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ plot: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await authorizeAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized: admin sign-in required to delete plots" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Return what was removed so the caller can tell which map row was deleted and
  // cannot silently drop a survey plot.
  const { data, error } = await supabase
    .from("plots")
    .delete()
    .eq("id", params.id)
    .select("id, map_id, label, plot_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Plot not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, deleted: data[0] });
}
