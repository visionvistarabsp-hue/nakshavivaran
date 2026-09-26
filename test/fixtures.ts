import type { MapDef, PlotRow } from "@/lib/types";

const TS = "2026-01-01T00:00:00Z";

/** A complete MapDef, so tests only state the fields they care about. */
export function makeMap(over: Partial<MapDef> = {}): MapDef {
  return {
    id: "1",
    slug: "jali",
    name: "JALI",
    image_url: "/jali.png",
    width: 7200,
    height: 4000,
    is_default: true,
    sort_order: 0,
    created_at: TS,
    ...over,
  };
}

/** A complete PlotRow, defaulting to a plain available plot with no statement. */
export function makePlot(over: Partial<PlotRow> = {}): PlotRow {
  return {
    id: "p1",
    map_id: "1",
    label: "A1",
    x: 10,
    y: 10,
    cx: 12,
    cy: 12,
    polygon: [
      [10, 10],
      [14, 10],
      [14, 14],
      [10, 14],
    ],
    area_px: 16,
    status: "available",
    khasara: "",
    owner_name: "",
    size: "",
    agreement: false,
    facing: "",
    road: "",
    notes: "",
    plot_number: null,
    plot_type: null,
    length: null,
    width: null,
    area_sq_ft: null,
    length_is_avg: false,
    width_is_avg: false,
    created_at: TS,
    updated_at: TS,
    ...over,
  };
}
