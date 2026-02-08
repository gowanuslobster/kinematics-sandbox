/**
 * Physics engine for 2D projectile motion with optional quadratic air resistance.
 * Drag model: F_d = -C_d * v² * v̂ (magnitude ∝ v², direction opposite to velocity).
 * Uses Symplectic Euler-Cromer integration when drag is present.
 */

const DT = 0.01;
const MAX_STEPS = 10_000;
const V_MIN = 1e-6;

/** Gravity below this is treated as zero (floating-point safety). */
const G_EPSILON = 1e-10;

/** Max time (s) for zero-gravity straight-line trajectory sampling. */
const ZERO_G_MAX_TIME = 1000;

function isZeroG(g: number): boolean {
  return g < G_EPSILON;
}

/** Reference drag coefficient for Earth's atmosphere (kg/m) — e.g. 10 cm diameter, 1 kg sphere at STP. */
export const EARTH_DRAG = 0.0022;

export interface TrajectoryPoint {
  x: number;
  y: number;
}

/** All inputs required to run the simulation. */
export interface SimulationParams {
  /** Initial speed (m/s). */
  initialVelocity: number;
  /** Launch angle from horizontal (degrees, 0–90). */
  launchAngleDeg: number;
  /** Gravitational acceleration (m/s²). */
  gravity: number;
  /** Drag coefficient C_d (kg/m). Drag force magnitude = C_d * v². */
  dragCoefficient: number;
  /** Target center X (m). */
  targetX: number;
  /** Target center Y (m). */
  targetY: number;
  /** Target radius for hit detection (m). */
  targetRadius: number;
}

/** Result of a single trajectory run. */
export interface SimulationResult {
  /** Path points from launch until landing or target hit. */
  points: TrajectoryPoint[];
  /** True if the projectile passed within targetRadius of (targetX, targetY). */
  hit: boolean;
  /** Vacuum trajectory (no drag) for comparison when drag > 0; null when drag === 0. */
  vacuumPath: TrajectoryPoint[] | null;
  /** Time of flight (vacuum formula) (s). */
  timeOfFlightVacuum: number;
  /** Time of flight from simulation (s). */
  timeOfFlightActual: number;
  /** Max height (vacuum formula) (m). */
  maxHeightVacuum: number;
  /** Max height from path (m). */
  maxHeightActual: number;
  /** Range (vacuum formula) (m). */
  rangeVacuum: number;
  /** Range from path (m). */
  rangeActual: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Vacuum (analytic) trajectory: with g > 0 uses parabola; with g ≈ 0 uses straight line x = v0x*t, y = v0y*t. */
function analyticalTrajectory(
  v0: number,
  angleDeg: number,
  g: number,
  numPoints: number,
): TrajectoryPoint[] {
  if (v0 <= 0) return [{ x: 0, y: 0 }];
  const v0x = v0 * Math.cos(toRad(angleDeg));
  const v0y = v0 * Math.sin(toRad(angleDeg));

  if (isZeroG(g)) {
    const points: TrajectoryPoint[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * ZERO_G_MAX_TIME;
      points.push({ x: v0x * t, y: v0y * t });
    }
    return points;
  }

  if (v0y <= 0) return [{ x: 0, y: 0 }];
  const tFlight = (2 * v0y) / g;
  const points: TrajectoryPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * tFlight;
    points.push({
      x: v0x * t,
      y: v0y * t - 0.5 * g * t * t,
    });
  }
  return points;
}

/** Vacuum metrics (time of flight, max height, range). With g ≈ 0 returns 0 (no finite time of flight or max height). */
function vacuumMetrics(v0: number, angleDeg: number, g: number) {
  if (isZeroG(g) || g <= 0) return { timeOfFlight: 0, maxHeight: 0, range: 0 };
  const v0x = v0 * Math.cos(toRad(angleDeg));
  const v0y = v0 * Math.sin(toRad(angleDeg));
  if (v0y <= 0) return { timeOfFlight: 0, maxHeight: 0, range: 0 };
  const timeOfFlight = (2 * v0y) / g;
  const maxHeight = (v0y * v0y) / (2 * g);
  const range = v0x * timeOfFlight;
  return { timeOfFlight, maxHeight, range };
}

/**
 * Symplectic Euler-Cromer integration with quadratic drag F_d = -C_d * v² * v̂.
 * Update velocity first, then position using the new velocity:
 *   v_{n+1} = v_n + a_n * dt
 *   x_{n+1} = x_n + v_{n+1} * dt
 */
function trajectoryWithDrag(params: SimulationParams): { points: TrajectoryPoint[]; hit: boolean } {
  const { initialVelocity, launchAngleDeg, gravity, dragCoefficient, targetX, targetY, targetRadius } = params;
  const g = isZeroG(gravity) ? 0 : Math.max(gravity, 0.1);
  const cd = dragCoefficient;
  const points: TrajectoryPoint[] = [];
  let x = 0;
  let y = 0;
  let vx = initialVelocity * Math.cos(toRad(launchAngleDeg));
  let vy = initialVelocity * Math.sin(toRad(launchAngleDeg));

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
      points.push({
        x: x + (xNext - x) * tFrac,
        y: 0,
      });
      return { points, hit: false };
    }

    x = xNext;
    y = yNext;
  }
  return { points, hit: false };
}

/**
 * Pure function: compute trajectory and derived metrics from simulation parameters.
 * One-way: params in → result out; no side effects.
 */
export function calculateTrajectory(params: SimulationParams): SimulationResult {
  const g = isZeroG(params.gravity) ? 0 : Math.max(params.gravity, 0.1);
  const vacuum = vacuumMetrics(params.initialVelocity, params.launchAngleDeg, g);

  if (params.dragCoefficient === 0) {
    const points = analyticalTrajectory(
      params.initialVelocity,
      params.launchAngleDeg,
      g,
      300,
    );
    const hit =
      points.length > 0 &&
      points.some(
        (p) =>
          Math.hypot(p.x - params.targetX, p.y - params.targetY) <= params.targetRadius,
      );
    const rangeActual = points.length > 0 ? points[points.length - 1].x : 0;
    return {
      points,
      hit,
      vacuumPath: null,
      timeOfFlightVacuum: vacuum.timeOfFlight,
      timeOfFlightActual: vacuum.timeOfFlight,
      maxHeightVacuum: vacuum.maxHeight,
      maxHeightActual: vacuum.maxHeight,
      rangeVacuum: vacuum.range,
      rangeActual,
    };
  }

  const { points, hit } = trajectoryWithDrag(params);
  const vacuumPath = analyticalTrajectory(
    params.initialVelocity,
    params.launchAngleDeg,
    g,
    300,
  );
  const timeActual = (points.length - 1) * DT;
  const rangeActual = points.length > 0 ? points[points.length - 1].x : 0;
  const maxHeightActual = Math.max(0, ...points.map((p) => p.y));

  return {
    points,
    hit,
    vacuumPath,
    timeOfFlightVacuum: vacuum.timeOfFlight,
    timeOfFlightActual: timeActual,
    maxHeightVacuum: vacuum.maxHeight,
    maxHeightActual,
    rangeVacuum: vacuum.range,
    rangeActual,
  };
}
