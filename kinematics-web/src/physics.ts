/**
 * Physics engine for 2D projectile motion with advanced ballistics.
 * - Drag: F_d = -(1/2) ρ |v|² C_d A v̂
 * - Magnus (lift): F_L perpendicular to v, magnitude ∝ spin × velocity
 * Uses Symplectic Euler-Cromer integration when air is present.
 */

const DT = 0.01;
const MAX_STEPS = 10_000;
const V_MIN = 1e-6;

/** Gravity below this is treated as zero (floating-point safety). */
const G_EPSILON = 1e-10;

/** Air density below this is treated as vacuum (no drag, no Magnus). */
const RHO_EPSILON = 1e-10;

/** Max time (s) for zero-gravity straight-line trajectory sampling. */
const ZERO_G_MAX_TIME = 1000;

function isZeroG(g: number): boolean {
  return g < G_EPSILON;
}

function isVacuum(rho: number): boolean {
  return rho < RHO_EPSILON;
}

/** Reference drag coefficient for Earth's atmosphere (kg/m) — legacy; use ballistics params when available. */
export const EARTH_DRAG = 0.0022;

/** Air density at sea level (kg/m³). */
export const AIR_DENSITY_SEA_LEVEL = 1.225;

/** Ball presets for mass (kg), radius (m), dimensionless C_d. Use with spinRpm and airDensity. */
export const BALL_PRESETS = {
  /** Baseball: ~145 g, ~3.7 cm radius, C_d ≈ 0.3. */
  baseball: { mass: 0.145, radius: 0.037, dragCoefficient: 0.3 },
  /** Ping pong: ~2.7 g, ~2 cm radius, C_d ≈ 0.5 — low mass gives dramatic Magnus curves. */
  pingPong: { mass: 0.0027, radius: 0.02, dragCoefficient: 0.5 },
} as const;

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
  /** Dimensionless drag coefficient C_d. Used in F_d = -(1/2) ρ C_d A |v|² v̂. */
  dragCoefficient: number;
  /** Target center X (m). */
  targetX: number;
  /** Target center Y (m). */
  targetY: number;
  /** Target radius for hit detection (m). */
  targetRadius: number;
  /** Ball mass (kg). Default 0.145 (baseball). */
  mass?: number;
  /** Ball radius (m). Default 0.037 (baseball). */
  radius?: number;
  /** Spin in revolutions per minute (backspin = positive). Default 0. */
  spinRpm?: number;
  /** Air density (kg/m³). Use 0 or &lt; 1e-10 for vacuum. Default 1.225. */
  airDensity?: number;
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
 * Advanced ballistics: Symplectic Euler-Cromer with drag and Magnus.
 * - Drag: F_d = -(1/2) ρ |v|² C_d A v̂  →  -(1/2) ρ C_d A |v| (vx, vy)
 * - Magnus: F_L ∝ ω × v (backspin = +ω out of page) → F_L = 2 ρ π r³ ω (-vy, vx)
 * Integration: a = (F_g + F_d + F_L)/m; v = v + a·dt; pos = pos + v·dt
 */
function trajectoryWithDrag(params: SimulationParams): { points: TrajectoryPoint[]; hit: boolean } {
  const {
    initialVelocity,
    launchAngleDeg,
    gravity,
    dragCoefficient,
    targetX,
    targetY,
    targetRadius,
  } = params;
  const g = isZeroG(gravity) ? 0 : Math.max(gravity, 0.1);
  const m = Math.max(params.mass ?? 0.145, 1e-10);
  const r = Math.max(params.radius ?? 0.037, 1e-10);
  const rho = params.airDensity ?? AIR_DENSITY_SEA_LEVEL;
  const cd = Math.max(dragCoefficient, 0);
  const spinRpm = params.spinRpm ?? 0;
  const omegaRad = (spinRpm * Math.PI * 2) / 60;

  const A = Math.PI * r * r;

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

    let Fx = 0;
    let Fy = -m * g;

    if (rho >= RHO_EPSILON) {
      const vMag = v;
      Fx += -0.5 * rho * cd * A * vMag * vx;
      Fy += -0.5 * rho * cd * A * vMag * vy;
      if (Math.abs(omegaRad) >= 1e-10) {
        const magnus = 2 * rho * Math.PI * r * r * r * omegaRad;
        Fx += -magnus * vy;
        Fy += magnus * vx;
      }
    }

    const ax = Fx / m;
    const ay = Fy / m;

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
 * Uses vacuum (analytic) when air density is effectively zero; otherwise uses advanced ballistics.
 */
export function calculateTrajectory(params: SimulationParams): SimulationResult {
  const g = isZeroG(params.gravity) ? 0 : Math.max(params.gravity, 0.1);
  const vacuum = vacuumMetrics(params.initialVelocity, params.launchAngleDeg, g);
  const rho = params.airDensity ?? AIR_DENSITY_SEA_LEVEL;
  const useVacuum = isVacuum(rho) || (params.airDensity === undefined && params.dragCoefficient === 0);

  if (useVacuum) {
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
