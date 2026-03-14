import { useMemo, useState } from "react";
import { calculateTrajectory, type TrajectoryPoint } from "./physics";
import { PhysicsMicroscope } from "./PhysicsMicroscope";
import { TrajectoryChart } from "./TrajectoryChart";
import { AppSidebar } from "./AppSidebar";
import { useChallengePlayback } from "./useChallengePlayback";
import { useSimulationControls } from "./useSimulationControls";

type Mode = "live" | "challenge";

/**
 * Converts a miss into a simple coaching hint by comparing the trajectory's
 * landing point and nearest approach against the target location.
 */
function getHitHint(
  hit: boolean,
  points: TrajectoryPoint[],
  targetX: number,
  targetY: number,
): string | null {
  if (hit || points.length === 0) return null;

  const landingX = points[points.length - 1].x;
  let closestDist = Infinity;
  let closestY = 0;

  for (const point of points) {
    const distance = Math.hypot(point.x - targetX, point.y - targetY);
    if (distance < closestDist) {
      closestDist = distance;
      closestY = point.y;
    }
  }

  if (landingX < targetX) {
    return "Too short — projectile lands before the target. Try increasing velocity or angle.";
  }
  if (landingX > targetX) {
    return "Too far — projectile overshoots. Try decreasing velocity or angle.";
  }
  if (closestY < targetY) {
    return "Too low — trajectory passes below the target. Try increasing launch angle.";
  }
  return "Too high — trajectory passes above the target. Try decreasing launch angle.";
}

/** Small shared button for the live/challenge mode toggle strip. */
function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0.35rem 0.75rem",
        fontSize: "0.8125rem",
        fontWeight: active ? 600 : 400,
        background: active ? "#2563eb" : "#f3f4f6",
        color: active ? "#fff" : "#374151",
        border: "1px solid #d1d5db",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Top-level app orchestration component.
 * Owns the current mode and pinned trajectory, derives the active simulation
 * result from control state, and composes the sidebar, chart, microscope, and
 * challenge playback behavior into a single screen.
 */
