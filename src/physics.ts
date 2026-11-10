/** Continuous collision against a rectangle with rounded (circle-expanded) corners. */
export interface Hit { time: number; nx: number; ny: number; }
const EPS = 1e-9;

/** First contact with a circular pickup, including an initial overlap. */
export function sweepPointCircle(x: number, y: number, vx: number, vy: number, cx: number, cy: number, radius: number, duration: number): number | null {
  const dx = x - cx, dy = y - cy;
  const c = dx * dx + dy * dy - radius * radius;
  if (c <= EPS) return 0;
  const a = vx * vx + vy * vy;
  if (a <= EPS) return null;
  const b = dx * vx + dy * vy;
  const d = b * b - a * c;
  if (d < 0 || b >= 0) return null;
  const time = (-b - Math.sqrt(d)) / a;
  return time >= -EPS && time <= duration + EPS ? Math.max(0, time) : null;
}

export function circleOverlapsCell(x: number, y: number, radius: number, col: number, row: number): boolean {
  const dx = x - Math.max(col, Math.min(col + 1, x));
  const dy = y - Math.max(row, Math.min(row + 1, y));
  return dx * dx + dy * dy < radius * radius - EPS;
}

export function sweepCircleCell(x: number, y: number, vx: number, vy: number, radius: number, col: number, row: number, duration: number): Hit | null {
  let result: Hit | null = null;
  const accept = (time: number, nx: number, ny: number) => {
    if (time >= -EPS && time <= duration + EPS && vx * nx + vy * ny < -EPS && (!result || time < result.time)) {
      result = { time: Math.max(0, time), nx, ny };
    }
  };
  const closestX = Math.max(col, Math.min(col + 1, x));
  const closestY = Math.max(row, Math.min(row + 1, y));
  const ox = x - closestX, oy = y - closestY;
  const distance2 = ox * ox + oy * oy;
  if (distance2 < radius * radius - EPS) {
    if (distance2 > EPS) {
      const length = Math.sqrt(distance2);
      return { time: 0, nx: ox / length, ny: oy / length };
    }
    const faces = [
      { depth: x - col, nx: -1, ny: 0 }, { depth: col + 1 - x, nx: 1, ny: 0 },
      { depth: y - row, nx: 0, ny: -1 }, { depth: row + 1 - y, nx: 0, ny: 1 }
    ];
    faces.sort((a, b) => a.depth - b.depth);
    return { time: 0, nx: faces[0].nx, ny: faces[0].ny };
  }
  if (Math.abs(vx) > EPS) {
    let time = (col - radius - x) / vx;
    let atY = y + vy * time;
    if (atY >= row - EPS && atY <= row + 1 + EPS) accept(time, -1, 0);
    time = (col + 1 + radius - x) / vx;
    atY = y + vy * time;
    if (atY >= row - EPS && atY <= row + 1 + EPS) accept(time, 1, 0);
  }
  if (Math.abs(vy) > EPS) {
    let time = (row - radius - y) / vy;
    let atX = x + vx * time;
    if (atX >= col - EPS && atX <= col + 1 + EPS) accept(time, 0, -1);
    time = (row + 1 + radius - y) / vy;
    atX = x + vx * time;
    if (atX >= col - EPS && atX <= col + 1 + EPS) accept(time, 0, 1);
  }
  const speed2 = vx * vx + vy * vy;
  if (speed2 > EPS) {
    for (let ix = 0; ix <= 1; ix++) for (let iy = 0; iy <= 1; iy++) {
      const cx = col + ix, cy = row + iy;
      const dx = x - cx, dy = y - cy;
      const b = dx * vx + dy * vy;
      const c = dx * dx + dy * dy - radius * radius;
      const discriminant = b * b - speed2 * c;
      if (discriminant < -EPS) continue;
      const time = (-b - Math.sqrt(Math.max(0, discriminant))) / speed2;
      const px = x + vx * time - cx, py = y + vy * time - cy;
      if ((ix === 0 ? px <= EPS : px >= -EPS) && (iy === 0 ? py <= EPS : py >= -EPS)) {
        accept(time, px / radius, py / radius);
      }
    }
  }
  return result;
}

export function segmentDistanceSquared(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const length2 = dx * dx + dy * dy;
  const t = length2 > EPS ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2)) : 0;
  return (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2;
}
