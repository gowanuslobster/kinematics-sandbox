import { useEffect, useMemo, useState } from "react";

export type MicroscopeBallType = "baseball" | "pingPong" | "cannonball" | "custom";

export interface PhysicsMicroscopeProps {
  velocity: number;
  spinRPM: number;
  ballType: MicroscopeBallType;
  airDensity: number;
  magnusLiftN: number;
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

  const streamlines = useMemo(() => {
    const lines: string[] = [];
    const count = 11;
    const left = 10;
    const right = VIEW_WIDTH - 10;
    const spinSign = Math.sign(spinRPM);
    const spinStrength = clamp(Math.abs(spinRatio) * 2.6, 0, 1.2);
    const yStart = 30;
    const yStep = 16;
    for (let i = 0; i < count; i++) {
      const y0 = yStart + i * yStep;
      const dy0 = y0 - BALL_CY;
      const dyNorm = clamp(dy0 / 70, -1, 1);
      const pathParts: string[] = [];
      for (let x = left; x <= right; x += 12) {
        const influenceX = Math.exp(-Math.pow((x - BALL_CX) / 72, 2));
        const distortionScale = clamp(1 + spinSign * dyNorm * spinStrength * 0.65, 0.25, 2.4);
        const yDistorted = BALL_CY + dy0 * distortionScale;
        const wakeWave = spinSign * spinStrength * influenceX * Math.sin((x - BALL_CX) / 22) * 2.2;
        const y = y0 * (1 - influenceX) + yDistorted * influenceX + wakeWave;
        pathParts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      lines.push(`M ${pathParts[0]} L ${pathParts.slice(1).join(" L ")}`);
    }
    return lines;
  }, [spinRPM, spinRatio]);

  const ballRadius = BALL_RADII[ballType];
  const topPressureColor = spinRPM >= 0 ? "rgba(59,130,246,0.35)" : "rgba(239,68,68,0.35)";
  const bottomPressureColor = spinRPM >= 0 ? "rgba(239,68,68,0.33)" : "rgba(59,130,246,0.35)";
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

        {streamlines.map((d, idx) => (
          <path
            key={`stream-${idx}`}
            d={d}
            stroke="rgba(186,230,253,0.85)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        <ellipse cx={BALL_CX} cy={BALL_CY - ballRadius * 0.65} rx={ballRadius * 1.45} ry={ballRadius * 0.92} fill="url(#pressureTop)" />
        <ellipse cx={BALL_CX} cy={BALL_CY + ballRadius * 0.68} rx={ballRadius * 1.45} ry={ballRadius * 0.92} fill="url(#pressureBottom)" />

        <circle cx={BALL_CX} cy={BALL_CY} r={ballRadius} fill={ballFill} stroke="rgba(15,23,42,0.7)" strokeWidth={2} />
        <g transform={`rotate(${displayedRotationDeg.toFixed(2)} ${BALL_CX} ${BALL_CY})`}>
          <SeamTexture ballType={ballType} />
        </g>
        <circle cx={BALL_CX - ballRadius * 0.26} cy={BALL_CY - ballRadius * 0.3} r={ballRadius * 0.2} fill="rgba(255,255,255,0.4)" />
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
