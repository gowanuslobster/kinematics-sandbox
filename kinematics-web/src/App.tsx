import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AIR_DENSITY_SEA_LEVEL,
  BALL_PRESETS,
  calculateTrajectory,
  type TrajectoryPoint,
} from "./physics";
import { PhysicsMicroscope, type MicroscopeBallType } from "./PhysicsMicroscope";
import { TrajectoryChart } from "./TrajectoryChart";

type Mode = "live" | "challenge";
type AnalysisSource = "none" | "manual" | "auto";

const ANIMATION_INTERVAL_MS = 16;
const ANIMATION_POINTS_PER_FRAME = 2;
const STATIC_POINT_DELTA_EPSILON = 1e-4;
const STATIC_FRAME_STREAK_TO_PAUSE = 6;
const STATIC_IDLE_MS = 300;

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
  const lastInteractionAtRef = useRef<number>(0);
  const staticFrameStreakRef = useRef<number>(0);
  const [mode, setMode] = useState<Mode>("live");
  const [initialVelocity, setInitialVelocity] = useState(50);
  const [velocityMax, setVelocityMax] = useState(100);
  const [launchAngle, setLaunchAngle] = useState(45);
  const [gravity, setGravity] = useState(9.81);
  const [gravityMax, setGravityMax] = useState(25);
  const [dragCoefficient, setDragCoefficient] = useState(0.5);
  const [dragMax, setDragMax] = useState(1);
  const [mass, setMass] = useState<number>(BALL_PRESETS.baseball.mass);
  const [radius, setRadius] = useState<number>(BALL_PRESETS.baseball.radius);
  const [selectedBallType, setSelectedBallType] = useState<MicroscopeBallType>("baseball");
  const [spinRpm, setSpinRpm] = useState(0);
  const [airDensity, setAirDensity] = useState(AIR_DENSITY_SEA_LEVEL);
  const [targetX, setTargetX] = useState(100);
  const [targetY, setTargetY] = useState(25);
  const [targetDiameter, setTargetDiameter] = useState(3);
  const [xAxisMax, setXAxisMax] = useState(120);
  const [yAxisMax, setYAxisMax] = useState(70);
  const [pinnedTrajectory, setPinnedTrajectory] = useState<{
    points: TrajectoryPoint[];
  } | null>(null);

  /** Challenge mode: shot data and how many points to show (animation). null = not fired yet. */
  const [challengeShot, setChallengeShot] = useState<{
    points: TrajectoryPoint[];
    hit: boolean;
    visibleCount: number;
  } | null>(null);
  const [activeAnalysisPoint, setActiveAnalysisPoint] = useState<TrajectoryPoint | null>(null);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>("none");
  const [isAutoScrubbing, setIsAutoScrubbing] = useState(false);
  const challengeShotRef = useRef<typeof challengeShot>(null);

  const targetRadius = targetDiameter / 2;

  const isChallenge = mode === "challenge";
  const isAnimating = isChallenge && challengeShot != null && challengeShot.visibleCount < challengeShot.points.length;
  const challengeComplete = isChallenge && challengeShot != null && challengeShot.visibleCount >= challengeShot.points.length;

  useEffect(() => {
    challengeShotRef.current = challengeShot;
  }, [challengeShot]);

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
      staticFrameStreakRef.current = 0;
    };
    markInteraction();
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("pointermove", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("touchstart", markInteraction, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("pointermove", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
    };
  }, []);

  useEffect(() => {
    if (!challengeShot || challengeShot.visibleCount >= challengeShot.points.length) return;
    let lastFrameTime: number | null = null;
    let frameId = 0;
    const tick = (timestamp: number) => {
      const currentShot = challengeShotRef.current;
      if (!currentShot || currentShot.visibleCount >= currentShot.points.length) {
        setIsAutoScrubbing(false);
        return;
      }
      if (lastFrameTime == null) {
        lastFrameTime = timestamp;
        frameId = requestAnimationFrame(tick);
        return;
      }
      if (timestamp - lastFrameTime < ANIMATION_INTERVAL_MS) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastFrameTime = timestamp;
      let nextVisibleCount = Math.min(
        currentShot.visibleCount + ANIMATION_POINTS_PER_FRAME,
        currentShot.points.length,
      );
      const prevPoint = currentShot.points[Math.max(0, currentShot.visibleCount - 1)];
      const nextPoint = currentShot.points[Math.max(0, nextVisibleCount - 1)];
      const pointDelta = prevPoint && nextPoint
        ? Math.hypot(nextPoint.x - prevPoint.x, nextPoint.y - prevPoint.y)
        : Number.POSITIVE_INFINITY;
      if (pointDelta <= STATIC_POINT_DELTA_EPSILON) {
        staticFrameStreakRef.current += 1;
      } else {
        staticFrameStreakRef.current = 0;
      }
      const idleForMs = Date.now() - lastInteractionAtRef.current;
      const shouldPauseLoop =
        idleForMs >= STATIC_IDLE_MS && staticFrameStreakRef.current >= STATIC_FRAME_STREAK_TO_PAUSE;
      if (shouldPauseLoop) {
        nextVisibleCount = currentShot.points.length;
      }
      const nextShot = {
        ...currentShot,
        visibleCount: nextVisibleCount,
      };
      challengeShotRef.current = nextShot;
      setChallengeShot(nextShot);
      if (nextVisibleCount > 0) {
        setActiveAnalysisPoint(nextShot.points[nextVisibleCount - 1] ?? null);
      }
      if (nextVisibleCount >= currentShot.points.length) {
        setIsAutoScrubbing(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [challengeShot]);

  const simulationResult = useMemo(() => {
    return calculateTrajectory({
      initialVelocity,
      launchAngleDeg: launchAngle,
      gravity,
      dragCoefficient,
      targetX,
      targetY,
      targetRadius,
      mass,
      radius,
      spinRpm,
      airDensity,
    });
  }, [
    initialVelocity,
    launchAngle,
    gravity,
    dragCoefficient,
    targetX,
    targetY,
    targetRadius,
    mass,
    radius,
    spinRpm,
    airDensity,
  ]);

  const { points, hit, vacuumPath, timeOfFlightVacuum, timeOfFlightActual, maxHeightVacuum, maxHeightActual, rangeVacuum, rangeActual } = simulationResult;

  const visiblePoints: TrajectoryPoint[] = useMemo(() => {
    if (mode === "live") return points;
    if (!challengeShot) return [];
    return challengeShot.points.slice(0, challengeShot.visibleCount);
  }, [mode, challengeShot, points]);

  const displayHit = mode === "live" ? hit : (challengeComplete && challengeShot ? challengeShot.hit : false);
  const launchAngleRad = (launchAngle * Math.PI) / 180;
  const defaultVelocityX = Math.max(initialVelocity, 0) * Math.cos(launchAngleRad);
  const defaultVelocityY = Math.max(initialVelocity, 0) * Math.sin(launchAngleRad);
  const microscopeVelocity = activeAnalysisPoint
    ? Math.hypot(activeAnalysisPoint.vx, activeAnalysisPoint.vy)
    : Math.max(initialVelocity, 0);

  const handleManualAnalysisPointChange = useCallback((point: TrajectoryPoint | null) => {
    if (isAutoScrubbing) return;
    if (analysisSource === "auto") {
      // After auto-scrub completes, keep final point until user deliberately hovers.
      if (point == null) return;
      setAnalysisSource("manual");
      setActiveAnalysisPoint(point);
      return;
    }
    if (point == null) {
      setAnalysisSource("none");
      setActiveAnalysisPoint(null);
      return;
    }
    setAnalysisSource("manual");
    setActiveAnalysisPoint(point);
  }, [analysisSource, isAutoScrubbing]);

  const handlePinCurrentTrajectory = () => {
    setPinnedTrajectory({
      points: [...points],
    });
  };

  const handleClearPinnedTrajectory = () => {
    setPinnedTrajectory(null);
  };

  const handleFire = () => {
    if (mode !== "challenge") return;
    staticFrameStreakRef.current = 0;
    lastInteractionAtRef.current = Date.now();
    const shot = {
      points: [...points],
      hit,
      visibleCount: 0,
    };
    setAnalysisSource("auto");
    setIsAutoScrubbing(true);
    setActiveAnalysisPoint(shot.points[0] ?? null);
    challengeShotRef.current = shot;
    setChallengeShot(shot);
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
          onClick={() => {
            setMode("live");
            staticFrameStreakRef.current = 0;
            setIsAutoScrubbing(false);
            setAnalysisSource("none");
            setActiveAnalysisPoint(null);
            setChallengeShot(null);
          }}
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
          onClick={() => {
            setMode("challenge");
            setAnalysisSource("none");
            setActiveAnalysisPoint(null);
          }}
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
        {mode === "live" && (
          <div style={sliderStyle}>
            <button
              type="button"
              onClick={handlePinCurrentTrajectory}
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              📌 Pin Current Trajectory
            </button>
            <button
              type="button"
              onClick={handleClearPinnedTrajectory}
              disabled={pinnedTrajectory == null}
              style={{
                padding: "0.35rem 0.75rem",
                fontSize: "0.75rem",
                fontWeight: 500,
                background: pinnedTrajectory == null ? "#d1d5db" : "#f3f4f6",
                color: pinnedTrajectory == null ? "#6b7280" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: pinnedTrajectory == null ? "not-allowed" : "pointer",
              }}
            >
              Clear pinned trajectory
            </button>
            {pinnedTrajectory != null && (
              <span style={{ ...valueStyle, fontSize: "0.7rem" }}>
                Pinned trajectory active
              </span>
            )}
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
          <span style={labelStyle}>Drag coefficient (C_d)</span>
          <span style={valueStyle}>{dragCoefficient.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.01, dragMax)}
            step={0.01}
            value={Math.min(dragCoefficient, Math.max(0.01, dragMax))}
            onChange={(e) => setDragCoefficient(Number(e.target.value))}
            style={inputStyle}
            aria-label="Drag coefficient dimensionless"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
            <label style={{ fontSize: "0.7rem", color: "#6b7280", marginRight: "4px", alignSelf: "center" }}>
              max:
            </label>
            <input
              type="number"
              min={0.01}
              max={2}
              step={0.01}
              value={dragMax}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n) && n >= 0.01 && n <= 2) {
                  setDragMax(n);
                  if (dragCoefficient > n) setDragCoefficient(n);
                }
              }}
              style={maxInputStyle}
              aria-label="Drag coefficient maximum"
            />
          </div>
          <span style={{ ...valueStyle, fontSize: "0.7rem" }}>Typical sphere ≈ 0.5</span>
        </div>
        <div
          style={{
            ...sliderStyle,
            marginRight: "0.75rem",
            marginLeft: "0.25rem",
          }}
        >
          <span style={labelStyle}>Ball preset</span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setMass(BALL_PRESETS.baseball.mass);
                setRadius(BALL_PRESETS.baseball.radius);
                setDragCoefficient(BALL_PRESETS.baseball.dragCoefficient);
                setSelectedBallType("baseball");
              }}
              style={{
                padding: "0.35rem 0.5rem",
                fontSize: "0.75rem",
                background: "#e5e7eb",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Baseball
            </button>
            <button
              type="button"
              onClick={() => {
                setMass(BALL_PRESETS.pingPong.mass);
                setRadius(BALL_PRESETS.pingPong.radius);
                setDragCoefficient(BALL_PRESETS.pingPong.dragCoefficient);
                setSelectedBallType("pingPong");
              }}
              style={{
                padding: "0.35rem 0.5rem",
                fontSize: "0.75rem",
                background: "#e5e7eb",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Ping pong
            </button>
            <button
              type="button"
              onClick={() => {
                setMass(BALL_PRESETS.cannonball.mass);
                setRadius(BALL_PRESETS.cannonball.radius);
                setDragCoefficient(BALL_PRESETS.cannonball.dragCoefficient);
                setSelectedBallType("cannonball");
              }}
              style={{
                padding: "0.35rem 0.5rem",
                fontSize: "0.75rem",
                background: "#e5e7eb",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cannonball
            </button>
          </div>
          <span style={{ ...valueStyle, fontSize: "0.7rem" }}>
            Selected: {selectedBallType === "pingPong" ? "Ping Pong" : selectedBallType[0].toUpperCase() + selectedBallType.slice(1)}
          </span>
        </div>
        <div
          style={{
            ...sliderStyle,
            marginRight: "0.75rem",
            marginLeft: "0.25rem",
          }}
        >
          <span style={labelStyle}>Mass (kg)</span>
          <input
            type="number"
            min={0.0001}
            step="any"
            value={mass}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n > 0) {
                setMass(n);
                setSelectedBallType("custom");
              }
            }}
            style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
            aria-label="Ball mass"
          />
        </div>
        <div
          style={{
            ...sliderStyle,
            marginRight: "0.75rem",
            marginLeft: "0.25rem",
          }}
        >
          <span style={labelStyle}>Radius (m)</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={radius}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n > 0) {
                setRadius(n);
                setSelectedBallType("custom");
              }
            }}
            style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
            aria-label="Ball radius"
          />
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Spin (RPM)</span>
          <span style={valueStyle}>{spinRpm} (backspin +)</span>
          <input
            type="range"
            min={-3000}
            max={3000}
            step={50}
            value={spinRpm}
            onChange={(e) => setSpinRpm(Number(e.target.value))}
            style={inputStyle}
            aria-label="Spin RPM"
          />
        </div>
        <div
          style={{
            ...sliderStyle,
            marginRight: "0.75rem",
            marginLeft: "0.25rem",
          }}
        >
          <span style={labelStyle}>Air density (kg/m³)</span>
          <input
            type="number"
            min={0}
            step="any"
            value={airDensity}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n >= 0) setAirDensity(n);
            }}
            style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
            aria-label="Air density"
          />
          <span style={{ ...valueStyle, fontSize: "0.7rem" }}>
            Sea level ≈ {AIR_DENSITY_SEA_LEVEL.toFixed(2)}; 0 = vacuum
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
            flex: 3,
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <TrajectoryChart
            points={visiblePoints}
            xRange={[0, xAxisMax]}
            yRange={[0, yAxisMax]}
            trajectoryColor={mode === "live" ? "#d97706" : "#0284c7"}
            targetX={targetX}
            targetY={targetY}
            targetSize={targetRadius}
            hit={displayHit}
            pinnedPath={mode === "live" ? (pinnedTrajectory?.points ?? undefined) : undefined}
            vacuumPath={mode === "live" ? (vacuumPath ?? undefined) : undefined}
            activeAnalysisPoint={activeAnalysisPoint}
            onHoverPointChange={handleManualAnalysisPointChange}
          />
          <PhysicsMicroscope
            mass={mass}
            velocity={microscopeVelocity}
            spinRPM={spinRpm}
            ballType={selectedBallType}
            airDensity={airDensity}
            velocityX={activeAnalysisPoint?.vx ?? defaultVelocityX}
            velocityY={activeAnalysisPoint?.vy ?? defaultVelocityY}
            dragX={activeAnalysisPoint?.dragX ?? 0}
            dragY={activeAnalysisPoint?.dragY ?? 0}
            magnusX={activeAnalysisPoint?.magnusX ?? 0}
            magnusY={activeAnalysisPoint?.magnusY ?? 0}
            gravityX={activeAnalysisPoint?.gravX ?? 0}
            gravityY={activeAnalysisPoint?.gravY ?? -(mass * gravity)}
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
