"use client";

import { useState, useRef, useCallback } from "react";

interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

export function useMapZoom(
  imageWidth: number = 7200,
  imageHeight: number = 4000
) {
  const [view, setView] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setView((prev) => {
        const newScale = Math.max(0.125, Math.min(8, prev.scale * delta));
        return { ...prev, scale: newScale };
      });
    },
    []
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setView((prev) => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const zoomTo = useCallback((target: number, cx?: number, cy?: number) => {
    setView((prev) => {
      const k = target / prev.scale;
      const px = cx ? (cx * imageWidth) / prev.scale : cx;
      const py = cy ? (cy * imageHeight) / prev.scale : cy;
      return {
        scale: target,
        tx: (px ?? 0) - (px ?? 0) * k,
        ty: (py ?? 0) - (py ?? 0) * k,
      };
    });
  }, [imageWidth, imageHeight]);

  const reset = useCallback(() => {
    setView({ scale: 1, tx: 0, ty: 0 });
  }, []);

  return {
    view,
    isDragging,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    zoomTo,
    reset,
  };
}
