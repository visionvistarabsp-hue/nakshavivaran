"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PlotRow, PlotStatus, STATUS_COLORS, STATUS_LABELS } from "@/lib/types";

interface Props {
  plots: PlotRow[];
}

export default function AdminPanel({ plots: initialPlots }: Props) {
  const [plots, setPlots] = useState<PlotRow[]>(initialPlots);
  const [selected, setSelected] = useState<PlotRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [formData, setFormData] = useState({
    khasara: "",
    owner_name: "",
    size: "",
    status: "available" as PlotStatus,
    agreement: false,
    facing: "",
    road: "",
    notes: "",
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  const filtered = plots.filter((p) => {
    const matchSearch = !search ||
      p.label.toLowerCase().includes(search.toLowerCase()) ||
      p.khasara.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const selectPlot = useCallback((plot: PlotRow) => {
    setSelected(plot);
    const newForm = {
      khasara: plot.khasara || "",
      owner_name: plot.owner_name || "",
      size: plot.size || "",
      status: plot.status,
      agreement: plot.agreement || false,
      facing: plot.facing || "",
      road: plot.road || "",
      notes: plot.notes || "",
    };
    setFormData(newForm);
    lastSaved.current = JSON.stringify(newForm);
    setSaveStatus("idle");
  }, []);

  const saveToServer = useCallback(async (data: typeof formData, plot: PlotRow) => {
    const serialized = JSON.stringify(data);
    if (serialized === lastSaved.current) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/plots/${plot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      const { plot: updated } = await res.json();
      setPlots((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
      setSelected({ ...plot, ...updated } as PlotRow);
      lastSaved.current = serialized;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, []);

  const updateForm = useCallback((patch: Partial<typeof formData>) => {
    setFormData((prev) => {
      const next = { ...prev, ...patch };
      if (selected) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveToServer(next, selected);
        }, 500);
      }
      return next;
    });
  }, [selected, saveToServer]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const stats = {
    total: plots.length,
    available: plots.filter((p) => p.status === "available").length,
    booked: plots.filter((p) => p.status === "booked").length,
    hold: plots.filter((p) => p.status === "hold").length,
    reserved: plots.filter((p) => p.status === "reserved").length,
    agreement_signed: plots.filter((p) => p.status === "agreement_signed").length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - fixed */}
      <div className="shrink-0 px-4 sm:px-6 pt-6 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-glow)] border border-[rgba(0,212,170,0.2)] mb-3">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
            <span className="text-[var(--accent)] text-xs font-medium">Admin Panel</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Plot <span style={{ background: "var(--gradient-1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Management</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mb-4">
            Khasra number, owner name, size aur status manage karo — changes auto-save hote hain
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            <div className="glass rounded-xl p-3 text-center card-hover">
              <div className="text-lg sm:text-xl font-bold">{stats.total}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Total</div>
            </div>
            {(Object.entries(STATUS_LABELS) as [PlotStatus, string][]).map(([key, label]) => (
              <div key={key} className="glass rounded-xl p-3 text-center card-hover">
                <div className="text-lg sm:text-xl font-bold" style={{ color: STATUS_COLORS[key] }}>
                  {stats[key]}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider truncate">{label.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content - two independent scroll columns */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 px-4 sm:px-6 pb-6 max-w-7xl mx-auto w-full">
        {/* Left: Plot list - independent scroll */}
        <div className="w-full lg:w-[55%] flex flex-col min-h-0">
          {/* Filters - fixed */}
          <div className="flex gap-2 mb-3 shrink-0">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Plot, khasra, owner search karo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] cursor-pointer"
            >
              <option value="all">All Status</option>
              {(Object.entries(STATUS_LABELS) as [PlotStatus, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Table - scrollable */}
          <div className="glass rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Plot</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Khasra</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden sm:table-cell">Owner</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((plot) => (
                    <tr
                      key={plot.id}
                      onClick={() => selectPlot(plot)}
                      className={`cursor-pointer border-b border-[var(--border)] transition-colors ${
                        selected?.id === plot.id
                          ? "bg-[var(--accent-glow)]"
                          : "hover:bg-[var(--bg-card-hover)]"
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold">{plot.label}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{plot.khasara || "—"}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] hidden sm:table-cell">{plot.owner_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="status-badge" style={{ background: STATUS_COLORS[plot.status] + "20", color: STATUS_COLORS[plot.status] }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[plot.status] }} />
                          {STATUS_LABELS[plot.status].split(" ")[0]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-[var(--text-muted)]">
                        No plots found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] shrink-0">
              {filtered.length} of {plots.length} plots
            </div>
          </div>
        </div>

        {/* Right: Form - independent scroll */}
        <div className="w-full lg:w-[45%] min-h-0 flex flex-col">
          {selected ? (
            <div className="glass rounded-2xl p-5 sm:p-6 animate-fade-in flex-1 min-h-0 flex flex-col">
              {/* Form header - fixed */}
              <div className="flex items-start justify-between mb-4 shrink-0">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Editing Plot</div>
                  <div className="text-2xl font-extrabold">{selected.label}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                    style={{
                      background: saveStatus === "saved" ? "rgba(0,212,170,0.15)" :
                                  saveStatus === "saving" ? "rgba(240,136,62,0.15)" :
                                  saveStatus === "error" ? "rgba(248,81,73,0.15)" :
                                  "rgba(110,118,129,0.1)",
                      color: saveStatus === "saved" ? "var(--accent)" :
                             saveStatus === "saving" ? "var(--orange)" :
                             saveStatus === "error" ? "var(--red)" :
                             "var(--text-muted)",
                    }}
                  >
                    {saveStatus === "saving" && (
                      <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    )}
                    {saveStatus === "saved" && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {saveStatus === "error" && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    )}
                    {saveStatus === "saving" ? "Saving..." :
                     saveStatus === "saved" ? "Saved" :
                     saveStatus === "error" ? "Error" :
                     "Auto-save on"}
                  </div>
                  <span className="status-badge text-sm px-3 py-1.5" style={{ background: STATUS_COLORS[formData.status] + "20", color: STATUS_COLORS[formData.status] }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[formData.status], boxShadow: `0 0 8px ${STATUS_COLORS[formData.status]}60` }} />
                    {STATUS_LABELS[formData.status]}
                  </span>
                </div>
              </div>

              {/* Form fields - scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Status</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(Object.entries(STATUS_LABELS) as [PlotStatus, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateForm({ status: key })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          formData.status === key
                            ? "border-transparent"
                            : "border-[var(--border)] hover:border-[var(--border-light)] bg-[var(--bg-card)]"
                        }`}
                        style={formData.status === key ? {
                          background: STATUS_COLORS[key] + "25",
                          color: STATUS_COLORS[key],
                          borderColor: STATUS_COLORS[key] + "50",
                          boxShadow: `0 0 12px ${STATUS_COLORS[key]}15`,
                        } : undefined}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Khasra */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Khasra Number</label>
                  <input
                    type="text"
                    value={formData.khasara}
                    onChange={(e) => updateForm({ khasara: e.target.value })}
                    placeholder="e.g. 123/4"
                    className="w-full px-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>

                {/* Owner */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Owner Name</label>
                  <input
                    type="text"
                    value={formData.owner_name}
                    onChange={(e) => updateForm({ owner_name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full px-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>

                {/* Size */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Plot Size</label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => updateForm({ size: e.target.value })}
                    placeholder="e.g. 1200 sq ft"
                    className="w-full px-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>

                {/* Agreement */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                  <button
                    onClick={() => updateForm({ agreement: !formData.agreement })}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      formData.agreement
                        ? "bg-[var(--accent)] border-[var(--accent)]"
                        : "border-[var(--border-light)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    {formData.agreement && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm font-medium">Agreement Signed</span>
                </div>

                {/* Facing */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Facing</label>
                  <input
                    type="text"
                    value={formData.facing}
                    onChange={(e) => updateForm({ facing: e.target.value })}
                    placeholder="e.g. North, South"
                    className="w-full px-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>

                {/* Road */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Road</label>
                  <input
                    type="text"
                    value={formData.road}
                    onChange={(e) => updateForm({ road: e.target.value })}
                    placeholder="e.g. 30ft road"
                    className="w-full px-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateForm({ notes: e.target.value })}
                    rows={3}
                    placeholder="Any additional notes..."
                    className="w-full px-4 py-2.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent-glow)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                  <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Select a Plot</h3>
              <p className="text-[var(--text-muted)] text-sm">
                List me se koi plot click karo details edit karne ke liye
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
