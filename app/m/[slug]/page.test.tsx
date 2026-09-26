import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMap, makePlot } from "@/test/fixtures";
import type { MapDef, PlotRow } from "@/lib/types";

const h = vi.hoisted(() => ({
  client: null as unknown,
  recorded: [] as { table: string; eq: [string, unknown][] }[],
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  headerProps: {} as Record<string, unknown>,
  sidebarProps: {} as Record<string, unknown>,
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: () => h.client }));
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("next/navigation", () => ({ notFound: h.notFound }));
vi.mock("@/components/Header", () => ({
  default: (p: Record<string, unknown>) => {
    h.headerProps = p;
    return null;
  },
}));
vi.mock("@/components/MapWithSidebar", () => ({
  default: (p: Record<string, unknown>) => {
    h.sidebarProps = p;
    return null;
  },
}));

const jali = makeMap({ id: "1", slug: "jali", name: "JALI", is_default: true });
const map2 = makeMap({ id: "2", slug: "map-2", name: "Map 2", is_default: false });

const allPlots: PlotRow[] = [
  makePlot({ id: "j1", map_id: "1", label: "J1" }),
  makePlot({ id: "m1", map_id: "2", label: "M1" }),
  makePlot({ id: "m2", map_id: "2", label: "M2" }),
];

/** Minimal thenable query builder, so the page's `await supabase.from()...` works. */
function stubClient(maps: MapDef[], plots: PlotRow[]) {
  return {
    from(table: string) {
      const rec = { table, eq: [] as [string, unknown][] };
      h.recorded.push(rec);
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        eq: (col: string, val: unknown) => {
          rec.eq.push([col, val]);
          return builder;
        },
        limit: () => builder,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
          let rows: unknown[] = table === "maps" ? maps : plots;
          for (const [col, val] of rec.eq) {
            rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val);
          }
          return Promise.resolve({ data: rows, error: null }).then(res, rej);
        },
      };
      return builder;
    },
  };
}

async function load(slug: string) {
  const { default: SharePage } = await import("./page");
  const ui = await SharePage({ params: { slug } });
  return render(ui);
}

describe("share page /m/[slug]", () => {
  beforeEach(() => {
    h.recorded = [];
    h.headerProps = {};
    h.sidebarProps = {};
    h.notFound.mockClear();
    h.client = stubClient([jali, map2], allPlots);
  });

  it("renders the map that matches the slug exactly", async () => {
    await load("map-2");

    expect(h.notFound).not.toHaveBeenCalled();
    expect(h.sidebarProps.activeMap).toMatchObject({ id: "2", slug: "map-2" });
  });

  it("loads only the plots belonging to that map", async () => {
    await load("map-2");

    const plotQuery = h.recorded.find((r) => r.table === "plots");
    expect(plotQuery?.eq).toEqual([["map_id", "2"]]);
    expect((h.sidebarProps.plots as PlotRow[]).map((p) => p.label)).toEqual(["M1", "M2"]);
  });

  it("hides the header navigation and the map switcher", async () => {
    await load("map-2");

    expect(h.headerProps.minimal).toBe(true);
    expect(h.sidebarProps.showMapSwitcher).toBe(false);
  });

  it("404s for an unknown slug instead of falling back to the default map", async () => {
    await expect(load("does-not-exist")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.notFound).toHaveBeenCalledTimes(1);
  });

  it("404s when the slug is a prefix of a real one, rather than matching loosely", async () => {
    await expect(load("map")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("does not leak the other map into the sidebar", async () => {
    await load("map-2");

    expect((h.sidebarProps.maps as MapDef[]).map((m) => m.slug)).toEqual(["map-2"]);
  });
});
