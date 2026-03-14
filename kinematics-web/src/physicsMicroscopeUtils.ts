import { scaleVector } from "./vectorUtils";
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

/** Simple 2D point used while constructing SVG geometry for the microscope. */
export interface Point {
  x: number;
  y: number;
}

/** Final streamline SVG paths plus opacity for one rendered airflow layer. */
export interface StreamlinePath {
  id: string;
  main: string;
  wake: string;
  alpha: number;
}

/** Bundles the arrow, legend, and pressure-highlight values needed by the microscope UI. */
export interface VectorDisplayState {
  velocityArrow: string;
  dragArrow: string;
  magnusArrow: string;
  gravityArrow: string;
  vectorComponents: Record<"velocity" | "drag" | "magnus" | "gravity", { x: number; y: number }>;
  frontRedColor: string;
  wakeBlueColor: string;
  spinRedColor: string;
  spinBlueColor: string;
  withFlowSide: number;
  againstFlowSide: number;
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

/**
 * Converts the live physics vectors into readable microscope overlays,
 * including arrow paths, legend data, and pressure-highlight colors.
 */
export function getVectorDisplayState({
  centerX,
  centerY,
  dragX,
  dragY,
  gravityX,
  gravityY,
  keepStreamlinesHorizontal,
  magnusX,
  magnusY,
  massNormalizationFactor,
  spinRPM,
  svgWidth,
  velocityX,
  velocityY,
  vizHeight,
}: {
  centerX: number;
  centerY: number;
  dragX: number;
  dragY: number;
  gravityX: number;
  gravityY: number;
  keepStreamlinesHorizontal: boolean;
  magnusX: number;
  magnusY: number;
  massNormalizationFactor: number;
  spinRPM: number;
  svgWidth: number;
  velocityX: number;
  velocityY: number;
  vizHeight: number;
}): VectorDisplayState {
  // Rebuild the flow angle in display coordinates so vectors can align with the chosen frame.
  const flowVectorX = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 1 : velocityX;
  const flowVectorY = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 0 : -velocityY;
  const flowAngleDeg = (Math.atan2(flowVectorY, flowVectorX) * 180) / Math.PI;

  // These scales are intentionally visual, not literal, so weak forces stay readable.
  const visualScale = 38 * massNormalizationFactor;
  const vectorMinLength = 7;
  const vectorMaxLength = Math.min(svgWidth, vizHeight) * 0.4;
  const vectorFrameRotationRad = keepStreamlinesHorizontal ? -(flowAngleDeg * Math.PI / 180) : 0;

  // Rotate all vectors into the microscope's current display frame before scaling them.
  const velocityDisplay = rotateVector(velocityX, -velocityY, vectorFrameRotationRad);
  const dragDisplay = rotateVector(dragX, -dragY, vectorFrameRotationRad);
  const magnusDisplay = rotateVector(magnusX, -magnusY, vectorFrameRotationRad);
  const gravityDisplay = rotateVector(gravityX, -gravityY, vectorFrameRotationRad);

  // Convert raw vectors into clamped on-screen arrows with a readable minimum length.
  const velocityVector = scaleVector(velocityDisplay.x, velocityDisplay.y, 1.8, vectorMinLength, vectorMaxLength);
  const dragVector = scaleVector(dragDisplay.x, dragDisplay.y, visualScale, vectorMinLength, vectorMaxLength);
  const magnusVector = scaleVector(magnusDisplay.x, magnusDisplay.y, visualScale, vectorMinLength, vectorMaxLength);
  const gravityVector = scaleVector(gravityDisplay.x, gravityDisplay.y, visualScale, vectorMinLength, vectorMaxLength);

  // These mass-normalized magnitudes only drive visual emphasis such as opacity.
  const effectiveDrag = Math.hypot(dragX, dragY) * massNormalizationFactor;
  const effectiveMagnus = Math.hypot(magnusX, magnusY) * massNormalizationFactor;
  const fadeResistance = 0.6;
  const dragAlpha = clamp(effectiveDrag / (effectiveDrag + fadeResistance), 0, 0.75);
  const magnusAlpha = clamp(effectiveMagnus / (effectiveMagnus + fadeResistance), 0, 0.75);

  // Spin direction decides which side gets the suction-side versus pressure-side highlight.
  const withFlowSide = spinRPM >= 0 ? -1 : 1;
  const againstFlowSide = -withFlowSide;

  return {
    velocityArrow: buildArrowPath(centerX, centerY, velocityVector.dx, velocityVector.dy),
    dragArrow: buildArrowPath(centerX, centerY, dragVector.dx, dragVector.dy),
    magnusArrow: buildArrowPath(centerX, centerY, magnusVector.dx, magnusVector.dy),
    gravityArrow: buildArrowPath(centerX, centerY, gravityVector.dx, gravityVector.dy),
    vectorComponents: {
      velocity: { x: velocityX, y: velocityY },
      drag: { x: dragX, y: dragY },
      magnus: { x: magnusX, y: magnusY },
      gravity: { x: gravityX, y: gravityY },
    },
    frontRedColor: `rgba(239,68,68,${dragAlpha.toFixed(3)})`,
    wakeBlueColor: `rgba(59,130,246,${(dragAlpha * 0.8).toFixed(3)})`,
    spinRedColor: `rgba(239,68,68,${magnusAlpha.toFixed(3)})`,
    spinBlueColor: `rgba(59,130,246,${magnusAlpha.toFixed(3)})`,
    withFlowSide,
    againstFlowSide,
  };
}

/**
 * Builds the decorative airflow streamlines that visually suggest suction,
 * pressure, and wake behavior around the ball. This is a visual approximation,
 * not a physical flow solver.
 */
export function buildStreamlines({
  ballRadius,
  centerX,
  centerY,
  densityRatio,
  magnusY,
  massNormalizationFactor,
  spinRPM,
  svgWidth,
  velocityX,
  velocityY,
  vizHeight,
}: {
  ballRadius: number;
  centerX: number;
  centerY: number;
  densityRatio: number;
  magnusY: number;
  massNormalizationFactor: number;
  spinRPM: number;
  svgWidth: number;
  velocityX: number;
  velocityY: number;
  vizHeight: number;
}): StreamlinePath[] {
  const lines: StreamlinePath[] = [];

  // Scale the number of visible layers with panel height while keeping a sane range.
  const totalCount = clamp(Math.round(vizHeight / 18), 10, 18);
  const halfCount = Math.floor(totalCount / 2);
  // Streamlines enter from the right edge and leave toward the left-side wake.
  const xMin = -svgWidth * 0.48;
  const xMax = svgWidth * 0.48;
  // Backspin makes the upper side the suction side; topspin flips that relationship.
  const withFlowSide = spinRPM >= 0 ? -1 : 1;

  // Use a mass-normalized Magnus proxy so lightweight balls can show stronger visual bending.
  const actualMagnusForce = Math.abs(magnusY);
  const effectiveMagnus = actualMagnusForce * massNormalizationFactor;
  const spinStrength = clamp(effectiveMagnus * 0.35, 0, 1.4);
  // Faster airflow increases wake wobble and slightly sharpens the streamline presentation.
  const flowStrength = clamp(Math.hypot(velocityX, velocityY) / 38, 0, 1.5);
  const sampleStep = Math.max(8, Math.round(svgWidth / 36));
  const baseSpacing = 22;

  // Build mirrored layers above and below the ball, then let spin break the symmetry.
  for (const side of [-1, 1]) {
    const isSuctionSide = side === withFlowSide;

    // The innermost line sits closer on the suction side and farther away on the pressure side.
    const baseClearance = 1.18;
    const suctionGap = Math.max(1.04, baseClearance - (spinStrength * 0.35));
    const pressureGap = baseClearance + (spinStrength * 0.50);
    const anchorClearance = ballRadius * (isSuctionSide ? suctionGap : pressureGap);

    // Layer spacing compresses on the suction side and spreads on the pressure side.
    const layerSpacing = isSuctionSide
      ? Math.max(4, baseSpacing * (1 - spinStrength * 0.5))
      : baseSpacing * (1 + spinStrength * 0.9);

    // Bend width controls how early incoming flow starts curving around the ball.
    const bendWidth = isSuctionSide
      ? ballRadius * (1.8 - spinStrength * 0.35)
      : ballRadius * (1.8 + spinStrength * 0.5);

    // Track the last layer peak so each new layer can stack outward from it.
    let previousTransitionY = 0;

    for (let layer = 0; layer < halfCount; layer++) {
      // Start each layer farther from center as we move outward from the ball.
      const yBase = side * (layer === 0 ? 1 : layer * baseSpacing);

      let transitionY: number;
      if (layer === 0) {
        transitionY = side * anchorClearance;
      } else {
        // Subsequent layers inherit the previous peak and then add side-specific spacing.
        transitionY = previousTransitionY + (side * layerSpacing);
      }
      previousTransitionY = transitionY;

      // Entry points describe how flow curves from the right edge into the ball region.
      const entryPoints: Point[] = [];
      for (let x = xMax; x >= 0; x -= sampleStep) {
        const distToCenter = Math.abs(x);
        const entryInfluence = Math.exp(-Math.pow(distToCenter / bendWidth, 2));
        const y = yBase + (transitionY - yBase) * entryInfluence;
        entryPoints.push({ x: centerX + x, y: centerY + y });
      }

      if (entryPoints[entryPoints.length - 1]?.x !== centerX) {
        entryPoints.push({ x: centerX, y: centerY + transitionY });
      } else {
        entryPoints[entryPoints.length - 1] = { x: centerX, y: centerY + transitionY };
      }

      // Wake points extend leftward and add wobble to suggest turbulent separation.
      const wakePoints: Point[] = [];
      for (let x = 0; x >= xMin; x -= sampleStep) {
        const wakeNorm = clamp(Math.abs(x) / Math.max(1, Math.abs(xMin)), 0, 1);
        const wakeInfluence = Math.exp(-Math.pow(Math.abs(x) / bendWidth, 2));
        const baseWake = yBase + (transitionY - yBase) * wakeInfluence;

        const wakeWobble = Math.sin((x / (ballRadius * 1.02)) + (layer * 0.72))
          * (0.72 + flowStrength * 1.02)
          * Math.pow(wakeNorm, 0.9)
          * (0.6 + 0.8 * densityRatio);

        const y = baseWake + wakeWobble;
        wakePoints.push({ x: centerX + x, y: centerY + y });
      }

      if (wakePoints[0]) {
        wakePoints[0] = { x: centerX, y: centerY + transitionY };
      }

      // Fade outer layers so the most important airflow remains visually closest to the ball.
      const absYNorm = layer / 8;
      const alpha = clamp((0.36 + (1 - absYNorm) * 0.6) * densityRatio, 0.1, 1);

      lines.push({
        id: `line-${side > 0 ? "bottom" : "top"}-${layer}`,
        main: buildSmoothPath(entryPoints),
        wake: buildSmoothPath(wakePoints),
        alpha,
      });
    }
  }

  return lines;
}
