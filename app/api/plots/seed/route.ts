import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { authorizeAdmin } from "@/lib/admin";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function generatePlaceholderImage(label: string, width = 800, height = 600): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#2fa36b"/>
        <stop offset="100%" style="stop-color:#0f7a5f"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect x="40" y="40" width="${width-80}" height="${height-80}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" rx="8"/>
    <text x="${width/2}" y="${height/2 - 20}" text-anchor="middle" fill="white" font-family="system-ui" font-size="48" font-weight="700">Plot ${label}</text>
    <text x="${width/2}" y="${height/2 + 30}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui" font-size="20">Demo Photo</text>
    <text x="${width/2}" y="${height/2 + 60}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui" font-size="14">JALI Layout</text>
  </svg>`;
  return Buffer.from(svg, "utf-8");
}

export async function POST(request: NextRequest) {
  const admin = await authorizeAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized: admin sign-in required to seed demo photos" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: jaliMap } = await supabase
    .from("maps")
    .select("id, slug")
    .eq("slug", "jali")
    .maybeSingle();

  if (!jaliMap) {
    return NextResponse.json({ error: 'Map "jali" not found' }, { status: 404 });
  }

  const { data: plots, error } = await supabase
    .from("plots")
    .select("id, label, photo_url")
    .eq("map_id", jaliMap.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bucket = process.env.R2_BUCKET!;
  const publicUrl = process.env.R2_PUBLIC_URL!;
  let uploaded = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const plot of plots || []) {
    if (plot.photo_url) {
      skipped++;
      continue;
    }

    const key = `photos/${jaliMap.id}/${plot.id}-demo.png`;
    const imageBuffer = generatePlaceholderImage(plot.label);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: "image/svg+xml",
    });

    try {
      await R2.send(command);
      const url = `${publicUrl}/${key}`;

      const { error: updateError } = await supabase
        .from("plots")
        .update({ photo_url: url })
        .eq("id", plot.id);

      if (updateError) {
        errors.push(`Update failed for ${plot.label}: ${updateError.message}`);
        continue;
      }

      uploaded++;
    } catch (err) {
      errors.push(`Upload failed for ${plot.label}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    message: `Demo photos seeded: ${uploaded} uploaded, ${skipped} skipped`,
    total: plots?.length,
    uploaded,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}