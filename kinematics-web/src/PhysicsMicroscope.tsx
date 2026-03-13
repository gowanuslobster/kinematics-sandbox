import { useCallback, useEffect, useMemo, useRef, useState, useId, type PointerEvent as ReactPointerEvent } from "react";
import { AIR_DENSITY_SEA_LEVEL } from "./physics";
import { scaleVector } from "./vectorUtils";

export type MicroscopeBallType = "baseball" | "pingPong" | "cannonball" | "custom";

export interface PhysicsMicroscopeProps {
  spinRPM: number;
  ballType: MicroscopeBallType;
  airDensity: number;
  velocityX: number;
  velocityY: number;
  dragX: number;
  dragY: number;
  magnusX: number;
  magnusY: number;
  gravityX: number;
  gravityY: number;
  mass: number;
}

type VectorKey = "velocity" | "drag" | "magnus" | "gravity";

const PANEL_MIN_WIDTH = 300;
const PANEL_MIN_HEIGHT = 320;
const PANEL_DEFAULT_WIDTH = 550;
const PANEL_DEFAULT_HEIGHT = 450;
const PANEL_PADDING = 10;
const PANEL_INITIAL_X_OFFSET = 28;
const PANEL_INITIAL_Y_OFFSET = 62;
const HEADER_HEIGHT = 38;
const DETAILS_HEIGHT = 132;