function App() {
  // UI-only state that does not belong to simulation input or playback hooks.
  const [mode, setMode] = useState<Mode>("live");
  const [pinnedTrajectory, setPinnedTrajectory] = useState<{
    points: TrajectoryPoint[];
  } | null>(null);

  // User-adjustable simulation controls and the small derived values they expose.
  const { values, derived, actions } = useSimulationControls();

  // Build the physics engine input from the current sidebar control state.
  const simulationParams = useMemo(() => ({
    initialVelocity: values.initialVelocity,
    launchAngleDeg: values.launchAngle,
    gravity: values.gravity,
    dragCoefficient: values.dragCoefficient,
    targetX: values.targetX,
    targetY: values.targetY,
    targetRadius: derived.targetRadius,
    mass: values.mass,
    radius: values.radius,
    spinRpm: values.spinRpm,
    airDensity: values.airDensity,
  }), [
    derived.targetRadius,
    values.airDensity,
    values.dragCoefficient,
    values.gravity,
    values.initialVelocity,
    values.launchAngle,
    values.mass,
    values.radius,
    values.spinRpm,
    values.targetX,
    values.targetY,
  ]);

  // Run the current simulation and unpack the metrics used across the UI.
  const simulationResult = useMemo(() => calculateTrajectory(simulationParams), [simulationParams]);
  const {
    points,
    hit,
    vacuumPath,
    timeOfFlightVacuum,
    timeOfFlightActual,
    maxHeightVacuum,
    maxHeightActual,
    rangeVacuum,
    rangeActual,
  } = simulationResult;

  // Challenge playback derives visible points and analysis state from the latest trajectory.
  const {
    activeAnalysisPoint,
    challengeComplete,
    challengeShot,
    displayHit,
    isAnimating,
    visiblePoints,
    fire,
    handleManualAnalysisPointChange,
    resetForChallengeMode,
    resetForLiveMode,
  } = useChallengePlayback(mode, points, hit);

  // Default launch vector shown before the user scrubs onto a specific trajectory point.
  const launchAngleRad = (values.launchAngle * Math.PI) / 180;
  const defaultVelocityX = Math.max(values.initialVelocity, 0) * Math.cos(launchAngleRad);
  const defaultVelocityY = Math.max(values.initialVelocity, 0) * Math.sin(launchAngleRad);

  const hitHint = useMemo(
    () => getHitHint(hit, points, values.targetX, values.targetY),
    [hit, points, values.targetX, values.targetY],
  );

  // Snapshot the current live trajectory so it can stay visible while controls change.
  const handlePinCurrentTrajectory = () => {
    setPinnedTrajectory({ points: [...points] });
  };

  // Remove the saved live-trajectory overlay from the chart.
  const handleClearPinnedTrajectory = () => {
    setPinnedTrajectory(null);
  };

  // Switching back to live mode clears any in-progress challenge playback state.
  const enterLiveMode = () => {
    setMode("live");
    resetForLiveMode();
  };

  // Challenge mode keeps the latest controls but resets hover/analysis state.
  const enterChallengeMode = () => {
    setMode("challenge");
    resetForChallengeMode();
  };

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
      {/* Top bar for switching between the always-live simulation and challenge playback. */}
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
        <ModeButton active={mode === "live"} label="Live Mode" onClick={enterLiveMode} />
        <ModeButton active={mode === "challenge"} label="Challenge Mode" onClick={enterChallengeMode} />
      </div>

      {/* Main application split: controls on the left, visualization and status on the right. */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <AppSidebar
          mode={mode}
          isAnimating={isAnimating}
          pinnedTrajectoryActive={pinnedTrajectory != null}
          values={values}
          derived={derived}
          actions={actions}
          onFire={fire}
          onPinCurrentTrajectory={handlePinCurrentTrajectory}
          onClearPinnedTrajectory={handleClearPinnedTrajectory}
        />

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
          {/* Primary visualization area combining the chart and force/velocity microscope. */}
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
              xRange={[0, values.xAxisMax]}
              yRange={[0, values.yAxisMax]}
              trajectoryColor={mode === "live" ? "#d97706" : "#0284c7"}
              targetX={values.targetX}
              targetY={values.targetY}
              targetSize={derived.targetRadius}
              hit={displayHit}
              pinnedPath={mode === "live" ? (pinnedTrajectory?.points ?? undefined) : undefined}
              vacuumPath={mode === "live" ? (vacuumPath ?? undefined) : undefined}
              activeAnalysisPoint={activeAnalysisPoint}
              onHoverPointChange={handleManualAnalysisPointChange}
            />
            <PhysicsMicroscope
              mass={values.mass}
              spinRPM={values.spinRpm}
              ballType={values.selectedBallType}
              airDensity={values.airDensity}
              velocityX={activeAnalysisPoint?.vx ?? defaultVelocityX}
              velocityY={activeAnalysisPoint?.vy ?? defaultVelocityY}
              dragX={activeAnalysisPoint?.dragX ?? 0}
              dragY={activeAnalysisPoint?.dragY ?? 0}
              magnusX={activeAnalysisPoint?.magnusX ?? 0}
              magnusY={activeAnalysisPoint?.magnusY ?? 0}
              gravityX={activeAnalysisPoint?.gravX ?? 0}
              gravityY={activeAnalysisPoint?.gravY ?? -(values.mass * values.gravity)}
            />
          </div>

          {/* Mode-specific feedback and summary metrics below the main visualization. */}
          <div
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              borderTop: "1px solid #e5e7eb",
              minHeight: 0,
            }}
          >
            {mode === "live" ? (
              <>
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
                  {values.dragCoefficient > 0 ? (
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
              </>
            ) : null}

            {mode === "challenge" && !challengeShot ? (
              <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>Adjust parameters and press Fire!</div>
            ) : null}
            {mode === "challenge" && isAnimating ? (
              <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>Firing…</div>
            ) : null}
            {mode === "challenge" && challengeComplete && challengeShot ? (
              <div
                style={{
                  color: challengeShot.hit ? "#16a34a" : "#dc2626",
                  fontWeight: 600,
                  fontSize: "1rem",
                }}
              >
                {challengeShot.hit ? "🎯 Hit!" : "Miss"}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
