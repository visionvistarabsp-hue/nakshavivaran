export const IMAGE_WIDTH = 7200;
export const IMAGE_HEIGHT = 4000;

export function calcFontSize(polygon: number[][], label: string): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of polygon) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const minDim = Math.min(w, h);
  let fs = minDim * 0.38;
  if (label.length > 4) fs *= 0.75;
  return Math.max(14, Math.min(52, Math.round(fs)));
}

export function polygonToPoints(polygon: number[][]): string {
  return polygon.map(([px, py]) => `${px},${py}`).join(" ");
}
