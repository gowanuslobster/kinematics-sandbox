import { describe, expect, it } from "vitest";
import { AIR_DENSITY_SEA_LEVEL, calculateTrajectory, type SimulationParams } from "./physics";

function makeParams(overrides: Partial<SimulationParams> = {}): SimulationParams {
  return {
    initialVelocity: 50,
    launchAngleDeg: 45,
    gravity: 9.81,
    dragCoefficient: 0,
    targetX: 5000,
    targetY: 5000,
    targetRadius: 1,
    ...overrides,
  };
}

describe("calculateTrajectory", () => {
  it("uses analytical vacuum path when drag and air effects are off", () => {
    const result = calculateTrajectory(
      makeParams({
        dragCoefficient: 0,
        airDensity: 0,
      }),
    );

    expect(result.vacuumPath).toBeNull();
    expect(result.points.length).toBe(301);
    expect(result.timeOfFlightActual).toBeCloseTo(result.timeOfFlightVacuum, 10);
    expect(result.maxHeightActual).toBeCloseTo(result.maxHeightVacuum, 10);
    expect(result.rangeActual).toBeCloseTo(result.rangeVacuum, 10);
    expect(result.hit).toBe(false);
  });

  it("includes a comparison vacuum path when drag is enabled", () => {
    const result = calculateTrajectory(
      makeParams({
        dragCoefficient: 0.5,
        airDensity: AIR_DENSITY_SEA_LEVEL,
      }),
    );

    expect(result.vacuumPath).not.toBeNull();
    expect(result.points.length).toBeGreaterThan(2);
    expect(result.timeOfFlightActual).toBeGreaterThan(0);
    expect(result.rangeActual).toBeLessThan(result.rangeVacuum);
    expect(result.maxHeightActual).toBeLessThan(result.maxHeightVacuum);
  });

  it("records velocity and force components for drag integration points", () => {
    const result = calculateTrajectory(
      makeParams({
        dragCoefficient: 0.5,
        airDensity: AIR_DENSITY_SEA_LEVEL,
        spinRpm: 1200,
      }),
    );
    const sample = result.points[Math.min(10, result.points.length - 1)];

    expect(Number.isFinite(sample.vx)).toBe(true);
    expect(Number.isFinite(sample.vy)).toBe(true);
    expect(Number.isFinite(sample.dragX)).toBe(true);
    expect(Number.isFinite(sample.dragY)).toBe(true);
    expect(Number.isFinite(sample.magnusX)).toBe(true);
    expect(Number.isFinite(sample.magnusY)).toBe(true);
    expect(sample.gravX).toBeCloseTo(0, 10);
    expect(sample.gravY).toBeLessThan(0);

    const dragDotVelocity = sample.dragX * sample.vx + sample.dragY * sample.vy;
    expect(dragDotVelocity).toBeLessThanOrEqual(1e-8);
    expect(Math.hypot(sample.magnusX, sample.magnusY)).toBeGreaterThan(0);
  });

  it("sets drag and magnus components to zero for vacuum paths", () => {
    const result = calculateTrajectory(
      makeParams({
        dragCoefficient: 0,
        airDensity: 0,
      }),
    );
    const sample = result.points[Math.min(50, result.points.length - 1)];
    expect(sample.dragX).toBe(0);
    expect(sample.dragY).toBe(0);
    expect(sample.magnusX).toBe(0);
    expect(sample.magnusY).toBe(0);
  });

  it("handles zero-gravity vacuum runs without NaN/Infinity", () => {
    const result = calculateTrajectory(
      makeParams({
        launchAngleDeg: 30,
        gravity: 0,
        dragCoefficient: 0,
        airDensity: 0,
      }),
    );

    expect(result.timeOfFlightVacuum).toBe(0);
    expect(result.timeOfFlightActual).toBe(0);
    expect(result.maxHeightVacuum).toBe(0);
    expect(result.maxHeightActual).toBe(0);
    expect(result.rangeVacuum).toBe(0);
    expect(result.rangeActual).toBeGreaterThan(0);
    expect(result.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it("reports hit when target lies on sampled trajectory point", () => {
    const baseline = calculateTrajectory(
      makeParams({
        airDensity: 0,
      }),
    );
    const probePoint = baseline.points[150];

    const result = calculateTrajectory(
      makeParams({
        airDensity: 0,
        targetX: probePoint.x,
        targetY: probePoint.y,
        targetRadius: 1e-6,
      }),
    );

    expect(result.hit).toBe(true);
  });
});
