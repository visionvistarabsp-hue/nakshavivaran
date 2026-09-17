"use client";

import { useState } from "react";
import PlotMap from "./PlotMap";
import { PlotRow, STATUS_COLORS, STATUS_LABELS, PlotStatus } from "@/lib/types";

interface Props {
  plots: PlotRow[];
}

export default function MapWithSidebar({ plots }: Props) {
  const [selectedPlot, setSelectedPlot] = useState<PlotRow | null>(null);

  const total = plots.length;
  const stats = (Object.keys(STATUS_COLORS) as PlotStatus[]).reduce((acc, key) => {
    acc[key] = plots.filter((p) => p.status === key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Map */}
      <section id="map" className="flex-1 min-w-0 flex flex-col border-r border-[var(--border)]">
        <PlotMap plots={plots} onSelect={setSelectedPlot} />
      </section>

      {/* Right: Sidebar */}
      <aside className="hidden lg:flex w-80 flex-col bg-[var(--bg-secondary)] overflow-y-auto shrink-0">
        {/* Title */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[var(--accent-glow)] border border-[rgba(0,212,170,0.2)] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[var(--accent)] text-[10px] font-medium">Live Data</span>
          </div>
          <h1 className="text-lg font-extrabold tracking-tight">
            JALI <span style={{ background: "var(--gradient-1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Layout</span>
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            Zoom, pan aur click karke plots explore karo
          </p>
        </div>

        {/* Selected Plot Detail */}
        {selectedPlot && (
          <div className="px-5 py-4 border-b border-[var(--border)] animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Plot Details</h2>
              <button
                onClick={() => setSelectedPlot(null)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Plot Number</div>
                  <div className="text-xl font-extrabold">{selectedPlot.label}</div>
                </div>
                <span className="status-badge text-xs px-2 py-1" style={{ background: STATUS_COLORS[selectedPlot.status] + "20", color: STATUS_COLORS[selectedPlot.status] }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[selectedPlot.status], boxShadow: `0 0 6px ${STATUS_COLORS[selectedPlot.status]}60` }} />
                  {STATUS_LABELS[selectedPlot.status]}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  selectedPlot.khasara && { label: "Khasra", value: selectedPlot.khasara },
                  selectedPlot.owner_name && { label: "Owner", value: selectedPlot.owner_name },
                  selectedPlot.size && { label: "Size", value: selectedPlot.size },
                  selectedPlot.facing && { label: "Facing", value: selectedPlot.facing },
                  selectedPlot.road && { label: "Road", value: selectedPlot.road },
                  selectedPlot.notes && { label: "Notes", value: selectedPlot.notes },
                ].filter(Boolean).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-baseline gap-2">
                    <span className="text-[var(--text-muted)]">{item.label}</span>
                    <span className="text-[var(--text-primary)] font-medium text-right">{item.value}</span>
                  </div>
                ))}
                {!selectedPlot.khasara && !selectedPlot.owner_name && !selectedPlot.size && (
                  <div className="text-[var(--text-muted)] text-center py-2">No details added yet</div>
                )}
              </div>

              <a href="/admin" className="block mt-3 text-center text-[10px] font-semibold py-2 rounded-lg transition-all"
                style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
                Edit in Admin →
              </a>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Statistics</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="glass rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold">{total}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Total</div>
            </div>
            {(Object.entries(STATUS_LABELS) as [PlotStatus, string][]).map(([key, label]) => (
              <div key={key} className="glass rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold" style={{ color: STATUS_COLORS[key] }}>
                  {stats[key] || 0}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider truncate">{label.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Status Legend</h2>
          <div className="space-y-2">
            {(Object.entries(STATUS_COLORS) as [string, string][]).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />
                <span className="text-xs text-[var(--text-secondary)]">{STATUS_LABELS[key as keyof typeof STATUS_LABELS]}</span>
                <span className="ml-auto text-xs font-mono text-[var(--text-muted)]">{stats[key] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Tips */}
        <div className="px-5 py-4 mt-auto">
          <div className="glass rounded-xl p-4">
            <h3 className="text-xs font-semibold mb-2">Quick Tips</h3>
            <ul className="space-y-1.5 text-[11px] text-[var(--text-muted)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                Scroll se zoom karo
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                Drag se map move karo
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                Plot pe click karke details dekho
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                Search bar me plot number dalo
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
