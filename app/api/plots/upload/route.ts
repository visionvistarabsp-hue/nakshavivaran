import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(request: NextRequest) {
  const admin = await authorizeAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized: admin sign-in required to upload photos" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let body: { plot_id?: string; filename?: string; content_type?: string; is_document?: boolean; file_data?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plot_id, filename, content_type, is_document, file_data } = body;
  if (!plot_id || !filename || !file_data) {
    return NextResponse.json(
      { error: "plot_id, filename, and file_data are required" },
      { status: 400 }
    );
  }

  // Verify plot exists
  const { data: plot, error: plotError } = await supabase
    .from("plots")
    .select("id, map_id, label")
    .eq("id", plot_id)
    .single();

  if (plotError || !plot) {
    return NextResponse.json({ error: "Plot not found" }, { status: 404 });
  }

  const bucket = process.env.R2_BUCKET!;
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const prefix = is_document ? "docs" : "photos";
  const key = `${prefix}/${plot.map_id}/${plot.id}-${Date.now()}-${safeName}`;

  // Convert base64 to Buffer. Accept both raw base64 and data URLs.
  const base64Data = file_data.replace(/^data:[^,]*,/, "");
  const fileBuffer = Buffer.from(base64Data, "base64");

  // Validate file size (max 20MB)
  if (fileBuffer.length > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File size must be under 20MB" }, { status: 400 });
  }

  const R2 = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: content_type || "image/jpeg",
  });

  try {
    await R2.send(command);
    const publicUrl = `${process.env.R2_PUBLIC_URL!}/${key}`;

    // Update the plot's photo_url or document_url
    const field = is_document ? "document_url" : "photo_url";
    await supabase
      .from("plots")
      .update({ [field]: publicUrl })
      .eq("id", plot_id);

    return NextResponse.json({
      success: true,
      publicUrl,
      key,
      field,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}