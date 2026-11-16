import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const bucket = process.env.R2_BUCKET!;
const publicUrl = process.env.R2_PUBLIC_URL!;

// Minimal 1x1 red PNG
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  const key = `photos/test/manual-test-${Date.now()}.png`;
  console.log("Uploading to:", `${publicUrl}/${key}`);

  // 1. Upload
  const putCmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: TEST_PNG,
    ContentType: "image/png",
  });

  try {
    await R2.send(putCmd);
    console.log("Upload: OK");
  } catch (err) {
    console.log("Upload: FAIL", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 2. Check public accessibility
  const url = `${publicUrl}/${key}`;
  console.log("Checking:", url);

  try {
    const res = await fetch(url, { method: "HEAD" });
    console.log("HTTP status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    if (res.ok) {
      console.log("RESULT: Photo is publicly accessible");
    } else {
      console.log("RESULT: Photo NOT publicly accessible - R2 bucket needs public read policy");
    }
  } catch (err) {
    console.log("Fetch error:", err instanceof Error ? err.message : err);
    console.log("RESULT: Photo NOT publicly accessible");
  }
}

main().catch(console.error);