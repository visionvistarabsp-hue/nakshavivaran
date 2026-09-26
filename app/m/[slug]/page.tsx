import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MapWithSidebar from "@/components/MapWithSidebar";
import { MapDef, PlotRow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

export default async function SharePage({ params }: PageProps) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: mapRows } = await supabase
    .from("maps")
    .select("*")
    .eq("slug", params.slug)
    .limit(1);

  const activeMap = ((mapRows || []) as MapDef[])[0];

  // A share link names exactly one map, so an unknown slug 404s instead of
  // quietly rendering the default map. Otherwise a dead or mistyped link looks
  // like it worked but shows the wrong layout.
  if (!activeMap) notFound();

  const { data: plots } = await supabase
    .from("plots")
    .select("*")
    .eq("map_id", activeMap.id)
    .order("label", { ascending: true });

  const plotList: PlotRow[] = (plots || []).map((p: any) => ({
    ...p,
    polygon: typeof p.polygon === "string" ? JSON.parse(p.polygon) : p.polygon || [],
  }));

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Header minimal />
      <MapWithSidebar
        plots={plotList}
        maps={[activeMap]}
        activeMap={activeMap}
        showMapSwitcher={false}
      />
      <Footer />
    </div>
  );
}
