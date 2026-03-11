import { useCallback, useEffect, useMemo, useRef, useState, useId, type PointerEvent as ReactPointerEvent } from "react";
import { AIR_DENSITY_SEA_LEVEL } from "./physics";

export type MicroscopeBallType = "baseball" | "pingPong" | "cannonball" | "custom";

export interface PhysicsMicroscopeProps {
  velocity: number;
  spinRPM: number;
  ballType: MicroscopeBallType;
  airDensity: number;
  magnusLiftN: number;
  velocityX: number;
  velocityY: number;
  dragX: number;
  dragY: number;
  magnusX: number;
  magnusY: number;
  gravityX: number;
  gravityY: number;
}

type VectorKey = "velocity" | "drag" | "magnus" | "gravity";

const PANEL_MIN_WIDTH = 300;
const PANEL_MIN_HEIGHT = 320;
const PANEL_DEFAULT_WIDTH = 360;
const PANEL_DEFAULT_HEIGHT = 390;
const PANEL_PADDING = 10;
const HEADER_HEIGHT = 38;
const DETAILS_HEIGHT = 132;

const VECTOR_META: Array<{ key: VectorKey; label: string; color: string }> = [
  { key: "velocity", label: "Velocity", color: "#22c55e" },
  { key: "drag", label: "Drag", color: "#ef4444" },
  { key: "magnus", label: "Magnus", color: "#a855f7" },
  { key: "gravity", label: "Gravity", color: "#3b82f6" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getViewport() {
  if (typeof window === "undefined") {
    return { width: 1400, height: 900 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function describeBall(ballType: MicroscopeBallType): string {
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

function scaleVector(
  x: number,
  y: number,
  factor: number,
  minLength: number,
  maxLength: number,
): { dx: number; dy: number } {
  const sourceLength = Math.hypot(x, y);
  if (sourceLength < 1e-8) return { dx: 0, dy: 0 };
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

function buildArrowPath(cx: number, cy: number, dx: number, dy: number): string {
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

interface Point {
  x: number;
  y: number;
}

function buildCubicBezierPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function SeamTexture({
  ballType,
  cx,
  cy,
  radius,
}: {
  ballType: MicroscopeBallType;
  cx: number;
  cy: number;
  radius: number;
}) {
  if (ballType === "cannonball") {
    return (
      <>
        <circle cx={cx - radius * 0.28} cy={cy - radius * 0.34} r={radius * 0.12} fill="#374151" />
        <circle cx={cx + radius * 0.3} cy={cy - radius * 0.24} r={radius * 0.11} fill="#4b5563" />
        <circle cx={cx - radius * 0.16} cy={cy + radius * 0.34} r={radius * 0.11} fill="#374151" />
        <circle cx={cx + radius * 0.34} cy={cy + radius * 0.28} r={radius * 0.12} fill="#4b5563" />
      </>
    );
  }
  if (ballType === "pingPong") {
    return (
      <>
        <path d={`M ${cx - radius * 0.65} ${cy - radius * 0.28} C ${cx - radius * 0.1} ${cy - radius * 0.06}, ${cx + radius * 0.36} ${cy - radius * 0.06}, ${cx + radius * 0.74} ${cy - radius * 0.28}`} stroke="#f8fafc" strokeWidth={2} fill="none" />
        <path d={`M ${cx - radius * 0.65} ${cy + radius * 0.28} C ${cx - radius * 0.1} ${cy + radius * 0.06}, ${cx + radius * 0.36} ${cy + radius * 0.06}, ${cx + radius * 0.74} ${cy + radius * 0.28}`} stroke="#e2e8f0" strokeWidth={2} fill="none" />
      </>
    );
  }
  return (
    <>
      <path d={`M ${cx - radius * 0.72} ${cy - radius * 0.44} C ${cx - radius * 0.18} ${cy - radius * 0.86}, ${cx + radius * 0.28} ${cy - radius * 0.84}, ${cx + radius * 0.7} ${cy - radius * 0.5}`} stroke="#ef4444" strokeWidth={3} fill="none" />
      <path d={`M ${cx - radius * 0.66} ${cy + radius * 0.44} C ${cx - radius * 0.28} ${cy + radius * 0.84}, ${cx + radius * 0.24} ${cy + radius * 0.84}, ${cx + radius * 0.74} ${cy + radius * 0.4}`} stroke="#ef4444" strokeWidth={3} fill="none" />
    </>
  );
}

function useDraggableResizableWindow() {
  const [size, setSize] = useState(() => {
    const viewport = getViewport();
    return {
      width: clamp(PANEL_DEFAULT_WIDTH, PANEL_MIN_WIDTH, viewport.width - PANEL_PADDING * 2),
      height: clamp(PANEL_DEFAULT_HEIGHT, PANEL_MIN_HEIGHT, viewport.height - PANEL_PADDING * 2),
    };
  });
  const [position, setPosition] = useState(() => {
    const viewport = getViewport();
    const width = clamp(PANEL_DEFAULT_WIDTH, PANEL_MIN_WIDTH, viewport.width - PANEL_PADDING * 2);
    const height = clamp(PANEL_DEFAULT_HEIGHT, PANEL_MIN_HEIGHT, viewport.height - PANEL_PADDING * 2);
    return {
      x: clamp(viewport.width - width - 24, PANEL_PADDING, viewport.width - width - PANEL_PADDING),
      y: clamp(viewport.height - height - 24, PANEL_PADDING, viewport.height - height - PANEL_PADDING),
    };
  });
  const actionRef = useRef<{
    type: "drag" | "resize";
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const clampSize = useCallback((width: number, height: number) => {
    const viewport = getViewport();
    return {
      width: clamp(width, PANEL_MIN_WIDTH, Math.max(PANEL_MIN_WIDTH, viewport.width - PANEL_PADDING * 2)),
      height: clamp(height, PANEL_MIN_HEIGHT, Math.max(PANEL_MIN_HEIGHT, viewport.height - PANEL_PADDING * 2)),
    };
  }, []);

  const clampPosition = useCallback((x: number, y: number, panelSize = size) => {
    const viewport = getViewport();
    return {
      x: clamp(x, PANEL_PADDING, Math.max(PANEL_PADDING, viewport.width - panelSize.width - PANEL_PADDING)),
      y: clamp(y, PANEL_PADDING, Math.max(PANEL_PADDING, viewport.height - panelSize.height - PANEL_PADDING)),
    };
  }, [size]);

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    actionRef.current = {
      type: "drag",
      startX: event.clientX,
      startY: event.clientY,
      startPosX: position.x,
      startPosY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [position.x, position.y, size.height, size.width]);

  const beginResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    actionRef.current = {
      type: "resize",
      startX: event.clientX,
      startY: event.clientY,
      startPosX: position.x,
      startPosY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [position.x, position.y, size.height, size.width]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const action = actionRef.current;
      if (!action) return;
      if (action.type === "drag") {
        const nextX = action.startPosX + (event.clientX - action.startX);
        const nextY = action.startPosY + (event.clientY - action.startY);
        setPosition(clampPosition(nextX, nextY));
      } else {
        const proposedWidth = action.startWidth + (event.clientX - action.startX);
        const proposedHeight = action.startHeight + (event.clientY - action.startY);
        const nextSize = clampSize(proposedWidth, proposedHeight);
        setSize(nextSize);
        setPosition((prev) => clampPosition(prev.x, prev.y, nextSize));
      }
    };
    const onPointerUp = () => {
      actionRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [clampPosition, clampSize]);

  useEffect(() => {
    const onResize = () => {
      setSize((prev) => {
        const next = clampSize(prev.width, prev.height);
        setPosition((current) => clampPosition(current.x, current.y, next));
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition, clampSize]);

  return { position, size, beginDrag, beginResize };
}

export function PhysicsMicroscope({
  velocity,
  spinRPM,
  ballType,
  airDensity,
  magnusLiftN,
  velocityX,
  velocityY,
  dragX,
  dragY,
  magnusX,
  magnusY,
  gravityX,
  gravityY,
}: PhysicsMicroscopeProps) {
  const gradientsId = useId();
  const [rotationDeg, setRotationDeg] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [visibleVectors, setVisibleVectors] = useState<Record<VectorKey, boolean>>({
    velocity: true,
    drag: true,
    magnus: true,
    gravity: true,
  });
  const { position, size, beginDrag, beginResize } = useDraggableResizableWindow();

  const spinRad = (spinRPM * 2 * Math.PI) / 60;
  const ballRadiusMeters = useMemo(() => {
    switch (ballType) {
      case "baseball":
        return 0.037;
      case "pingPong":
        return 0.02;
      case "cannonball":
        return 0.09;
      default:
        return 0.037;
    }
  }, [ballType]);
  const speedSafe = Math.max(velocity, 0.2);
  const spinRatio = (spinRad * ballRadiusMeters) / speedSafe;

  useEffect(() => {
    if (Math.abs(spinRPM) < 0.01) return;
    let rafId = 0;
    let previousTime = performance.now();
    const step = (time: number) => {
      const dt = (time - previousTime) / 1000;
      previousTime = time;
      setRotationDeg((prev) => (prev + spinRPM * 6 * dt) % 360);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [spinRPM]);

  const panelHeight = expanded ? size.height : HEADER_HEIGHT + 2;
  const vizHeight = Math.max(140, panelHeight - HEADER_HEIGHT - DETAILS_HEIGHT);
  const svgWidth = size.width;
  const centerX = svgWidth * 0.5;
  const centerY = vizHeight * 0.52;
  const baseRadiusFactor: Record<MicroscopeBallType, number> = {
    baseball: 0.18,
    pingPong: 0.16,
    cannonball: 0.2,
    custom: 0.17,
  };
  const ballRadius = clamp(
    Math.min(svgWidth, vizHeight) * baseRadiusFactor[ballType],
    18,
    Math.min(svgWidth, vizHeight) * 0.26,
  );
  const densityRatio = clamp(airDensity / AIR_DENSITY_SEA_LEVEL, 0, 1);

  const flowVectorX = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 1 : velocityX;
  // Convert from physics Y-up vectors to SVG Y-down orientation.
  const flowVectorY = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 0 : -velocityY;
  const flowAngleDeg = (Math.atan2(flowVectorY, flowVectorX) * 180) / Math.PI;

  const streamlines = useMemo(() => {
    const lines: Array<{ id: string; main: string; wake: string; alpha: number }> = [];
    const count = clamp(Math.round(vizHeight / 18), 10, 18);
    const xMin = -svgWidth * 0.48;
    const xMax = svgWidth * 0.48;
    const frontX = -ballRadius * 1.1;
    const rearX = ballRadius * 1.05;
    const withFlowSide = spinRatio >= 0 ? -1 : 1; // backspin+: top, topspin-: bottom
    const againstFlowSide = -withFlowSide;
    const spinStrength = clamp(Math.abs(spinRatio) * 2.2, 0, 1.45);
    const flowStrength = clamp(Math.hypot(velocityX, velocityY) / 38, 0, 1.5);
    const ySpread = Math.max(100, vizHeight * 0.76);
    const sampleStep = Math.max(8, Math.round(svgWidth / 34));
    for (let i = 0; i < count; i++) {
      const yBase = ((i / (count - 1)) - 0.5) * ySpread;
      const sideSign = Math.sign(yBase === 0 ? withFlowSide : yBase);
      const absYNorm = clamp(Math.abs(yBase) / (ySpread * 0.55), 0, 1);
      const bandInfluence = Math.exp(-Math.pow(absYNorm * 1.5, 2));
      const withFlowBand = sideSign === withFlowSide ? 1 : 0;
      const againstFlowBand = sideSign === againstFlowSide ? 1 : 0;
      const mainPoints: Point[] = [];
      const wakePoints: Point[] = [];
      for (let x = xMin; x <= rearX; x += sampleStep) {
        const xNorm = x / (ballRadius * 2.1);
        const nearBall = Math.exp(-Math.pow(xNorm, 2));
        const frontInfluence = Math.exp(-Math.pow((x - frontX) / (ballRadius * 1.1), 2));
        const rearInfluence = Math.exp(-Math.pow((x - rearX) / (ballRadius * 1.3), 2));
        // Red stagnation region: streamlines split around the front hemisphere.
        const frontDivergence = sideSign * frontInfluence * (ballRadius * (0.24 + 0.24 * flowStrength));
        // Magnus asymmetry: with-flow side bunches, against-flow side spreads.
        const magnusCompression = withFlowBand * nearBall * (ballRadius * spinStrength * 0.28);
        const magnusExpansion = againstFlowBand * nearBall * (ballRadius * spinStrength * 0.3);
        // Spin drags nearby fluid around the with-flow side.
        const circulationDrag = withFlowSide * nearBall * bandInfluence * (ballRadius * spinStrength * 0.16);
        const rearConvergence = -sideSign * rearInfluence * (ballRadius * (0.1 + 0.16 * flowStrength));
        const y = yBase + frontDivergence - sideSign * magnusCompression + sideSign * magnusExpansion
          + circulationDrag + rearConvergence;
        mainPoints.push({ x: centerX + x, y: centerY + y });
      }
      for (let x = rearX; x <= xMax; x += sampleStep) {
        const wakeNorm = clamp((x - rearX) / Math.max(1, (xMax - rearX)), 0, 1);
        const wakeBlend = Math.exp(-wakeNorm * 2.1);
        const wakeConverge = -sideSign * wakeBlend * (ballRadius * (0.22 + 0.15 * flowStrength));
        const wakeWobble = Math.sin((x / (ballRadius * 0.9)) + i * 0.72) * (0.65 + flowStrength * 1.25)
          * wakeNorm * (0.6 + 0.8 * densityRatio);
        const sideBias = withFlowSide * spinStrength * wakeBlend * (ballRadius * 0.09);
        const y = yBase + wakeConverge + wakeWobble + sideBias;
        wakePoints.push({ x: centerX + x, y: centerY + y });
      }
      const alpha = clamp((0.38 + (1 - absYNorm) * 0.62) * densityRatio, 0.1, 1);
      lines.push({
        id: `line-${i}`,
        main: buildCubicBezierPath(mainPoints),
        wake: buildCubicBezierPath(wakePoints),
        alpha,
      });
    }
    return lines;
  }, [ballRadius, centerX, centerY, densityRatio, spinRatio, velocityX, velocityY, svgWidth, vizHeight]);

  const vectorMinLength = Math.max(16, Math.min(svgWidth, vizHeight) * 0.1);
  const vectorMaxLength = Math.min(svgWidth, vizHeight) * 0.34;
  const velocityVector = scaleVector(velocityX, -velocityY, 0.85, vectorMinLength, vectorMaxLength);
  const dragVector = scaleVector(dragX, -dragY, 28, vectorMinLength, vectorMaxLength);
  const magnusVector = scaleVector(magnusX, -magnusY, 28, vectorMinLength, vectorMaxLength);
  const gravityVector = scaleVector(gravityX, -gravityY, 28, vectorMinLength, vectorMaxLength);
  const velocityArrow = buildArrowPath(centerX, centerY, velocityVector.dx, velocityVector.dy);
  const dragArrow = buildArrowPath(centerX, centerY, dragVector.dx, dragVector.dy);
  const magnusArrow = buildArrowPath(centerX, centerY, magnusVector.dx, magnusVector.dy);
  const gravityArrow = buildArrowPath(centerX, centerY, gravityVector.dx, gravityVector.dy);

  const dragStrength = clamp((Math.hypot(velocityX, velocityY) / 45) * densityRatio, 0, 1);
  const magnusStrength = clamp(Math.abs(spinRatio) * 1.9 * densityRatio, 0, 1);
  const withFlowSide = spinRatio >= 0 ? -1 : 1;
  const againstFlowSide = -withFlowSide;
  const pressureFrontRedAlpha = clamp(0.06 + dragStrength * 0.12, 0.08, 0.18);
  const pressureWakeBlueAlpha = clamp(0.05 + dragStrength * 0.11, 0.07, 0.18);
  const pressureSpinRedAlpha = clamp(0.04 + magnusStrength * 0.12, 0.06, 0.18);
  const pressureSpinBlueAlpha = clamp(0.04 + magnusStrength * 0.12, 0.06, 0.18);
  const frontRedColor = `rgba(239,68,68,${pressureFrontRedAlpha.toFixed(3)})`;
  const wakeBlueColor = `rgba(59,130,246,${pressureWakeBlueAlpha.toFixed(3)})`;
  const spinRedColor = `rgba(239,68,68,${pressureSpinRedAlpha.toFixed(3)})`;
  const spinBlueColor = `rgba(59,130,246,${pressureSpinBlueAlpha.toFixed(3)})`;
  const ballFill = ballType === "cannonball" ? "#6b7280" : ballType === "pingPong" ? "#fde68a" : "#f8fafc";
  const displayedRotationDeg = Math.abs(spinRPM) < 0.01 ? 0 : rotationDeg;

  const toggleVector = (key: VectorKey) => {
    setVisibleVectors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: size.width,
        height: panelHeight,
        borderRadius: 16,
        background: "linear-gradient(165deg, rgba(15,23,42,0.46), rgba(30,41,59,0.36))",
        backdropFilter: "blur(14px) saturate(1.2)",
        border: "1px solid rgba(148,163,184,0.35)",
        boxShadow: "0 16px 36px rgba(2,6,23,0.35)",
        overflow: "hidden",
        zIndex: 20,
        userSelect: "none",
      }}
    >
      <div
        onPointerDown={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest("button")) {
            return;
          }
          beginDrag(event);
        }}
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0.65rem 0 0.7rem",
          borderBottom: "1px solid rgba(148,163,184,0.32)",
          cursor: "grab",
          background: "rgba(15,23,42,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} />
          <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.02em" }}>
            Physics Dashboard
          </span>
          <span style={{ color: "#cbd5e1", fontSize: "0.68rem" }}>{describeBall(ballType)}</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            border: "1px solid rgba(148,163,184,0.45)",
            background: "rgba(15,23,42,0.4)",
            color: "#e2e8f0",
            borderRadius: 6,
            fontSize: "0.68rem",
            padding: "0.15rem 0.42rem",
            cursor: "pointer",
          }}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {expanded && (
        <>
          <svg width="100%" height={vizHeight} viewBox={`0 0 ${svgWidth} ${vizHeight}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id={`${gradientsId}-front-red`} cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor={frontRedColor} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id={`${gradientsId}-wake-blue`} cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor={wakeBlueColor} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id={`${gradientsId}-spin-red`} cx="50%" cy="50%" r="58%">
                <stop offset="0%" stopColor={spinRedColor} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id={`${gradientsId}-spin-blue`} cx="50%" cy="50%" r="58%">
                <stop offset="0%" stopColor={spinBlueColor} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            <g transform={`rotate(${flowAngleDeg.toFixed(2)} ${centerX} ${centerY})`}>
              <ellipse cx={centerX - ballRadius * 1.08} cy={centerY} rx={ballRadius * 1.24} ry={ballRadius * 0.96} fill={`url(#${gradientsId}-front-red)`} />
              <ellipse cx={centerX + ballRadius * 1.34} cy={centerY} rx={ballRadius * 1.72} ry={ballRadius * 1.08} fill={`url(#${gradientsId}-wake-blue)`} />
              <ellipse cx={centerX - ballRadius * 0.24} cy={centerY + againstFlowSide * ballRadius * 0.72} rx={ballRadius * 1.14} ry={ballRadius * 0.88} fill={`url(#${gradientsId}-spin-red)`} />
              <ellipse cx={centerX + ballRadius * 0.34} cy={centerY + withFlowSide * ballRadius * 0.72} rx={ballRadius * 1.2} ry={ballRadius * 0.92} fill={`url(#${gradientsId}-spin-blue)`} />
              {streamlines.map((line) => (
                <g key={line.id}>
                  <path
                    d={line.main}
                    stroke={`rgba(186,230,253,${(0.9 * line.alpha).toFixed(3)})`}
                    strokeWidth={1.55}
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d={line.wake}
                    stroke={`rgba(186,230,253,${(0.58 * line.alpha).toFixed(3)})`}
                    strokeWidth={1.45}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="5 6"
                  />
                </g>
              ))}
            </g>

            <circle cx={centerX} cy={centerY} r={ballRadius} fill={ballFill} stroke="rgba(15,23,42,0.7)" strokeWidth={2} />
            <g transform={`rotate(${displayedRotationDeg.toFixed(2)} ${centerX} ${centerY})`}>
              <SeamTexture ballType={ballType} cx={centerX} cy={centerY} radius={ballRadius} />
            </g>
            <circle cx={centerX - ballRadius * 0.26} cy={centerY - ballRadius * 0.28} r={ballRadius * 0.2} fill="rgba(255,255,255,0.4)" />

            {visibleVectors.velocity && velocityArrow.length > 0 && (
              <path d={velocityArrow} stroke="#22c55e" strokeWidth={2.3} fill="none" strokeLinecap="round" />
            )}
            {visibleVectors.drag && dragArrow.length > 0 && (
              <path d={dragArrow} stroke="#ef4444" strokeWidth={2.3} fill="none" strokeLinecap="round" />
            )}
            {visibleVectors.magnus && magnusArrow.length > 0 && (
              <path d={magnusArrow} stroke="#a855f7" strokeWidth={2.3} fill="none" strokeLinecap="round" />
            )}
            {visibleVectors.gravity && gravityArrow.length > 0 && (
              <path d={gravityArrow} stroke="#3b82f6" strokeWidth={2.3} fill="none" strokeLinecap="round" />
            )}
          </svg>
          <div
            style={{
              height: DETAILS_HEIGHT,
              padding: "0.5rem 0.65rem 0.6rem",
              borderTop: "1px solid rgba(148,163,184,0.3)",
              color: "#e2e8f0",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.72rem",
              lineHeight: 1.35,
              background: "rgba(2,6,23,0.42)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.25rem 0.65rem",
              alignContent: "start",
            }}
          >
            <div style={{ gridColumn: "1 / span 2", fontWeight: 700, color: "#f8fafc", marginBottom: "0.15rem" }}>
              Vector Legend (click to toggle)
            </div>
            {VECTOR_META.map((meta) => (
              <button
                key={meta.key}
                type="button"
                onClick={() => toggleVector(meta.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  borderRadius: 6,
                  border: `1px solid ${visibleVectors[meta.key] ? meta.color : "rgba(148,163,184,0.35)"}`,
                  background: visibleVectors[meta.key] ? "rgba(15,23,42,0.45)" : "rgba(30,41,59,0.25)",
                  color: visibleVectors[meta.key] ? "#f8fafc" : "#94a3b8",
                  padding: "0.22rem 0.36rem",
                  fontSize: "0.69rem",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: meta.color, fontWeight: 800, fontSize: "0.9rem", lineHeight: 1 }}>➤</span>
                <span>{meta.label}</span>
              </button>
            ))}
            <div style={{ gridColumn: "1 / span 2", marginTop: "0.15rem", color: "#cbd5e1" }}>
              <div>Velocity: {velocity.toFixed(2)} m/s</div>
              <div>Magnus Lift: {magnusLiftN.toFixed(3)} N</div>
              <div>Spin Ratio (ωr/v): {spinRatio.toFixed(3)}</div>
              <div>Air Density: {airDensity.toFixed(3)} kg/m³</div>
            </div>
          </div>
          <button
            type="button"
            onPointerDown={beginResize}
            style={{
              position: "absolute",
              right: 4,
              bottom: 4,
              width: 24,
              height: 24,
              cursor: "nwse-resize",
              border: "1px solid rgba(148,163,184,0.55)",
              borderRadius: 6,
              background: "rgba(30,41,59,0.5)",
              color: "#cbd5e1",
              fontSize: "0.8rem",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3,
            }}
            aria-label="Resize physics dashboard"
            title="Drag to resize"
          >
            ↘
          </button>
        </>
      )}
    </div>
  );
}
