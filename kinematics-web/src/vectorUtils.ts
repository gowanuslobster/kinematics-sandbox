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

  let dx = x * factor;
  let dy = y * factor;
  let len = Math.hypot(dx, dy);

  if (len > 0 && len < minLength) {
    const ratio = minLength / len;
    dx *= ratio;
    dy *= ratio;
    len = Math.hypot(dx, dy);
  }
  if (len > maxLength && len > 0) {
    const ratio = maxLength / len;
    dx *= ratio;
    dy *= ratio;
  }

  return { dx, dy };
}
