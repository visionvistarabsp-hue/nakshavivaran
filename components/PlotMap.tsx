"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PlotRow, STATUS_COLORS, STATUS_LABELS } from "@/lib/types";
import { IMAGE_WIDTH, IMAGE_HEIGHT, calcFontSize, polygonToPoints } from "@/lib/plots";

interface Props {
  plots: PlotRow[];
  initialSelected?: string | null;
  onSelect?: (plot: PlotRow) => void;
}

export default function PlotMap({ plots, initialSelected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [selected, setSelected] = useState<string | null>(initialSelected || null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; plot: PlotRow } | null>(null);
  const [search, setSearch] = useState("");
  const [showLabels, setShowLabels] = useState(false);
  const [mobileDetail, setMobileDetail] = useState<PlotRow | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewStart = useRef({ tx: 0, ty: 0 });
  const pinchDist = useRef(0);
  const pinchScale = useRef(1);
  const pinchMid = useRef({ x: 0, y: 0 });
  const rafId = useRef<number>(0);
  const smoothState = useRef({ scale: 1, tx: 0, ty: 0 });

  useEffect(() => {
    setShowLabels(scale >= 1.4);
  }, [scale]);

  const fitToContainer = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scaleX = cw / IMAGE_WIDTH;
    const scaleY = ch / IMAGE_HEIGHT;
    const s = Math.min(scaleX, scaleY) * 0.95;
    const newTx = (cw - IMAGE_WIDTH * s) / 2;
    const newTy = (ch - IMAGE_HEIGHT * s) / 2;
    smoothState.current = { scale: s, tx: newTx, ty: newTy };
    setScale(s);
    setTx(newTx);
    setTy(newTy);
  }, []);

  useEffect(() => {
    fitToContainer();
    const handleResize = () => fitToContainer();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitToContainer]);

  // Non-passive wheel listener for preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;

      const prev = smoothState.current;
      const newScale = Math.max(0.3, Math.min(8, prev.scale * factor));
      const k = newScale / prev.scale;
      const newTx = px - (px - prev.tx) * k;
      const newTy = py - (py - prev.ty) * k;
      const clamped = clamp(newTx, newTy, newScale);

      smoothState.current = { scale: newScale, tx: clamped.tx, ty: clamped.ty };

      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          setScale(smoothState.current.scale);
          setTx(smoothState.current.tx);
          setTy(smoothState.current.ty);
          rafId.current = 0;
        });
      }
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const clamp = useCallback((newTx: number, newTy: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { tx: newTx, ty: newTy };
    const w = el.clientWidth;
    const h = el.clientHeight;
    const scaledW = IMAGE_WIDTH * s;
    const scaledH = IMAGE_HEIGHT * s;

    let clampedTx = newTx;
    let clampedTy = newTy;

    if (scaledW <= w) {
      clampedTx = (w - scaledW) / 2;
    } else {
      clampedTx = Math.min(0, Math.max(w - scaledW, newTx));
    }

    if (scaledH <= h) {
      clampedTy = (h - scaledH) / 2;
    } else {
      clampedTy = Math.min(0, Math.max(h - scaledH, newTy));
    }

    return { tx: clampedTx, ty: clampedTy };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    setIsInteracting(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    viewStart.current = { tx, ty };
    smoothState.current = { scale, tx, ty };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [tx, ty, scale]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const newTx = viewStart.current.tx + dx;
    const newTy = viewStart.current.ty + dy;
    const clamped = clamp(newTx, newTy, scale);
    smoothState.current = { scale, tx: clamped.tx, ty: clamped.ty };
    setTx(clamped.tx);
    setTy(clamped.ty);
  }, [scale, clamp]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    smoothState.current = { scale, tx, ty };
    setTimeout(() => setIsInteracting(false), 50);
  }, [scale, tx, ty]);

  // Touch pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist.current = Math.sqrt(dx * dx + dy * dy);
      pinchScale.current = scale;
      pinchMid.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      setIsInteracting(true);
    } else if (e.touches.length === 1) {
      dragging.current = true;
      setIsInteracting(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      viewStart.current = { tx, ty };
      smoothState.current = { scale, tx, ty };
    }
  }, [tx, ty, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / pinchDist.current;
      const newScale = Math.max(0.3, Math.min(8, pinchScale.current * factor));
      const el = containerRef.current;
      if (!el) return;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - el.getBoundingClientRect().left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - el.getBoundingClientRect().top;
      const k = newScale / smoothState.current.scale;
      const newTx = cx - (cx - smoothState.current.tx) * k;
      const newTy = cy - (cy - smoothState.current.ty) * k;
      const clamped = clamp(newTx, newTy, newScale);
      smoothState.current = { scale: newScale, tx: clamped.tx, ty: clamped.ty };

      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          setScale(smoothState.current.scale);
          setTx(smoothState.current.tx);
          setTy(smoothState.current.ty);
          rafId.current = 0;
        });
      }
    } else if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      const newTx = viewStart.current.tx + dx;
      const newTy = viewStart.current.ty + dy;
      const clamped = clamp(newTx, newTy, scale);
      setTx(clamped.tx);
      setTy(clamped.ty);
    }
  }, [scale, clamp]);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    smoothState.current = { scale, tx, ty };
    setTimeout(() => setIsInteracting(false), 50);
  }, [scale, tx, ty]);

  const handlePlotClick = useCallback((plot: PlotRow) => {
    setSelected(plot.label);
    setMobileDetail(plot);
    onSelect?.(plot);
  }, [onSelect]);

  const handleSearch = useCallback(() => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const found = plots.find((p) => p.label.toLowerCase() === q) ||
                  plots.find((p) => p.label.toLowerCase().includes(q));
    if (!found) return;

    const el = containerRef.current;
    if (!el) return;
    const sx = (found.cx / IMAGE_WIDTH) * el.clientWidth * scale;
    const sy = (found.cy / IMAGE_HEIGHT) * el.clientHeight * scale;
    const target = Math.max(scale, 1.5);
    const k = target / scale;
    const newTx = el.clientWidth / 2 - sx * k;
    const newTy = el.clientHeight / 2 - sy * k;
    const clamped = clamp(newTx, newTy, target);

    setScale(target);
    setTx(clamped.tx);
    setTy(clamped.ty);
    smoothState.current = { scale: target, tx: clamped.tx, ty: clamped.ty };
    setSelected(found.label);
    setMobileDetail(found);
    onSelect?.(found);
  }, [search, plots, scale, clamp, onSelect]);

  const handleReset = useCallback(() => {
    setSelected(null);
    setMobileDetail(null);
    fitToContainer();
  }, [fitToContainer]);

  const zoomCentered = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const newScale = Math.max(0.3, Math.min(8, scale * factor));
    const k = newScale / scale;
    const newTx = cx - (cx - tx) * k;
    const newTy = cy - (cy - ty) * k;
    const clamped = clamp(newTx, newTy, newScale);
    smoothState.current = { scale: newScale, tx: clamped.tx, ty: clamped.ty };
    setScale(newScale);
    setTx(clamped.tx);
    setTy(clamped.ty);
  }, [scale, tx, ty, clamp]);

  const smoothStyle = !isInteracting
    ? { transition: "transform 0.18s cubic-bezier(0.25,0.1,0.25,1)" }
    : {};

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Plot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
        </div>

        <button onClick={handleSearch} className="btn-primary text-[10px] px-2 py-1.5 shrink-0">
          Search
        </button>

        <div className="w-px h-5 bg-[var(--border)] shrink-0" />

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => zoomCentered(1.4)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)] active:bg-[var(--bg-card-hover)] transition-all text-sm font-bold">
            +
          </button>
          <button onClick={() => zoomCentered(1 / 1.4)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)] active:bg-[var(--bg-card-hover)] transition-all text-sm font-bold">
            -
          </button>
          <button onClick={handleReset}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)] active:bg-[var(--bg-card-hover)] transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        <span className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">{Math.round(scale * 100)}%</span>
      </div>

      {/* Map viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-[var(--bg-primary)] min-h-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "none", cursor: dragging.current ? "grabbing" : "grab" }}
      >
        <div
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "0 0",
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            position: "relative",
            willChange: "transform",
            ...smoothStyle,
          }}
        >
          <img
            src="/JALI_page_1.png"
            alt="JALI Layout Plan"
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            className="absolute inset-0 select-none pointer-events-none"
            draggable={false}
          />

          <svg
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            viewBox={`0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`}
            className="absolute inset-0"
          >
            {plots.map((plot) => {
              if (!plot.polygon || plot.polygon.length < 3) return null;
              const color = STATUS_COLORS[plot.status] || STATUS_COLORS.available;
              const isSelected = selected === plot.label;
              const isHovered = hovered === plot.label;

              return (
                <g
                  key={plot.id}
                  className="plot-marker"
                  data-label={plot.label}
                  onClick={() => handlePlotClick(plot)}
                  onMouseEnter={(e) => {
                    setHovered(plot.label);
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left + 14,
                        y: e.clientY - rect.top + 14,
                        plot,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        x: e.clientX - rect.left + 14,
                        y: e.clientY - rect.top + 14,
                        plot,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    setTooltip(null);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <polygon
                    points={polygonToPoints(plot.polygon)}
                    fill={color}
                    fillOpacity={isSelected ? 0.5 : isHovered ? 0.45 : 0.3}
                    stroke={color}
                    strokeWidth={isSelected ? 16 : 10}
                    strokeOpacity={isSelected ? 1 : 0.8}
                    strokeLinejoin="round"
                    style={isSelected ? { filter: `drop-shadow(0 0 10px ${color}80)` } : undefined}
                  />
                  {showLabels && (
                    <text
                      x={plot.cx}
                      y={plot.cy + 5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={calcFontSize(plot.polygon, plot.label)}
                      fontWeight={700}
                      fill="#fff"
                      paintOrder="stroke"
                      stroke="rgba(0,0,0,0.6)"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {plot.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Tooltip - desktop */}
        {tooltip && !mobileDetail && (
          <div
            className="hidden sm:block absolute z-10 pointer-events-none glass rounded-lg px-3 py-2 text-xs max-w-[200px] animate-fade-in"
            style={{
              left: Math.min(tooltip.x, (containerRef.current?.clientWidth || 300) - 210),
              top: tooltip.y,
            }}
          >
            <div className="font-bold text-[var(--text-primary)] mb-0.5">Plot {tooltip.plot.label}</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[tooltip.plot.status] }} />
              <span className="text-[var(--text-secondary)]">{STATUS_LABELS[tooltip.plot.status]}</span>
            </div>
          </div>
        )}

        {/* Mobile detail panel */}
        {mobileDetail && (
          <div className="sm:hidden absolute bottom-0 left-0 right-0 z-20 animate-slide-up">
            <div className="mx-2 mb-2 rounded-2xl overflow-hidden"
              style={{ background: "rgba(13,17,23,0.95)", backdropFilter: "blur(20px)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm"
                    style={{ background: STATUS_COLORS[mobileDetail.status] + "25", color: STATUS_COLORS[mobileDetail.status] }}>
                    {mobileDetail.label}
                  </div>
                  <div>
                    <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Plot Number</div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[mobileDetail.status], boxShadow: `0 0 6px ${STATUS_COLORS[mobileDetail.status]}80` }} />
                      <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[mobileDetail.status] }}>
                        {STATUS_LABELS[mobileDetail.status]}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setMobileDetail(null); setSelected(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-[var(--text-muted)]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-4 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {mobileDetail.khasara && (
                    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Khasra</div>
                      <div className="text-xs font-semibold mt-0.5">{mobileDetail.khasara}</div>
                    </div>
                  )}
                  {mobileDetail.owner_name && (
                    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Owner</div>
                      <div className="text-xs font-semibold mt-0.5">{mobileDetail.owner_name}</div>
                    </div>
                  )}
                  {mobileDetail.size && (
                    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Size</div>
                      <div className="text-xs font-semibold mt-0.5">{mobileDetail.size}</div>
                    </div>
                  )}
                  {mobileDetail.facing && (
                    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Facing</div>
                      <div className="text-xs font-semibold mt-0.5">{mobileDetail.facing}</div>
                    </div>
                  )}
                  {mobileDetail.road && (
                    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Road</div>
                      <div className="text-xs font-semibold mt-0.5">{mobileDetail.road}</div>
                    </div>
                  )}
                  {mobileDetail.notes && (
                    <div className="col-span-2 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Notes</div>
                      <div className="text-xs font-semibold mt-0.5">{mobileDetail.notes}</div>
                    </div>
                  )}
                </div>

                {!mobileDetail.khasara && !mobileDetail.owner_name && !mobileDetail.size && (
                  <div className="text-[var(--text-muted)] text-xs text-center py-2">No details added yet</div>
                )}

                <a href="/admin" className="block mt-3 text-center text-xs font-semibold py-2.5 rounded-xl btn-primary">
                  Edit Details in Admin →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
