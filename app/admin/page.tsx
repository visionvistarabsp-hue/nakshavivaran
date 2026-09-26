import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminPanel from "@/components/AdminPanel";
import { MapDef, PlotRow } from "@/lib/types";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { map?: string };
}

export default async function AdminPage({ searchParams }: PageProps) {
  // Redirects to /login for anyone without an active admin session. This is
  // belt-and-braces - the write APIs and RLS both refuse non-admins too - but it
  // means the panel never renders a shell that would only fail on first click.
  const adminEmail = await requireAdmin();

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: mapRows } = await supabase
    .from("maps")
    .select("*")
    .order("sort_order", { ascending: true });

  const maps: MapDef[] = (mapRows || []) as MapDef[];

  // Plot labels are only unique per map, so the admin panel is always scoped to
  // one map. Without this it would list JALI and Map 2 rows in one list, where
  // labels like "10" and "57" are ambiguous.
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
    <div className="h-dvh flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <Header activeMapSlug={activeMap?.slug} />
      <main className="flex-1 min-h-0 overflow-hidden">
        <AdminPanel
          plots={plotList}
          maps={maps}
          activeMap={activeMap}
          adminEmail={adminEmail}
        />
      </main>
    </div>
  );
}
