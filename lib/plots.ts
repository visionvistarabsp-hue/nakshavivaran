/** JALI's canvas size. Doubles as the reference space for sizing SVG details
 *  proportionally on maps that use a much smaller coordinate system. */
export const IMAGE_WIDTH = 7200;
export const IMAGE_HEIGHT = 4000;

export function calcFontSize(
  polygon: number[][],
  label: string,
  mapWidth: number = IMAGE_WIDTH
): number {
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
  // Keep stroke/label weight visually identical across coordinate spaces:
  // a 1615-wide map needs ~0.22x the absolute units of a 7200-wide one.
  const s = mapWidth / IMAGE_WIDTH;
  return Math.max(14 * s, Math.min(52 * s, Math.round(fs)));
}

export function polygonToPoints(polygon: number[][]): string {
  return polygon.map(([px, py]) => `${px},${py}`).join(" ");
}
