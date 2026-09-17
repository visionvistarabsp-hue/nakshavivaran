export type PlotStatus = "available" | "booked" | "hold" | "reserved" | "agreement_signed";

export interface PlotRow {
  id: string;
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
