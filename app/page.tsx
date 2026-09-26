import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MapWithSidebar from "@/components/MapWithSidebar";
import { MapDef, PlotRow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { map?: string };
}

export default async function HomePage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: mapRows } = await supabase
    .from("maps")
    .select("*")
    .order("sort_order", { ascending: true });

  const maps: MapDef[] = (mapRows || []) as MapDef[];

  // An unknown or missing ?map= falls back to the default map, so a stale
  // bookmark never renders an empty canvas.
  const requested = searchParams.map;
  const activeMap =
    maps.find((m) => m.slug === requested) ??
    maps.find((m) => m.is_default) ??
    maps[0];

  const { data: plots } = activeMap
    ? await supabase
        .from("plots")
        .select("*")
        .eq("map_id", activeMap.id)
        .order("label", { ascending: true })
    : { data: [] };

  const plotList: PlotRow[] = (plots || []).map((p: any) => ({
    ...p,
    polygon: typeof p.polygon === "string" ? JSON.parse(p.polygon) : p.polygon || [],
  }));

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Header activeMapSlug={activeMap?.slug} />
      <MapWithSidebar plots={plotList} maps={maps} activeMap={activeMap} />
      <Footer />
    </div>
  );
}
