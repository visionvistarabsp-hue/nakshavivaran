import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MapWithSidebar from "@/components/MapWithSidebar";
import { PlotRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: plots } = await supabase
    .from("plots")
    .select("*")
    .order("label", { ascending: true });

  const plotList: PlotRow[] = (plots || []).map((p: any) => ({
    ...p,
    polygon: typeof p.polygon === "string" ? JSON.parse(p.polygon) : p.polygon || [],
  }));

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <MapWithSidebar plots={plotList} />
      <Footer />
    </div>
  );
}
