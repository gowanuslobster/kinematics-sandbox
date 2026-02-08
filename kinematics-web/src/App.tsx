import { useEffect, useMemo, useRef, useState } from "react";
import { calculateTrajectory, EARTH_DRAG, type TrajectoryPoint } from "./physics";
import { TrajectoryChart } from "./TrajectoryChart";

type Mode = "live" | "challenge";

const ANIMATION_INTERVAL_MS = 16;
const ANIMATION_POINTS_PER_FRAME = 2;

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
  const [mode, setMode] = useState<Mode>("live");
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

  /** Challenge mode: shot data and how many points to show (animation). null = not fired yet. */
  const [challengeShot, setChallengeShot] = useState<{
    points: TrajectoryPoint[];
    hit: boolean;
    visibleCount: number;
  } | null>(null);

  const targetRadius = targetDiameter / 2;

  const isChallenge = mode === "challenge";
  const isAnimating = isChallenge && challengeShot != null && challengeShot.visibleCount < challengeShot.points.length;
  const challengeComplete = isChallenge && challengeShot != null && challengeShot.visibleCount >= challengeShot.points.length;

  useEffect(() => {
    if (!isChallenge) setChallengeShot(null);
  }, [isChallenge]);

  useEffect(() => {
    if (!challengeShot || challengeShot.visibleCount >= challengeShot.points.length) return;
    const id = setInterval(() => {
      setChallengeShot((prev) => {
        if (!prev || prev.visibleCount >= prev.points.length) return prev;
        return {
          ...prev,
          visibleCount: Math.min(prev.visibleCount + ANIMATION_POINTS_PER_FRAME, prev.points.length),
        };
      });
    }, ANIMATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [challengeShot?.visibleCount, challengeShot?.points.length]);

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

  const simulationResult = useMemo(() => {
    return calculateTrajectory({
      initialVelocity,
      launchAngleDeg: launchAngle,
      gravity,
      dragCoefficient,
      targetX,
      targetY,
      targetRadius,
    });
  }, [
    initialVelocity,
    launchAngle,
    gravity,
    dragCoefficient,
    targetX,
    targetY,
    targetRadius,
  ]);

  const { points, hit, vacuumPath, timeOfFlightVacuum, timeOfFlightActual, maxHeightVacuum, maxHeightActual, rangeVacuum, rangeActual } = simulationResult;

  const visiblePoints: TrajectoryPoint[] = useMemo(() => {
    if (mode === "live") return points;
    if (!challengeShot) return [];
    return challengeShot.points.slice(0, challengeShot.visibleCount);
  }, [mode, challengeShot, points]);

  const displayHit = mode === "live" ? hit : (challengeComplete && challengeShot ? challengeShot.hit : false);

  const prevRef = useRef<{ params: string; points: TrajectoryPoint[] } | null>(null);
  const ghostPath =
    prevRef.current && prevRef.current.params !== currentParams
      ? prevRef.current.points
      : null;
  if (prevRef.current?.params !== currentParams) {
    prevRef.current = { params: currentParams, points: [...points] };
  }

  const handleFire = () => {
    if (mode !== "challenge") return;
    setChallengeShot({
      points: [...points],
      hit,
      visibleCount: 0,
    });
  };

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
        flexDirection: "column",
        width: "100vw",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          background: "#e5e7eb",
          borderBottom: "1px solid #d1d5db",
        }}
      >
        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Mode:</span>
        <button
          type="button"
          onClick={() => setMode("live")}
          style={{
            padding: "0.35rem 0.75rem",
            fontSize: "0.8125rem",
            fontWeight: mode === "live" ? 600 : 400,
            background: mode === "live" ? "#2563eb" : "#f3f4f6",
            color: mode === "live" ? "#fff" : "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Live Mode
        </button>
        <button
          type="button"
          onClick={() => setMode("challenge")}
          style={{
            padding: "0.35rem 0.75rem",
            fontSize: "0.8125rem",
            fontWeight: mode === "challenge" ? 600 : 400,
            background: mode === "challenge" ? "#2563eb" : "#f3f4f6",
            color: mode === "challenge" ? "#fff" : "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Challenge Mode
        </button>
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
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
          {isChallenge && (
            <div style={sliderStyle}>
              <button
                type="button"
                onClick={handleFire}
                disabled={isAnimating}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  background: isAnimating ? "#9ca3af" : "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: isAnimating ? "not-allowed" : "pointer",
                }}
              >
                {isAnimating ? "Firing…" : "Fire!"}
              </button>
            </div>
          )}
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
            points={visiblePoints}
            xRange={[0, xAxisMax]}
            yRange={[0, yAxisMax]}
            targetX={targetX}
            targetY={targetY}
            targetSize={targetRadius}
            hit={displayHit}
            ghostPath={mode === "live" ? (ghostPath ?? undefined) : undefined}
            vacuumPath={mode === "live" ? (vacuumPath ?? undefined) : undefined}
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
          {mode === "live" && (
            <>
              {hit ? (
                <div style={{ color: "#16a34a", fontWeight: 600 }}>🎯 Target hit!</div>
              ) : hitHint ? (
                <div style={{ color: "#b45309", fontSize: "0.875rem" }}>💡 {hitHint}</div>
              ) : null}
            </>
          )}
          {mode === "challenge" && !challengeShot && (
            <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>Adjust parameters and press Fire!</div>
          )}
          {mode === "challenge" && isAnimating && (
            <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>Firing…</div>
          )}
          {mode === "challenge" && challengeComplete && challengeShot && (
            <div style={{ color: challengeShot.hit ? "#16a34a" : "#dc2626", fontWeight: 600, fontSize: "1rem" }}>
              {challengeShot.hit ? "🎯 Hit!" : "Miss"}
            </div>
          )}
          {mode === "live" && (
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
                  <strong>Time of flight:</strong> {timeOfFlightActual.toFixed(2)} s
                  <span style={{ color: "#6b7280" }}>
                    {" "}(vacuum: {timeOfFlightVacuum.toFixed(2)} s)
                  </span>
                </span>
                <span>
                  <strong>Max height:</strong> {maxHeightActual.toFixed(2)} m
                  <span style={{ color: "#6b7280" }}>
                    {" "}(vacuum: {maxHeightVacuum.toFixed(2)} m)
                  </span>
                </span>
                <span>
                  <strong>Range:</strong> {rangeActual.toFixed(2)} m
                  <span style={{ color: "#6b7280" }}>
                    {" "}(vacuum: {rangeVacuum.toFixed(2)} m)
                  </span>
                </span>
              </>
            ) : (
              <>
                <span>
                  <strong>Time of flight:</strong> {timeOfFlightVacuum.toFixed(2)} s
                </span>
                <span>
                  <strong>Max height:</strong> {maxHeightVacuum.toFixed(2)} m
                </span>
                <span>
                  <strong>Range:</strong> {rangeVacuum.toFixed(2)} m
                </span>
              </>
            )}
          </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

export default App;
