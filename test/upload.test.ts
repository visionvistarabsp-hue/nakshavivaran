import { describe, it, expect, vi } from "vitest";

// Mock next/headers cookies before importing the route
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    setAll: () => {},
  }),
}));

// Mock @/lib/admin to bypass auth in tests
vi.mock("@/lib/admin", () => ({
  authorizeAdmin: vi.fn(),
}));

// Mock @/utils/supabase/server
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "test", map_id: "m1", label: "T1" }, error: null }),
    update: vi.fn().mockReturnThis(),
  }),
}));

const { putInputs } = vi.hoisted(() => ({ putInputs: [] as unknown[] }));

// Mock @aws-sdk/client-s3
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    async send(command: { input?: unknown }) {
      putInputs.push(command.input);
      return {};
    }
  },
  PutObjectCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { POST } from "@/app/api/plots/upload/route";
import { authorizeAdmin } from "@/lib/admin";
import { NextRequest } from "next/server";

// Minimal 1x1 red PNG as base64
const TEST_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("POST /api/plots/upload", () => {
  it("rejects unauthenticated uploads with 401", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/plots/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plot_id: "test",
        filename: "test.png",
        content_type: "image/png",
        file_data: TEST_PNG,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects missing required fields", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue("admin@test.com");

    const req = new NextRequest("http://localhost/api/plots/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("rejects invalid JSON body", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue("admin@test.com");

    const req = new NextRequest("http://localhost/api/plots/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects file over 20MB", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue("admin@test.com");

    // Base64: 4 chars -> 3 bytes. Need >20MB decoded.
    // 20MB = 20,971,520 bytes. Need 20,971,520 / 3 * 4 = ~27,962,027 chars.
    // Use 8M repeats of "AAAA" = 32M chars -> 24MB decoded.
    const largeData = "AAAA".repeat(8 * 1024 * 1024);

    const req = new NextRequest("http://localhost/api/plots/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plot_id: "test",
        filename: "large.png",
        content_type: "image/png",
        file_data: largeData,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("20MB");
  });

  it("uploads successfully with valid input", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue("admin@test.com");

    const req = new NextRequest("http://localhost/api/plots/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plot_id: "test-plot-id",
        filename: "test.png",
        content_type: "image/png",
        file_data: TEST_PNG,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.publicUrl).toContain("photos");
    expect(data.field).toBe("photo_url");
  });

  it("strips a data URL prefix before uploading to R2", async () => {
    vi.mocked(authorizeAdmin).mockResolvedValue("admin@test.com");

    const req = new NextRequest("http://localhost/api/plots/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plot_id: "test-plot-id",
        filename: "test.png",
        content_type: "image/png",
        file_data: `data:image/png;base64,${TEST_PNG}`,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const input = putInputs[putInputs.length - 1] as { Body: Buffer };
    expect(input.Body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(input.Body.toString("base64")).toBe(TEST_PNG);
  });
});