"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { PlotRow, STATUS_COLORS, STATUS_LABELS } from "@/lib/types";
import { IMAGE_WIDTH, IMAGE_HEIGHT, calcFontSize, polygonToPoints } from "@/lib/plots";

const DRAG_THRESHOLD = 6;
const TAP_MAX_DIST = 40;
const TAP_MAX_TIME = 300;

interface Props {
  plots: PlotRow[];
  initialSelected?: string | null;
  onSelect?: (plot: PlotRow) => void;
}

export default function PlotMap({ plots, initialSelected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [selected, setSelected] = useState<string | null>(initialSelected || null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; plot: PlotRow } | null>(null);
  const [search, setSearch] = useState("");
  const [showLabels, setShowLabels] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [mobileDetail, setMobileDetail] = useState<PlotRow | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const fitScaleRef = useRef(1);
  const smoothState = useRef({ scale: 1, tx: 0, ty: 0 });
  const dragging = useRef(false);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const rafId = useRef<number>(0);
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const viewStart = useRef<{ tx: number; ty: number }>({ tx: 0, ty: 0 });
  const pinchInfo = useRef<{
    dist: number;
    startScale: number;
    startTx: number;
    startTy: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of plots) m[p.status] = (m[p.status] || 0) + 1;
    return m;
  }, [plots]);

  const pointsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plots) {
      if (p.polygon && p.polygon.length >= 3) m.set(p.id, polygonToPoints(p.polygon));
    }
    return m;
  }, [plots]);

  useEffect(() => {
    setShowLabels(scale >= 1.4);
  }, [scale]);

  const writeView = useCallback(() => {
    const el = viewRef.current;
    if (!el) return;
    const { scale: s, tx, ty } = smoothState.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    if (pctRef.current) pctRef.current.textContent = `${Math.round(s * 100)}%`;
  }, []);

  const syncView = useCallback(() => {
    const { scale: s, tx, ty } = smoothState.current;
    setScale(s);
    setTx(tx);
    setTy(ty);
    if (pctRef.current) pctRef.current.textContent = `${Math.round(s * 100)}%`;
  }, []);

  const commitView = useCallback(() => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      syncView();
      rafId.current = 0;
    });
  }, [syncView]);

  const getScaleBounds = useCallback(() => {
    const fit = fitScaleRef.current;
    return { min: fit * 0.6, max: 4 };
  }, []);

  const clampTransform = useCallback((newTx: number, newTy: number, s: number) => {
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
    if (s < 0.0001) return;
    fitScaleRef.current = s;
    smoothState.current = { scale: s, tx: newTx, ty: newTy };
    setScale(s);
    setTx(newTx);
    setTy(newTy);
  }, []);

  useEffect(() => {
    fitToContainer();
    const handleResize = () => {
      const el = containerRef.current;
      if (!el) return;
      const cur = smoothState.current;
      const fit = fitScaleRef.current;
      const nearFit = Math.abs(cur.scale - fit) / fit < 0.15;
      if (nearFit) {
        fitToContainer();
      } else {
        const clamped = clampTransform(cur.tx, cur.ty, cur.scale);
        smoothState.current = { ...cur, tx: clamped.tx, ty: clamped.ty };
        setTx(clamped.tx);
        setTy(clamped.ty);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitToContainer, clampTransform]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const bounds = getScaleBounds();
      const prev = smoothState.current;
      const newScale = Math.min(bounds.max, Math.max(bounds.min, prev.scale * factor));
      const k = newScale / prev.scale;
      const newTx = px - (px - prev.tx) * k;
      const newTy = py - (py - prev.ty) * k;
      const clamped = clampTransform(newTx, newTy, newScale);
      smoothState.current = { scale: newScale, tx: clamped.tx, ty: clamped.ty };
      writeView();
      commitView();
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [getScaleBounds, clampTransform, writeView, commitView]);

  const zoomAt = useCallback((target: number, px?: number, py?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const bounds = getScaleBounds();
    const t = Math.min(bounds.max, Math.max(bounds.min, target));
    const cx = px ?? el.clientWidth / 2;
    const cy = py ?? el.clientHeight / 2;
    const prev = smoothState.current;
    const k = t / prev.scale;
    const newTx = cx - (cx - prev.tx) * k;
    const newTy = cy - (cy - prev.ty) * k;
    const clamped = clampTransform(newTx, newTy, t);
    smoothState.current = { scale: t, tx: clamped.tx, ty: clamped.ty };
    setScale(t);
    setTx(clamped.tx);
    setTy(clamped.ty);
  }, [getScaleBounds, clampTransform]);

  const handleTap = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return;
    const now = performance.now();
    const last = lastTap.current;
    const rect = el.getBoundingClientRect();
    const px = x - rect.left;
    const py = y - rect.top;

    if (last && now - last.t < TAP_MAX_TIME && Math.hypot(x - last.x, y - last.y) < TAP_MAX_DIST) {
      const bounds = getScaleBounds();
      const prev = smoothState.current;
      const zoomed = prev.scale > fitScaleRef.current * 3;
      const target = zoomed
        ? fitScaleRef.current
        : Math.min(bounds.max, Math.max(prev.scale * 2.2, fitScaleRef.current * 10));
      zoomAt(target, px, py);
      lastTap.current = null;
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 400);
    } else {
      lastTap.current = { x, y, t: now };
    }
  }, [getScaleBounds, zoomAt]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") e.preventDefault();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const count = pointers.current.size;

    if (count === 1) {
      dragging.current = true;
      moved.current = false;
      setIsInteracting(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      viewStart.current = { tx: smoothState.current.tx, ty: smoothState.current.ty };
      pinchInfo.current = null;
    } else if (count === 2) {
      moved.current = true;
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();
      const pts = Array.from(pointers.current.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const cur = smoothState.current;
      pinchInfo.current = {
        dist: d || 1,
        startScale: cur.scale,
        startTx: cur.tx,
        startTy: cur.ty,
        anchorX: (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0),
        anchorY: (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0),
      };
    }

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchInfo.current && pointers.current.size === 2) {
      e.preventDefault();
      const pts = Array.from(pointers.current.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const info = pinchInfo.current;
      const bounds = getScaleBounds();
      const target = Math.min(bounds.max, Math.max(bounds.min, info.startScale * (d / info.dist)));
      const k = target / info.startScale;
      const newTx = info.anchorX - (info.anchorX - info.startTx) * k;
      const newTy = info.anchorY - (info.anchorY - info.startTy) * k;
      const clamped = clampTransform(newTx, newTy, target);
      smoothState.current = { scale: target, tx: clamped.tx, ty: clamped.ty };
      writeView();
      return;
    }

    if (dragging.current && pointers.current.size === 1) {
      e.preventDefault();
      const dx = e.clientX - (panStart.current?.x ?? e.clientX);
      const dy = e.clientY - (panStart.current?.y ?? e.clientY);
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) moved.current = true;
      const s = smoothState.current.scale;
      const newTx = viewStart.current.tx + dx;
      const newTy = viewStart.current.ty + dy;
      const clamped = clampTransform(newTx, newTy, s);
      smoothState.current = { ...smoothState.current, tx: clamped.tx, ty: clamped.ty };
      writeView();
    }
  }, [getScaleBounds, clampTransform, writeView]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const count = pointers.current.size;
    pointers.current.delete(e.pointerId);

    if (count === 2 && pointers.current.size === 1) {
      pinchInfo.current = null;
      dragging.current = true;
      const remaining = Array.from(pointers.current.values())[0];
      panStart.current = { x: remaining.x, y: remaining.y };
      viewStart.current = { tx: smoothState.current.tx, ty: smoothState.current.ty };
      return;
    }

    if (pointers.current.size === 0) {
      const wasMoved = moved.current;
      dragging.current = false;
      pinchInfo.current = null;
      setIsInteracting(false);
      syncView();

      if (e.pointerType === "touch" && !wasMoved) {
        handleTap(e.clientX, e.clientY);
      }
      if (wasMoved) {
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 400);
      }
      moved.current = false;
      panStart.current = null;
    }
  }, [handleTap, syncView]);

  const handlePointerCancel = useCallback(
    (e?: React.PointerEvent) => {
      if (!e || !pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 1) {
        pinchInfo.current = null;
        dragging.current = true;
        const remaining = Array.from(pointers.current.values())[0];
        panStart.current = { x: remaining.x, y: remaining.y };
        viewStart.current = { tx: smoothState.current.tx, ty: smoothState.current.ty };
        setIsInteracting(true);
        return;
      }
      pointers.current.clear();
      dragging.current = false;
      pinchInfo.current = null;
      moved.current = false;
      setIsInteracting(false);
      syncView();
    },
    [syncView]
  );

  const handlePlotClick = useCallback((plot: PlotRow) => {
    if (suppressClick.current) return;
    setSelected(plot.label);
    setMobileDetail(plot);
    onSelect?.(plot);
  }, [onSelect]);

  const handleSearch = useCallback(() => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const found =
      plots.find((p) => p.label.toLowerCase() === q) ||
      plots.find((p) => p.label.toLowerCase().includes(q));
    if (!found) return;

    const el = containerRef.current;
    if (!el) return;
    const bounds = getScaleBounds();
    const prev = smoothState.current;
    const scaled = prev.scale * 2.5;
    const target = Math.min(
      bounds.max,
      Math.max(scaled, Math.min(1.5, Math.max(bounds.min * 12, 1)))
    );
    const newTx = el.clientWidth / 2 - found.cx * target;
    const newTy = el.clientHeight / 2 - found.cy * target;
    const clamped = clampTransform(newTx, newTy, target);

    smoothState.current = { scale: target, tx: clamped.tx, ty: clamped.ty };
    setScale(target);
    setTx(clamped.tx);
    setTy(clamped.ty);
    setSelected(found.label);
    setMobileDetail(found);
    onSelect?.(found);
  }, [search, plots, getScaleBounds, clampTransform, onSelect]);

  const handleReset = useCallback(() => {
    setSelected(null);
    setMobileDetail(null);
    fitToContainer();
  }, [fitToContainer]);

  const zoomCentered = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const bounds = getScaleBounds();
    const prev = smoothState.current;
    const target = Math.min(bounds.max, Math.max(bounds.min, prev.scale * factor));
    zoomAt(target, el.clientWidth / 2, el.clientHeight / 2);
  }, [getScaleBounds, zoomAt]);

  const smoothStyle = !isInteracting
    ? { transition: "transform 0.18s cubic-bezier(0.25,0.1,0.25,1)" }
    : {};

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
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
            className="w-full pl-7 pr-2 py-1.5 text-xs sm:text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
        </div>

        <button onClick={handleSearch} className="btn-primary text-[10px] px-2 py-1.5 shrink-0">
          Search
        </button>

        <div className="w-px h-5 bg-[var(--border)] shrink-0" />

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => zoomCentered(1.4)}
            className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)] active:bg-[var(--bg-card-hover)] transition-all text-sm font-bold">
            +
          </button>
          <button onClick={() => zoomCentered(1 / 1.4)}
            className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)] active:bg-[var(--bg-card-hover)] transition-all text-sm font-bold">
            -
          </button>
          <button onClick={handleReset}
            className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)] active:bg-[var(--bg-card-hover)] transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        <span ref={pctRef} className="text-[9px] text-[var(--text-muted)] font-mono shrink-0">{Math.round(scale * 100)}%</span>
      </div>

      {/* Map area */}
      <div className="relative flex-1 min-h-0">
        {/* Map viewport */}
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden bg-[var(--bg-primary)] select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handlePointerCancel}
          style={{ touchAction: "none", WebkitTouchCallout: "none", cursor: dragging.current ? "grabbing" : "grab" }}
        >
          <div
            ref={viewRef}
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
            <picture>
              <source media="(max-width: 1023px)" type="image/webp" srcSet="/JALI_2400.webp" />
              <source media="(max-width: 1023px)" type="image/jpeg" srcSet="/JALI_2400_base.jpg" />
              <source type="image/avif" srcSet="/JALI_3600.avif" />
              <source type="image/webp" srcSet="/JALI_3600.webp" />
              <source type="image/jpeg" srcSet="/JALI_3600_base.jpg" />
              <img
                src="/JALI_3600_base.jpg"
                alt="JALI Layout Plan"
                width={IMAGE_WIDTH}
                height={IMAGE_HEIGHT}
                className="absolute inset-0 select-none pointer-events-none"
                draggable={false}
                loading="eager"
                fetchPriority="high"
              />
            </picture>

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
                      points={pointsMap.get(plot.id) || ""}
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

          {/* Title chip - mobile */}
          <div className="sm:hidden absolute top-2 left-2 z-10 glass rounded-lg px-3 py-1.5 text-[11px] font-semibold pointer-events-none">
            JALI Layout · {plots.length} plots
          </div>

          {/* Legend toggle - mobile */}
          <button
            onClick={() => setShowLegend((v) => !v)}
            onPointerDown={(e) => e.stopPropagation()}
            className="sm:hidden absolute top-2 right-2 z-10 w-9 h-9 rounded-xl glass border border-[var(--border)] flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Toggle legend"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h18M3 12h18M3 19h18" />
            </svg>
          </button>

          {/* Legend & stats - mobile */}
          {showLegend && (
            <div
              className="sm:hidden absolute top-12 right-2 z-10 glass rounded-xl p-2.5 min-w-[150px] animate-fade-in"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-bold text-[var(--text-primary)] mb-1.5 px-0.5">
                Legend &amp; Stats
              </div>
              <div className="space-y-1">
                {Object.keys(STATUS_COLORS).map((status) => {
                  const key = status as keyof typeof STATUS_COLORS;
                  return (
                    <div key={status} className="flex items-center justify-between gap-4 text-[11px]">
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_COLORS[key] }} />
                        {STATUS_LABELS[key]}
                      </span>
                      <span className="font-mono text-[var(--text-primary)]">{counts[key] || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
        </div>

        {/* Mobile detail sheet - outside touch-action:none so it can scroll */}
        {mobileDetail && (
          <div className="sm:hidden absolute bottom-0 left-0 right-0 z-20 animate-slide-up">
            <div className="mx-2 mb-2 rounded-2xl overflow-hidden"
              style={{ background: "rgba(13,17,23,0.95)", backdropFilter: "blur(20px)", border: "1px solid var(--border)" }}>
              <div className="max-h-[45vh] overflow-y-auto overscroll-contain">
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
          </div>
        )}
      </div>
    </div>
  );
}