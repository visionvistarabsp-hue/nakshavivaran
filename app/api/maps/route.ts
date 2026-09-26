import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/maps[?default=1]
 *
 * `maps` rows double as coordinate-space declarations, so a client that renders
 * plots must read the canvas dimensions from here rather than assuming JALI's
 * 7200x4000. `default=1` returns just the default map.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const onlyDefault = request.nextUrl.searchParams.get("default") === "1";

  let query = supabase
    .from("maps")
    .select("*")
    .order("sort_order", { ascending: true });

  if (onlyDefault) {
    query = query.eq("is_default", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    maps: data ?? [],
    defaultMapSlug:
      (onlyDefault ? data?.[0]?.slug : data?.find((m: any) => m.is_default)?.slug) ??
      null,
  });
}