const VECTOR_META: Array<{ key: VectorKey; label: string; unit: string; color: string }> = [
  { key: "velocity", label: "Velocity", unit: "m/s", color: "#22c55e" },
  { key: "drag", label: "Drag", unit: "N", color: "#ef4444" },
  { key: "magnus", label: "Magnus", unit: "N", color: "#a855f7" },
  { key: "gravity", label: "Gravity", unit: "N", color: "#3b82f6" },
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

function rotateVector(x: number, y: number, angleRad: number): { x: number; y: number } {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  return {
    x: (x * cosA) - (y * sinA),
    y: (x * sinA) + (y * cosA),
  };
}

interface Point {
  x: number;
  y: number;
}

function buildSmoothPath(points: Point[]): string {
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
      x: clamp(viewport.width - width - PANEL_INITIAL_X_OFFSET, PANEL_PADDING, viewport.width - width - PANEL_PADDING),
      y: clamp(PANEL_INITIAL_Y_OFFSET, PANEL_PADDING, viewport.height - height - PANEL_PADDING),
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
  spinRPM,
  ballType,
  airDensity,
  velocityX,
  velocityY,
  dragX,
  dragY,
  magnusX,
  magnusY,
  gravityX,
  gravityY,
  mass,
}: PhysicsMicroscopeProps) {
  const gradientsId = useId();
  const [rotationDeg, setRotationDeg] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [keepStreamlinesHorizontal, setKeepStreamlinesHorizontal] = useState(true);
  const [visibleVectors, setVisibleVectors] = useState<Record<VectorKey, boolean>>({
    velocity: true,
    drag: true,
    magnus: true,
    gravity: true,
  });
  const { position, size, beginDrag, beginResize } = useDraggableResizableWindow();

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
  const detailsFontSizeRem = clamp(
    0.72 + ((size.width - PANEL_DEFAULT_WIDTH) / 1000) + ((size.height - PANEL_DEFAULT_HEIGHT) / 1400),
    0.72,
    0.82,
  );
  const legendItemFontSizeRem = clamp(
    0.69 + ((size.width - PANEL_DEFAULT_WIDTH) / 900) + ((size.height - PANEL_DEFAULT_HEIGHT) / 1300),
    0.69,
    0.8,
  );
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
  const streamlineAngleDeg = keepStreamlinesHorizontal ? 0 : flowAngleDeg;

const streamlines = useMemo(() => {
  const lines: Array<{ id: string; main: string; wake: string; alpha: number }> = [];
  
  // Dynamically calculate lines based on panel height (max ~18 total, so 9 per side)
  const totalCount = clamp(Math.round(vizHeight / 18), 10, 18);
  const halfCount = Math.floor(totalCount / 2);

  const xMin = -svgWidth * 0.48;
  const xMax = svgWidth * 0.48;

  // backspin+: top, topspin-: bottom
  const withFlowSide = spinRPM >= 0 ? -1 : 1; 

  // NEW: Add mass normalization for kinematic impact
  const BASEBALL_MASS = 0.145;
  const massFactor = BASEBALL_MASS / Math.max(mass, 0.001);

  // Get the EFFECTIVE force (Force / Mass ratio)
  const actualMagnusForce = Math.hypot(magnusX, magnusY);
  const effectiveMagnus = actualMagnusForce * massFactor;

  const spinStrength = clamp(effectiveMagnus * 0.35, 0, 1.4);
  const flowStrength = clamp(Math.hypot(velocityX, velocityY) / 38, 0, 1.5);
  const sampleStep = Math.max(8, Math.round(svgWidth / 36));
  
  // The standard gap between lines at the far right edge of the screen
  const baseSpacing = 22; 

  // Generate Top lines (side = -1) then Bottom lines (side = 1)
  for (const side of [-1, 1]) {
    const isSuctionSide = (side === withFlowSide);

    // 1. ANCHOR CLEARANCE: How closely the innermost line hugs the ball
    const baseClearance = 1.18;
    const suctionGap = Math.max(1.04, baseClearance - (spinStrength * 0.35));
    const pressureGap = baseClearance + (spinStrength * 0.50);
    const anchorClearance = ballRadius * (isSuctionSide ? suctionGap : pressureGap);

    // 2. LAYER SPACING: The gap between stacked lines at the ball's center.
    // Suction lines pack tightly together. Pressure lines spread far apart.
    const layerSpacing = isSuctionSide 
      ? Math.max(4, baseSpacing * (1 - spinStrength * 0.5)) 
      : baseSpacing * (1 + spinStrength * 0.9);

    // 3. BEND WIDTH: How far out in front of the ball the lines start to curve.
    // Suction side dives sharply. Pressure side bulges gently.
    const bendWidth = isSuctionSide 
      ? ballRadius * (1.8 - spinStrength * 0.35) 
      : ballRadius * (1.8 + spinStrength * 0.5);

    let previousTransitionY = 0; // Tracks the peak of the layer below it

    for (let layer = 0; layer < halfCount; layer++) {
      // yBase is where the line enters the screen at the far right edge
      // Layer 0 starts near center. Layer 1 starts baseSpacing pixels further out.
      const yBase = side * (layer === 0 ? 1 : layer * baseSpacing);
      
      // transitionY is the peak curve exactly above/below the center of the ball
      let transitionY: number;
      if (layer === 0) {
        transitionY = side * anchorClearance;
      } else {
        // Stack this line directly on top of the previous line's peak + the gap
        transitionY = previousTransitionY + (side * layerSpacing);
      }
      previousTransitionY = transitionY; // Save for the next loop iteration

      // Generate the smooth curve from entry edge to the center peak
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

      // Generate the wake curve and wobble
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

      // Calculate visual fade based on how far out the layer is
      const absYNorm = layer / 8; // Assuming 8 layers max eventually
      const alpha = clamp((0.36 + (1 - absYNorm) * 0.6) * densityRatio, 0.1, 1);
      
      lines.push({
        id: `line-${side > 0 ? 'bottom' : 'top'}-${layer}`,
        main: buildSmoothPath(entryPoints),
        wake: buildSmoothPath(wakePoints),
        alpha,
      });
    }
  }
  return lines;
}, [ballRadius, centerX, centerY, densityRatio, spinRPM, velocityX, velocityY, svgWidth, vizHeight, magnusX, magnusY, mass]);

  // Adjust the scaling factors based on mass. 
  // For a Ping Pong ball, this multiplier will be ~54x, 
  // making the arrows much more prominent.
  // Use actual projectile mass and normalize to baseball mass for standardization
  const BASEBALL_MASS = 0.145;
  const massFactor = BASEBALL_MASS / Math.max(mass, 0.001);
  const visualScale = 38 * massFactor;

  const vectorMinLength = 7;
  const vectorMaxLength = Math.min(svgWidth, vizHeight) * 0.4;
  const vectorFrameRotationRad = keepStreamlinesHorizontal ? -(flowAngleDeg * Math.PI / 180) : 0;
  const velocityDisplay = rotateVector(velocityX, -velocityY, vectorFrameRotationRad);
  const dragDisplay = rotateVector(dragX, -dragY, vectorFrameRotationRad);
  const magnusDisplay = rotateVector(magnusX, -magnusY, vectorFrameRotationRad);
  const gravityDisplay = rotateVector(gravityX, -gravityY, vectorFrameRotationRad);

  const velocityVector = scaleVector(velocityDisplay.x, velocityDisplay.y, 1.8, vectorMinLength, vectorMaxLength);
  const dragVector = scaleVector(dragDisplay.x, dragDisplay.y, visualScale, vectorMinLength, vectorMaxLength);
  const magnusVector = scaleVector(magnusDisplay.x, magnusDisplay.y, visualScale, vectorMinLength, vectorMaxLength);
  const gravityVector = scaleVector(gravityDisplay.x, gravityDisplay.y, visualScale, vectorMinLength, vectorMaxLength);
 
  const velocityArrow = buildArrowPath(centerX, centerY, velocityVector.dx, velocityVector.dy);
  const dragArrow = buildArrowPath(centerX, centerY, dragVector.dx, dragVector.dy);
  const magnusArrow = buildArrowPath(centerX, centerY, magnusVector.dx, magnusVector.dy);
  const gravityArrow = buildArrowPath(centerX, centerY, gravityVector.dx, gravityVector.dy);
  const vectorComponents: Record<VectorKey, { x: number; y: number }> = {
    velocity: { x: velocityX, y: velocityY },
    drag: { x: dragX, y: dragY },
    magnus: { x: magnusX, y: magnusY },
    gravity: { x: gravityX, y: gravityY },
  };

  // Effective Forces drive graphics, not real forces (how the ball "feels" the air)
  const effectiveDrag = Math.hypot(dragX, dragY) * massFactor;
  const effectiveMagnus = Math.hypot(magnusX, magnusY) * massFactor;

  //  Map effective forces to alpha (opacity). 
  // A typical 3N force maps to 0.75 opacity. 0N force = 0 opacity.
  const fadeResistance = 0.6;
  const dragAlpha = clamp(effectiveDrag / (effectiveDrag + fadeResistance), 0, 0.75);
  const magnusAlpha = clamp(effectiveMagnus / (effectiveMagnus + fadeResistance), 0, 0.75);

  //  Determine sides using spinRPM (same safe logic as streamlines)
  const withFlowSide = spinRPM >= 0 ? -1 : 1;
  const againstFlowSide = -withFlowSide;

  //  Apply the dynamic alphas
  const pressureFrontRedAlpha = dragAlpha;
  const pressureWakeBlueAlpha = dragAlpha * 0.8; // Wake is naturally a bit fainter
  const pressureSpinRedAlpha = magnusAlpha;
  const pressureSpinBlueAlpha = magnusAlpha;

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              color: "#cbd5e1",
              fontSize: "0.66rem",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={keepStreamlinesHorizontal}
              onChange={(event) => setKeepStreamlinesHorizontal(event.target.checked)}
              style={{ accentColor: "#22c55e", cursor: "pointer" }}
            />
            Keep velocity vector horizontal
          </label>
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
            <g transform={`rotate(${streamlineAngleDeg.toFixed(2)} ${centerX} ${centerY})`}>
              {/* WAKE: Left side (air exits here). Longer shape, low-pressure blue */}
              <ellipse cx={centerX - ballRadius * 1.6} cy={centerY} rx={ballRadius * 1.8} ry={ballRadius * 1.08} fill={`url(#${gradientsId}-wake-blue)`} />
              
              {/* FRONT: Right side (air crashes here). Tighter shape, high-pressure red */}
              <ellipse cx={centerX + ballRadius * 1.3} cy={centerY} rx={ballRadius * 1.4} ry={ballRadius * 0.96} fill={`url(#${gradientsId}-front-red)`} />              

              {/* SPIN: Center lines (red for backspin, blue for topspin). Tighter shape, high-pressure */}
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
                    stroke={`rgba(186,230,253,${(0.5 * line.alpha).toFixed(3)})`}
                    strokeWidth={1.45}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="7 6"
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
              fontSize: `${detailsFontSizeRem.toFixed(3)}rem`,
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
            {VECTOR_META.map((meta) => {
              const xComp = vectorComponents[meta.key].x;
              const yComp = vectorComponents[meta.key].y;
              const magnitude = Math.hypot(xComp, yComp);
              return (
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
                    fontSize: `${legendItemFontSizeRem.toFixed(3)}rem`,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ color: meta.color, fontWeight: 800, fontSize: "0.9rem", lineHeight: 1 }}>➤</span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25 }}>
                    <span>{meta.label} ({meta.unit}): [X: {xComp.toFixed(2)}, Y: {yComp.toFixed(2)}]</span>
                    <span style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "-1.24ch" }}>||</span>
                      <span>{meta.label}||: {magnitude.toFixed(2)} {meta.unit}</span>
                    </span>
                  </span>
                </button>
              );
            })}
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
