import { useMemo, useRef, useState } from "react";
import { TrajectoryChart } from "./TrajectoryChart";

const DT = 0.01;
const MAX_STEPS = 10_000;
const V_MIN = 1e-6;
const EARTH_DRAG = 0.0022;

interface Point {
  x: number;
  y: number;
}

/** Analytical vacuum trajectory: x = v0x*t, y = v0y*t - 0.5*g*t^2. Returns points until landing (y=0). */
function analyticalTrajectory(
  v0: number,
  angleDeg: number,
  g: number,
  numPoints = 200,
): Point[] {
  if (v0 <= 0 || g <= 0) return [{ x: 0, y: 0 }];
  const theta = (angleDeg * Math.PI) / 180;
  const v0x = v0 * Math.cos(theta);
  const v0y = v0 * Math.sin(theta);
  if (v0y <= 0) return [{ x: 0, y: 0 }];
  const tFlight = (2 * v0y) / g;
  const points: Point[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * tFlight;
    const x = v0x * t;
    const y = v0y * t - 0.5 * g * t * t;
    points.push({ x, y });
  }
  return points;
}

/** Symplectic Euler-Cromer with quadratic drag F_d = -cd * v * v_vector. Stops when y<0 (with interpolated landing) or v negligible. */
function trajectoryWithDrag(
  v0: number,
  angleDeg: number,
  g: number,
  cd: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
): { points: Point[]; hit: boolean } {
  const theta = (angleDeg * Math.PI) / 180;
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  let vx = v0 * Math.cos(theta);
  let vy = v0 * Math.sin(theta);

  for (let step = 0; step < MAX_STEPS; step++) {
    points.push({ x, y });

    if (Math.hypot(x - targetX, y - targetY) <= targetRadius) {
      return { points, hit: true };
    }

    const v = Math.hypot(vx, vy);
    if (v < V_MIN) break;

    const ax = -cd * v * vx;
    const ay = -g - cd * v * vy;

    vx += ax * DT;
    vy += ay * DT;
    const xNext = x + vx * DT;
    const yNext = y + vy * DT;

    if (yNext < 0) {
      const tFrac = -y / (yNext - y);
      const xLanding = x + (xNext - x) * tFrac;
      points.push({ x: xLanding, y: 0 });
      return { points, hit: false };
    }

    x = xNext;
    y = yNext;
  }
  return { points, hit: false };
}

function vacuumMetrics(v0: number, angleDeg: number, g: number) {
  if (g <= 0) return { timeOfFlight: 0, maxHeight: 0, range: 0 };
  const theta = (angleDeg * Math.PI) / 180;
  const v0x = v0 * Math.cos(theta);
  const v0y = v0 * Math.sin(theta);
  if (v0y <= 0) return { timeOfFlight: 0, maxHeight: 0, range: 0 };
  const timeOfFlight = (2 * v0y) / g;
  const maxHeight = (v0y * v0y) / (2 * g);
  const range = v0x * timeOfFlight;
  return { timeOfFlight, maxHeight, range };
}

const sliderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.25rem",
};

const labelStyle = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#374151",
};

const valueStyle = {
  fontSize: "0.75rem",
  color: "#6b7280",
};

const inputStyle = {
  width: "100%",
  accentColor: "#2563eb",
};

const maxInputStyle = {
  width: "3rem",
  padding: "2px 4px",
  fontSize: "0.7rem",
  border: "1px solid #d1d5db",
  borderRadius: 4,
} as const;

