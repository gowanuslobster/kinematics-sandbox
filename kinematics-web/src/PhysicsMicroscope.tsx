import { useEffect, useMemo, useState } from "react";
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

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 220;
const BALL_CX = 166;
const BALL_CY = 112;

const BALL_RADII: Record<MicroscopeBallType, number> = {
  baseball: 36,
  pingPong: 30,
  cannonball: 42,
  custom: 34,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  const headLength = Math.max(5, length * 0.3);
  const headWidth = Math.max(3, length * 0.18);
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

function SeamTexture({ ballType }: { ballType: MicroscopeBallType }) {
  if (ballType === "cannonball") {
    return (
      <>
        <circle cx={BALL_CX - 10} cy={BALL_CY - 12} r={4} fill="#374151" />
        <circle cx={BALL_CX + 12} cy={BALL_CY - 8} r={3.5} fill="#4b5563" />
        <circle cx={BALL_CX - 6} cy={BALL_CY + 14} r={3.5} fill="#374151" />
        <circle cx={BALL_CX + 14} cy={BALL_CY + 12} r={4} fill="#4b5563" />
      </>
    );
  }
  if (ballType === "pingPong") {
    return (
      <>
        <path d={`M ${BALL_CX - 18} ${BALL_CY - 8} C ${BALL_CX - 4} ${BALL_CY - 2}, ${BALL_CX + 10} ${BALL_CY - 2}, ${BALL_CX + 22} ${BALL_CY - 8}`} stroke="#f8fafc" strokeWidth={2} fill="none" />
        <path d={`M ${BALL_CX - 18} ${BALL_CY + 8} C ${BALL_CX - 4} ${BALL_CY + 2}, ${BALL_CX + 10} ${BALL_CY + 2}, ${BALL_CX + 22} ${BALL_CY + 8}`} stroke="#e2e8f0" strokeWidth={2} fill="none" />
      </>
    );
  }
  return (
    <>
      <path d={`M ${BALL_CX - 26} ${BALL_CY - 16} C ${BALL_CX - 6} ${BALL_CY - 30}, ${BALL_CX + 10} ${BALL_CY - 30}, ${BALL_CX + 24} ${BALL_CY - 18}`} stroke="#ef4444" strokeWidth={3} fill="none" />
      <path d={`M ${BALL_CX - 24} ${BALL_CY + 16} C ${BALL_CX - 10} ${BALL_CY + 30}, ${BALL_CX + 8} ${BALL_CY + 30}, ${BALL_CX + 26} ${BALL_CY + 14}`} stroke="#ef4444" strokeWidth={3} fill="none" />
    </>
  );
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
  const [rotationDeg, setRotationDeg] = useState(0);
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
    if (Math.abs(spinRPM) < 0.01) {
      return;
    }
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
  const displayedRotationDeg = Math.abs(spinRPM) < 0.01 ? 0 : rotationDeg;

  const ballRadius = BALL_RADII[ballType];
  const densityRatio = clamp(airDensity / AIR_DENSITY_SEA_LEVEL, 0, 1);
  const flowVectorX = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 1 : velocityX;
  // SVG Y increases downward, so convert physics Y-up velocity to screen-space for angle.
  const flowVectorY = Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01 ? 0 : -velocityY;
  const flowAngleDeg = (Math.atan2(flowVectorY, flowVectorX) * 180) / Math.PI;
  const streamlines = useMemo(() => {
    const lines: string[] = [];
    const count = 12;
    const xMin = -148;
    const xMax = 148;
    const spinSign = Math.sign(spinRPM);
    const spinStrength = clamp(Math.abs(spinRatio) * 2.2, 0, 1.4);
    const flowStrength = clamp(Math.hypot(velocityX, velocityY) / 38, 0, 1.4);
    for (let i = 0; i < count; i++) {
      const y0 = ((i / (count - 1)) - 0.5) * 150;
      const ny = clamp(y0 / 75, -1, 1);
      const pathParts: string[] = [];
      for (let x = xMin; x <= xMax; x += 12) {
        const nx = x / (ballRadius * 2.4);
        const radialInfluence = Math.exp(-(nx * nx + ny * ny) * 1.15);
        const localInfluence = Math.exp(-Math.pow(x / (ballRadius * 2.1), 2));
        const deflectAroundBall =
          Math.sign(y0 === 0 ? 1 : y0) * radialInfluence * (ballRadius * (0.48 + flowStrength * 0.22));
        const wakeInfluence = x > 0
          ? Math.exp(-Math.pow((x - ballRadius * 0.6) / (ballRadius * 3.2), 2))
          : 0;
        const wakeCurl = wakeInfluence * Math.sin((x / (ballRadius * 0.95)) + i * 0.55) * (2.1 + flowStrength * 2.8);
        const magnusShift = spinSign * spinStrength * localInfluence * (-ny) * (ballRadius * 0.38);
        const y = y0 + deflectAroundBall + wakeCurl + magnusShift;
        pathParts.push(`${(BALL_CX + x).toFixed(1)},${(BALL_CY + y).toFixed(1)}`);
      }
      lines.push(`M ${pathParts[0]} L ${pathParts.slice(1).join(" L ")}`);
    }
    return lines;
  }, [ballRadius, spinRPM, spinRatio, velocityX, velocityY]);

  const vectorMinLength = 18;
  const vectorMaxLength = 76;
  const velocityVector = scaleVector(velocityX, -velocityY, 0.78, vectorMinLength, vectorMaxLength);
  const dragVector = scaleVector(dragX, -dragY, 28, vectorMinLength, vectorMaxLength);
  const magnusVector = scaleVector(magnusX, -magnusY, 28, vectorMinLength, vectorMaxLength);
  const gravityVector = scaleVector(gravityX, -gravityY, 28, vectorMinLength, vectorMaxLength);
  const velocityArrow = buildArrowPath(BALL_CX, BALL_CY, velocityVector.dx, velocityVector.dy);
  const dragArrow = buildArrowPath(BALL_CX, BALL_CY, dragVector.dx, dragVector.dy);
  const magnusArrow = buildArrowPath(BALL_CX, BALL_CY, magnusVector.dx, magnusVector.dy);
  const gravityArrow = buildArrowPath(BALL_CX, BALL_CY, gravityVector.dx, gravityVector.dy);
  const pressureStrength = densityRatio * clamp(Math.abs(spinRatio) * 2.4, 0.12, 1);
  const topPressureColor = Math.abs(spinRPM) < 0.5
    ? `rgba(125,211,252,${(0.22 * pressureStrength).toFixed(3)})`
    : spinRPM >= 0
      ? `rgba(59,130,246,${(0.42 * pressureStrength).toFixed(3)})`
      : `rgba(239,68,68,${(0.42 * pressureStrength).toFixed(3)})`;
  const bottomPressureColor = Math.abs(spinRPM) < 0.5
    ? `rgba(125,211,252,${(0.22 * pressureStrength).toFixed(3)})`
    : spinRPM >= 0
      ? `rgba(239,68,68,${(0.4 * pressureStrength).toFixed(3)})`
      : `rgba(59,130,246,${(0.42 * pressureStrength).toFixed(3)})`;
  const ballFill = ballType === "cannonball" ? "#6b7280" : ballType === "pingPong" ? "#fde68a" : "#f8fafc";

  return (
    <div
      style={{
        width: VIEW_WIDTH,
        borderRadius: 14,
        background: "linear-gradient(160deg, rgba(15,23,42,0.88), rgba(30,41,59,0.82))",
        backdropFilter: "blur(2px)",
        boxShadow: "0 10px 24px rgba(15,23,42,0.35)",
        border: "1px solid rgba(148,163,184,0.25)",
        overflow: "hidden",
      }}
    >
      <svg width={VIEW_WIDTH} height={VIEW_HEIGHT} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
        <defs>
          <radialGradient id="pressureTop" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={topPressureColor} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="pressureBottom" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={bottomPressureColor} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <g transform={`rotate(${flowAngleDeg.toFixed(2)} ${BALL_CX} ${BALL_CY})`}>
          {streamlines.map((d, idx) => (
            <path
              key={`stream-${idx}`}
              d={d}
              stroke={`rgba(186,230,253,${(0.9 * densityRatio).toFixed(3)})`}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>

        <ellipse cx={BALL_CX} cy={BALL_CY - ballRadius * 0.65} rx={ballRadius * 1.45} ry={ballRadius * 0.92} fill="url(#pressureTop)" />
        <ellipse cx={BALL_CX} cy={BALL_CY + ballRadius * 0.68} rx={ballRadius * 1.45} ry={ballRadius * 0.92} fill="url(#pressureBottom)" />

        <circle cx={BALL_CX} cy={BALL_CY} r={ballRadius} fill={ballFill} stroke="rgba(15,23,42,0.7)" strokeWidth={2} />
        <g transform={`rotate(${displayedRotationDeg.toFixed(2)} ${BALL_CX} ${BALL_CY})`}>
          <SeamTexture ballType={ballType} />
        </g>
        <circle cx={BALL_CX - ballRadius * 0.26} cy={BALL_CY - ballRadius * 0.3} r={ballRadius * 0.2} fill="rgba(255,255,255,0.4)" />
        {velocityArrow.length > 0 && (
          <path d={velocityArrow} stroke="#22c55e" strokeWidth={2} fill="none" strokeLinecap="round" />
        )}
        {dragArrow.length > 0 && (
          <path d={dragArrow} stroke="#ef4444" strokeWidth={2} fill="none" strokeLinecap="round" />
        )}
        {magnusArrow.length > 0 && (
          <path d={magnusArrow} stroke="#a855f7" strokeWidth={2} fill="none" strokeLinecap="round" />
        )}
        {gravityArrow.length > 0 && (
          <path d={gravityArrow} stroke="#3b82f6" strokeWidth={2} fill="none" strokeLinecap="round" />
        )}
      </svg>

      <div
        style={{
          padding: "0.45rem 0.65rem 0.55rem",
          borderTop: "1px solid rgba(148,163,184,0.25)",
          color: "#e2e8f0",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: "0.73rem",
          lineHeight: 1.4,
          background: "rgba(2,6,23,0.55)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "0.2rem", color: "#f8fafc" }}>
          Physics Microscope · {describeBall(ballType)}
        </div>
        <div>Velocity: {velocity.toFixed(2)} m/s</div>
        <div>Magnus Lift: {magnusLiftN.toFixed(3)} N</div>
        <div>Spin Ratio (ωr/v): {spinRatio.toFixed(3)}</div>
        <div>Air Density: {airDensity.toFixed(3)} kg/m³</div>
      </div>
    </div>
  );
}
