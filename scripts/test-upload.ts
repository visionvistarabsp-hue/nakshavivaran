import { NextRequest } from "next/server";
import { POST } from "@/app/api/plots/upload/route";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// Minimal 1x1 red PNG as base64
const TEST_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  // 1. Get a plot ID from Supabase
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: plots, error: plotsError } = await supabase.from("plots").select("id, label").limit(1);
  if (plotsError || !plots || plots.length === 0) {
    console.error("No plots found:", plotsError);
    process.exit(1);
  }
  const plot = plots[0];
  console.log("Testing upload for plot:", plot.label, plot.id);

  // 2. Build a fake NextRequest
  const body = JSON.stringify({
    plot_id: plot.id,
    filename: "test.png",
    content_type: "image/png",
    file_data: TEST_PNG,
  });

  const req = new NextRequest("http://localhost/api/plots/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const res = await POST(req);
  const data = await res.json();

  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  if (res.ok && data.publicUrl) {
    // 3. Verify the URL is accessible
    console.log("Fetching:", data.publicUrl);
    const imgRes = await fetch(data.publicUrl, { method: "HEAD" });
    console.log("Image fetch status:", imgRes.status, imgRes.headers.get("content-type"));
    if (imgRes.ok) {
      console.log("SUCCESS: Photo uploaded and publicly accessible");
    } else {
      console.log("FAIL: Photo uploaded but not publicly accessible (R2 bucket may need public read)");
    }
  } else {
    console.log("FAIL: Upload returned error");
  }
}

main().catch(console.error);