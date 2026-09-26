export type PlotStatus = "available" | "booked" | "hold" | "reserved" | "agreement_signed";

/** Plot Area Statement categories. */
export type PlotType = "PLOT" | "LIG" | "EWS";

export interface MapDef {
  id: string;
  slug: string;
  name: string;
  image_url: string;
  /** Canvas width that this map's plot coordinates are expressed in. */
  width: number;
  /** Canvas height that this map's plot coordinates are expressed in. */
  height: number;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface PlotRow {
  id: string;
  map_id: string;
  label: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  polygon: number[][];
  area_px: number;
  status: PlotStatus;
  khasara: string;
  owner_name: string;
  size: string;
  agreement: boolean;
  facing: string;
  road: string;
  notes: string;

  // Plot Area Statement metadata. Null when the source statement has no value.
  plot_number: number | null;
  plot_type: PlotType | null;
  length: number | null;
  width: number | null;
  area_sq_ft: number | null;
  length_is_avg: boolean;
  width_is_avg: boolean;

  created_at: string;
  updated_at: string;
}

export const STATUS_COLORS: Record<PlotStatus, string> = {
  available: "#2fa36b",
  booked: "#d96a4f",
  hold: "#e0a53a",
  reserved: "#6c5ce7",
  agreement_signed: "#0984e3",
};

export const STATUS_LABELS: Record<PlotStatus, string> = {
  available: "Available",
  booked: "Booked",
  hold: "Hold",
  reserved: "Reserved",
  agreement_signed: "Agreement Signed",
};

/** True when the Plot Area Statement carried any values for this plot. */
export function hasStatementMetadata(
  p: Pick<
    PlotRow,
    "plot_number" | "plot_type" | "length" | "width" | "area_sq_ft"
  >
): boolean {
  return (
    p.plot_number != null ||
    p.plot_type != null ||
    p.length != null ||
    p.width != null ||
    p.area_sq_ft != null
  );
}

/** `74.82 ft (AVG)` / `24.5 ft` / null. Never rounds or rewrites the source. */
export function formatDimension(
  value: number | null,
  isAvg: boolean
): string | null {
  if (value == null) return null;
  return isAvg ? `${value} ft (AVG)` : `${value} ft`;
}

/** Plot number falls back to the label when the statement omitted it. */
export function displayPlotNumber(p: Pick<PlotRow, "plot_number" | "label">): string {
  return p.plot_number != null ? String(p.plot_number) : p.label;
}
