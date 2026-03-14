import type { MicroscopeBallType } from "./PhysicsMicroscope";

/** Shared numeric clamp used by the microscope's layout and visual scaling code. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Maps the selected ball preset to the short label shown in the microscope header. */
export function describeBall(ballType: MicroscopeBallType): string {
  switch (ballType) {
    case "baseball":
      return "Baseball";
    case "pingPong":
      return "Ping Pong";
    case "cannonball":
      return "Cannonball";
    default:
      return "Custom";
  }
}

/** Builds a simple SVG line-and-head path for a vector arrow anchored at (cx, cy). */
export function buildArrowPath(cx: number, cy: number, dx: number, dy: number): string {
  const length = Math.hypot(dx, dy);
  if (length <= 1e-10) return "";
  const tx = cx + dx;
  const ty = cy + dy;
  const ux = dx / length;
  const uy = dy / length;
  const headLength = Math.max(6, length * 0.3);
  const headWidth = Math.max(3.5, length * 0.18);
  const baseX = tx - ux * headLength;
  const baseY = ty - uy * headLength;
  const px = -uy;
  const py = ux;
  const leftX = baseX + px * headWidth;
  const leftY = baseY + py * headWidth;
  const rightX = baseX - px * headWidth;
  const rightY = baseY - py * headWidth;
  return `M ${cx},${cy} L ${tx},${ty} M ${tx},${ty} L ${leftX},${leftY} M ${tx},${ty} L ${rightX},${rightY}`;
}

/** Rotates a 2D vector into the microscope's current display frame. */
export function rotateVector(x: number, y: number, angleRad: number): { x: number; y: number } {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  return {
    x: (x * cosA) - (y * sinA),
    y: (x * sinA) + (y * cosA),
  };
}

export interface Point {
  x: number;
  y: number;
}

/** Converts sampled points into a smooth quadratic SVG path for streamlines. */
export function buildSmoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) * 0.5;
    const midY = (points[i].y + points[i + 1].y) * 0.5;
    d += ` Q ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x.toFixed(1)},${last.y.toFixed(1)}`;
  return d;
}

/**
 * Normalizes to a baseball baseline so lighter balls can show larger visual
 * responses when the same force produces a stronger kinematic effect.
 */
export function getMassNormalizationFactor(mass: number): number {
  const BASEBALL_MASS = 0.145;
  return BASEBALL_MASS / Math.max(mass, 0.001);
}
