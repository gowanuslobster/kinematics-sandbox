import { useEffect, useMemo, useState, useId } from "react";
import { AIR_DENSITY_SEA_LEVEL } from "./physics";
import { useDraggableResizableWindow } from "./useDraggableResizableWindow";
import {
  buildStreamlines,
  clamp,
  describeBall,
  getMassNormalizationFactor,
  getVectorDisplayState,
} from "./physicsMicroscopeUtils";

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

const PANEL_DEFAULT_WIDTH = 550;
const PANEL_DEFAULT_HEIGHT = 450;
const HEADER_HEIGHT = 38;
const DETAILS_HEIGHT = 132;

const VECTOR_META: Array<{ key: VectorKey; label: string; unit: string; color: string }> = [
  { key: "velocity", label: "Velocity", unit: "m/s", color: "#22c55e" },
  { key: "drag", label: "Drag", unit: "N", color: "#ef4444" },
  { key: "magnus", label: "Magnus", unit: "N", color: "#a855f7" },
  { key: "gravity", label: "Gravity", unit: "N", color: "#3b82f6" },
];

/** Renders a ball-specific seam/surface texture so spin remains visually legible. */
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

/**
 * Floating teaching-oriented visualization that turns the current simulation
 * state into an airflow, spin, and force "microscope" layered over the chart.
 */
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
  // Local UI state for the floating panel and its interactive overlays.
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

  // Spin is rendered as a continuously rotating seam texture while the panel is open.
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

  // Panel and SVG layout geometry derived from the current panel size.
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
  // Normalize local air density against sea level so visual effects can scale
  // between "no atmosphere" and "full atmosphere" without changing the physics model.
  const densityRatio = clamp(airDensity / AIR_DENSITY_SEA_LEVEL, 0, 1);

  // Flow orientation is used both for streamline direction and vector display rotation.
  const flowVectorX = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 1 : velocityX;
  // Convert from physics Y-up vectors to SVG Y-down orientation.
  const flowVectorY = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 0 : -velocityY;
  const flowAngleDeg = (Math.atan2(flowVectorY, flowVectorX) * 180) / Math.PI;
  const streamlineAngleDeg = keepStreamlinesHorizontal ? 0 : flowAngleDeg;
  const massNormalizationFactor = getMassNormalizationFactor(mass);

  // Streamlines approximate how spin and forward motion reshape airflow around
  // the ball. These curves are intentionally visual heuristics, not a CFD solver:
  // they tighten on the suction side, spread on the pressure side, and add wake
  // wobble so the microscope conveys why Magnus lift appears.
  const streamlines = useMemo(() => {
    return buildStreamlines({
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
    });
  }, [
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
  ]);

  // Vector display state converts physical vectors into readable SVG arrows and highlight colors.
  const {
    velocityArrow,
    dragArrow,
    magnusArrow,
    gravityArrow,
    vectorComponents,
    frontRedColor,
    wakeBlueColor,
    spinRedColor,
    spinBlueColor,
    withFlowSide,
    againstFlowSide,
  } = useMemo(() => getVectorDisplayState({
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
  }), [
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
  ]);

  const ballFill = ballType === "cannonball" ? "#6b7280" : ballType === "pingPong" ? "#fde68a" : "#f8fafc";
  const displayedRotationDeg = Math.abs(spinRPM) < 0.01 ? 0 : rotationDeg;

  // Legend toggles control which vectors are overlaid on the microscope view.
  const toggleVector = (key: VectorKey) => {
    setVisibleVectors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    // Floating microscope panel positioned independently above the main chart.
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
      {/* Draggable header with panel title and quick microscope controls. */}
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
          {/* Main microscope visualization: pressure field, streamlines, ball, and vector arrows. */}
          <svg width="100%" height={vizHeight} viewBox={`0 0 ${svgWidth} ${vizHeight}`} preserveAspectRatio="xMidYMid meet">
            {/* SVG gradients define the soft pressure highlights layered under the streamlines. */}
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
            {/* Pressure-field highlights sit behind the streamlines and suggest
                where air compresses, separates, and shifts under spin. */}
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

            {/* Ball body and seam texture stay centered while the seam rotates to show spin. */}
            <circle cx={centerX} cy={centerY} r={ballRadius} fill={ballFill} stroke="rgba(15,23,42,0.7)" strokeWidth={2} />
            <g transform={`rotate(${displayedRotationDeg.toFixed(2)} ${centerX} ${centerY})`}>
              <SeamTexture ballType={ballType} cx={centerX} cy={centerY} radius={ballRadius} />
            </g>
            <circle cx={centerX - ballRadius * 0.26} cy={centerY - ballRadius * 0.28} r={ballRadius * 0.2} fill="rgba(255,255,255,0.4)" />

            {/* Optional vector overlays show the currently enabled force/velocity arrows. */}
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
          {/* Lower details panel lists vector components and toggles each overlay on/off. */}
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
              {/* Each legend row reports raw vector components/magnitude and doubles
                  as a visibility toggle for that vector overlay in the SVG. */}
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
          {/* Bottom-right resize handle for changing the microscope panel size. */}
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