function App() {
  const [initialVelocity, setInitialVelocity] = useState(50);
  const [velocityMax, setVelocityMax] = useState(100);
  const [launchAngle, setLaunchAngle] = useState(45);
  const [gravity, setGravity] = useState(9.81);
  const [gravityMax, setGravityMax] = useState(25);
  const [dragCoefficient, setDragCoefficient] = useState(EARTH_DRAG);
  const [dragMax, setDragMax] = useState(EARTH_DRAG * 10);
  const [targetX, setTargetX] = useState(100);
  const [targetY, setTargetY] = useState(25);
  const [targetDiameter, setTargetDiameter] = useState(3);
  const [xAxisMax, setXAxisMax] = useState(100);
  const [yAxisMax, setYAxisMax] = useState(50);

  const targetRadius = targetDiameter / 2;

  const currentParams = useMemo(
    () =>
      [
        initialVelocity,
        launchAngle,
        gravity,
        dragCoefficient,
        targetX,
        targetY,
        targetDiameter,
      ].join(","),
    [
      initialVelocity,
      launchAngle,
      gravity,
      dragCoefficient,
      targetX,
      targetY,
      targetDiameter,
    ],
  );

  const { points, hit, vacuumPath, metrics } = useMemo(() => {
    const effectiveG = Math.max(gravity, 0.1);
    const vacuum = vacuumMetrics(initialVelocity, launchAngle, effectiveG);

    if (dragCoefficient === 0) {
      const pts = analyticalTrajectory(
        initialVelocity,
        launchAngle,
        effectiveG,
        300,
      );
      const hitCheck =
        pts.length > 0 &&
        pts.some(
          (p) => Math.hypot(p.x - targetX, p.y - targetY) <= targetRadius,
        );
      const rangeActual = pts.length > 0 ? pts[pts.length - 1].x : 0;
      return {
        points: pts,
        hit: hitCheck,
        vacuumPath: null as Point[] | null,
        metrics: {
          timeVacuum: vacuum.timeOfFlight,
          timeActual: vacuum.timeOfFlight,
          maxHeightVacuum: vacuum.maxHeight,
          maxHeightActual: vacuum.maxHeight,
          rangeVacuum: vacuum.range,
          rangeActual,
        },
      };
    }

    const { points: pts, hit: hitResult } = trajectoryWithDrag(
      initialVelocity,
      launchAngle,
      effectiveG,
      dragCoefficient,
      targetX,
      targetY,
      targetRadius,
    );
    const vacuumPts = analyticalTrajectory(
      initialVelocity,
      launchAngle,
      effectiveG,
      300,
    );
    const timeActual = (pts.length - 1) * DT;
    const rangeActual = pts.length > 0 ? pts[pts.length - 1].x : 0;
    const maxHeightActual = Math.max(0, ...pts.map((p) => p.y));

    return {
      points: pts,
      hit: hitResult,
      vacuumPath: vacuumPts,
      metrics: {
        timeVacuum: vacuum.timeOfFlight,
        timeActual,
        maxHeightVacuum: vacuum.maxHeight,
        maxHeightActual,
        rangeVacuum: vacuum.range,
        rangeActual,
      },
    };
  }, [
    initialVelocity,
    launchAngle,
    gravity,
    dragCoefficient,
    targetX,
    targetY,
    targetRadius,
  ]);

  const prevRef = useRef<{ params: string; points: Point[] } | null>(null);
  const ghostPath =
    prevRef.current && prevRef.current.params !== currentParams
      ? prevRef.current.points
      : null;
  if (prevRef.current?.params !== currentParams) {
    prevRef.current = { params: currentParams, points: [...points] };
  }

  const hitHint = useMemo(() => {
    if (hit || points.length === 0) return null;
    const landingX = points[points.length - 1].x;
    let closestDist = Infinity;
    let closestY = 0;
    for (const p of points) {
      const d = Math.hypot(p.x - targetX, p.y - targetY);
      if (d < closestDist) {
        closestDist = d;
        closestY = p.y;
      }
    }
    if (landingX < targetX) return "Too short — projectile lands before the target. Try increasing velocity or angle.";
    if (landingX > targetX) return "Too far — projectile overshoots. Try decreasing velocity or angle.";
    if (closestY < targetY) return "Too low — trajectory passes below the target. Try increasing launch angle.";
    return "Too high — trajectory passes above the target. Try decreasing launch angle.";
  }, [hit, points, targetX, targetY]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100vw",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          flexShrink: 0,
          width: 240,
          padding: "1.25rem 1rem",
          background: "#f9fafb",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          overflowY: "auto",
        }}
      >
        <div style={sliderStyle}>
          <span style={labelStyle}>Initial Velocity</span>
          <span style={valueStyle}>{initialVelocity} m/s</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, velocityMax)}
            value={Math.min(initialVelocity, Math.max(1, velocityMax))}
            onChange={(e) => setInitialVelocity(Number(e.target.value))}
            style={inputStyle}
            aria-label="Initial velocity in meters per second"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
            <label style={{ fontSize: "0.7rem", color: "#6b7280", marginRight: "4px", alignSelf: "center" }}>
              max:
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={velocityMax}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 1) {
                  setVelocityMax(n);
                  if (initialVelocity > n) setInitialVelocity(n);
                }
              }}
              style={maxInputStyle}
              aria-label="Velocity slider maximum"
            />
          </div>
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Launch Angle</span>
          <span style={valueStyle}>{launchAngle}°</span>
          <input
            type="range"
            min={0}
            max={90}
            value={launchAngle}
            onChange={(e) => setLaunchAngle(Number(e.target.value))}
            style={inputStyle}
            aria-label="Launch angle in degrees"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
            <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>max: 90°</span>
          </div>
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Gravity</span>
          <span style={valueStyle}>{gravity} m/s²</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, gravityMax)}
            step={0.1}
            value={Math.min(gravity, Math.max(0.1, gravityMax))}
            onChange={(e) => setGravity(Number(e.target.value))}
            style={inputStyle}
            aria-label="Gravity in m/s²"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
            <label style={{ fontSize: "0.7rem", color: "#6b7280", marginRight: "4px", alignSelf: "center" }}>
              max:
            </label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={gravityMax}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 0.1) {
                  setGravityMax(n);
                  if (gravity > n) setGravity(n);
                }
              }}
              style={maxInputStyle}
              aria-label="Gravity slider maximum"
            />
          </div>
          <span style={{ ...valueStyle, fontSize: "0.7rem" }}>
            Moon 1.62 · Mars 3.7 · Earth 9.81 · Saturn 10.4 · Jupiter 24.8 m/s²
          </span>
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Air Resistance (C_d)</span>
          <span style={valueStyle}>{dragCoefficient.toFixed(4)} kg/m</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.0001, dragMax)}
            step={0.0001}
            value={Math.min(dragCoefficient, Math.max(0.0001, dragMax))}
            onChange={(e) => setDragCoefficient(Number(e.target.value))}
            style={inputStyle}
            aria-label="Drag coefficient"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
            <label style={{ fontSize: "0.7rem", color: "#6b7280", marginRight: "4px", alignSelf: "center" }}>
              max:
            </label>
            <input
              type="number"
              min={0.0001}
              step={0.0001}
              value={dragMax}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 0.0001) {
                  setDragMax(n);
                  if (dragCoefficient > n) setDragCoefficient(n);
                }
              }}
              style={{ ...maxInputStyle, width: "3.5rem" }}
              aria-label="Air resistance slider maximum"
            />
          </div>
          <span style={{ ...valueStyle, fontSize: "0.7rem" }}>
            Moon 0 · Mars 0.00004 · Jupiter 0.0003 · Saturn 0.0004 · Earth {EARTH_DRAG.toFixed(4)} kg/m
          </span>
        </div>
        <div
          style={{
            ...sliderStyle,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: "0.5rem",
            marginRight: "0.75rem",
            marginLeft: "0.25rem",
          }}
        >
          <div style={{ ...sliderStyle, flex: 1, minWidth: 0 }}>
            <span style={labelStyle}>Target X</span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={targetX}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n > 0) setTargetX(n);
              }}
              style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
              aria-label="Target X position"
            />
          </div>
          <div style={{ ...sliderStyle, flex: 1, minWidth: 0 }}>
            <span style={labelStyle}>Target Y</span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={targetY}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n > 0) setTargetY(n);
              }}
              style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
              aria-label="Target Y position"
            />
          </div>
        </div>
        <div
          style={{
            ...sliderStyle,
            marginRight: "0.75rem",
            marginLeft: "0.25rem",
          }}
        >
          <span style={labelStyle}>Target diameter</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={targetDiameter}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n > 0) setTargetDiameter(n);
            }}
            style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
            aria-label="Target diameter"
          />
        </div>
        <div
          style={{
            ...sliderStyle,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: "0.75rem",
            marginTop: "0.5rem",
            marginRight: "0.75rem",
            marginBottom: "0.25rem",
            marginLeft: "0.25rem",
          }}
        >
          <div style={{ ...sliderStyle, flex: 1, minWidth: 0 }}>
            <span style={labelStyle}>X-axis max</span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={xAxisMax}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n > 0) setXAxisMax(n);
              }}
              style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
              aria-label="X-axis maximum"
            />
          </div>
          <div style={{ ...sliderStyle, flex: 1, minWidth: 0 }}>
            <span style={labelStyle}>Y-axis max</span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={yAxisMax}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n > 0) setYAxisMax(n);
              }}
              style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
              aria-label="Y-axis maximum"
            />
          </div>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          background: "#fff",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 4,
            minHeight: 320,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <TrajectoryChart
            points={points}
            xRange={[0, xAxisMax]}
            yRange={[0, yAxisMax]}
            targetX={targetX}
            targetY={targetY}
            targetSize={targetRadius}
            hit={hit}
            ghostPath={ghostPath ?? undefined}
            vacuumPath={vacuumPath ?? undefined}
          />
        </div>
        <div
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            borderTop: "1px solid #e5e7eb",
            minHeight: 0,
          }}
        >
          {hit ? (
            <div style={{ color: "#16a34a", fontWeight: 600 }}>🎯 Target hit!</div>
          ) : hitHint ? (
            <div style={{ color: "#b45309", fontSize: "0.875rem" }}>💡 {hitHint}</div>
          ) : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              marginTop: "0.5rem",
              fontSize: "0.8125rem",
            }}
          >
            {dragCoefficient > 0 ? (
              <>
                <span>
                  <strong>Time of flight:</strong> {metrics.timeActual.toFixed(2)} s
                  <span style={{ color: "#6b7280" }}>
                    {" "}(vacuum: {metrics.timeVacuum.toFixed(2)} s)
                  </span>
                </span>
                <span>
                  <strong>Max height:</strong> {metrics.maxHeightActual.toFixed(2)} m
                  <span style={{ color: "#6b7280" }}>
                    {" "}(vacuum: {metrics.maxHeightVacuum.toFixed(2)} m)
                  </span>
                </span>
                <span>
                  <strong>Range:</strong> {metrics.rangeActual.toFixed(2)} m
                  <span style={{ color: "#6b7280" }}>
                    {" "}(vacuum: {metrics.rangeVacuum.toFixed(2)} m)
                  </span>
                </span>
              </>
            ) : (
              <>
                <span>
                  <strong>Time of flight:</strong> {metrics.timeVacuum.toFixed(2)} s
                </span>
                <span>
                  <strong>Max height:</strong> {metrics.maxHeightVacuum.toFixed(2)} m
                </span>
                <span>
                  <strong>Range:</strong> {metrics.rangeVacuum.toFixed(2)} m
                </span>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
