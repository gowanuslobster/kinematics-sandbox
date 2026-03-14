/**
 * Scales a vector for on-screen display while enforcing readable minimum and
 * maximum lengths. Used by the chart and microscope overlays.
 */
export function scaleVector(
  x: number,
  y: number,
  factor: number,
  minLength: number,
  maxLength: number,
): { dx: number; dy: number } {
  const sourceLength = Math.hypot(x, y);
  if (sourceLength < 1e-8) {
    return { dx: 0, dy: 0 };
  }

  // Apply the caller's visual scale factor first.
  let dx = x * factor;
  let dy = y * factor;
  let len = Math.hypot(dx, dy);

  // Enforce a readable minimum so small but non-zero vectors stay visible.
  if (len > 0 && len < minLength) {
    const ratio = minLength / len;
    dx *= ratio;
    dy *= ratio;
    len = Math.hypot(dx, dy);
  }
  // Cap very large vectors so overlays stay inside the visualization area.
  if (len > maxLength && len > 0) {
    const ratio = maxLength / len;
    dx *= ratio;
    dy *= ratio;
  }

  return { dx, dy };
}
