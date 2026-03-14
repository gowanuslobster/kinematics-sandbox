/**
 * Physics engine for 2D projectile motion with advanced ballistics.
 * - Drag: F_d = -(1/2) ρ |v|² C_d A v̂
 * - Magnus (lift): F_L perpendicular to v, magnitude ∝ spin × velocity
 * Uses Symplectic Euler-Cromer integration when air is present.
 */

const DT = 0.01;
const MAX_STEPS = 10_000;
const V_MIN = 1e-6;
const MIN_NON_ZERO_GRAVITY = 0.1;
const DEFAULT_BALL_MASS = 0.145;
const DEFAULT_BALL_RADIUS = 0.037;

/** Gravity below this is treated as zero (floating-point safety). */
const G_EPSILON = 1e-10;

/** Air density below this is treated as vacuum (no drag, no Magnus). */
const RHO_EPSILON = 1e-10;

/** Max time (s) for zero-gravity straight-line trajectory sampling. */
const ZERO_G_MAX_TIME = 1000;

/** Treats extremely small gravity values as true zero for stability checks. */
function isZeroG(g: number): boolean {
  return g < G_EPSILON;
}

/** Treats extremely small air densities as vacuum for drag/Magnus checks. */
function isVacuum(rho: number): boolean {
  return rho < RHO_EPSILON;
}

/** Keep gravity at true zero or a numerically stable positive floor. */
function normalizeGravity(gravity: number): number {
  return isZeroG(gravity) ? 0 : Math.max(gravity, MIN_NON_ZERO_GRAVITY);
}

/** Splits launch speed and angle into horizontal and vertical components. */
function velocityComponents(initialVelocity: number, angleDeg: number): { v0x: number; v0y: number } {
  const angleRad = toRad(angleDeg);
  return {
    v0x: initialVelocity * Math.cos(angleRad),
    v0y: initialVelocity * Math.sin(angleRad),
  };
}

/** Drag + atmosphere off means we can use the analytical vacuum model. */
function shouldUseVacuumModel(airDensity: number | undefined, dragCoefficient: number): boolean {
  const rho = airDensity ?? AIR_DENSITY_SEA_LEVEL;
  return isVacuum(rho) || (airDensity === undefined && dragCoefficient === 0);
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
  /** Cannonball: ~2.5 kg, ~9 cm radius, C_d ≈ 0.47. */
  cannonball: { mass: 2.5, radius: 0.09, dragCoefficient: 0.47 },
} as const;

export interface TrajectoryPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dragX: number;
  dragY: number;
  magnusX: number;
  magnusY: number;
  gravX: number;
  gravY: number;
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

/** Converts degrees to radians for trigonometric launch calculations. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Builds the analytic vacuum trajectory used both for pure vacuum runs and for
 * the comparison path shown alongside drag-enabled trajectories. With g > 0 it
 * samples a parabola; with g ≈ 0 it samples straight-line motion.
 */
function analyticalTrajectory(
  v0: number,
  angleDeg: number,
  g: number,
  numPoints: number,
  mass: number = DEFAULT_BALL_MASS,
): TrajectoryPoint[] {
  const gravX = 0;
  const gravY = -mass * g;
  if (v0 <= 0) {
    return [{
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      dragX: 0,
      dragY: 0,
      magnusX: 0,
      magnusY: 0,
      gravX,
      gravY,
    }];
  }
  const { v0x, v0y } = velocityComponents(v0, angleDeg);

  if (isZeroG(g)) {
    const points: TrajectoryPoint[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * ZERO_G_MAX_TIME;
      points.push({
        x: v0x * t,
        y: v0y * t,
        vx: v0x,
        vy: v0y,
        dragX: 0,
        dragY: 0,
        magnusX: 0,
        magnusY: 0,
        gravX,
        gravY,
      });
    }
    return points;
  }

  if (v0y <= 0) {
    return [{
      x: 0,
      y: 0,
      vx: v0x,
      vy: v0y,
      dragX: 0,
      dragY: 0,
      magnusX: 0,
      magnusY: 0,
      gravX,
      gravY,
    }];
  }
  const tFlight = (2 * v0y) / g;
  const points: TrajectoryPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * tFlight;
    points.push({
      x: v0x * t,
      y: v0y * t - 0.5 * g * t * t,
      vx: v0x,
      vy: v0y - g * t,
      dragX: 0,
      dragY: 0,
      magnusX: 0,
      magnusY: 0,
      gravX,
      gravY,
    });
  }
  return points;
}

/** Vacuum metrics (time of flight, max height, range). With g ≈ 0 returns 0 (no finite time of flight or max height). */
function vacuumMetrics(v0: number, angleDeg: number, g: number) {
  if (isZeroG(g) || g <= 0) return { timeOfFlight: 0, maxHeight: 0, range: 0 };
  const { v0x, v0y } = velocityComponents(v0, angleDeg);
  if (v0y <= 0) return { timeOfFlight: 0, maxHeight: 0, range: 0 };
  const timeOfFlight = (2 * v0y) / g;
  const maxHeight = (v0y * v0y) / (2 * g);
  const range = v0x * timeOfFlight;
  return { timeOfFlight, maxHeight, range };
}

/**
 * Computes the main sampled trajectory when air effects are active using
 * Symplectic Euler-Cromer integration with drag and Magnus forces.
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
  const g = normalizeGravity(gravity);
  const m = Math.max(params.mass ?? DEFAULT_BALL_MASS, 1e-10);
  const r = Math.max(params.radius ?? DEFAULT_BALL_RADIUS, 1e-10);
  const rho = params.airDensity ?? AIR_DENSITY_SEA_LEVEL;
  const cd = Math.max(dragCoefficient, 0);
  const spinRpm = params.spinRpm ?? 0;
  const omegaRad = (spinRpm * Math.PI * 2) / 60;

  const A = Math.PI * r * r;

  const points: TrajectoryPoint[] = [];
  let x = 0;
  let y = 0;
  let { v0x: vx, v0y: vy } = velocityComponents(initialVelocity, launchAngleDeg);
  const gravX = 0;
  const gravY = -m * g;

  for (let step = 0; step < MAX_STEPS; step++) {
    const v = Math.hypot(vx, vy);
    let dragX = 0;
    let dragY = 0;
    let magnusX = 0;
    let magnusY = 0;

    if (rho >= RHO_EPSILON && v >= V_MIN) {
      dragX = -0.5 * rho * cd * A * v * vx;
      dragY = -0.5 * rho * cd * A * v * vy;
      if (Math.abs(omegaRad) >= 1e-10) {
        const magnus = 2 * rho * Math.PI * r * r * r * omegaRad;
        magnusX = -magnus * vy;
        magnusY = magnus * vx;
      }
    }

    points.push({
      x,
      y,
      vx,
      vy,
      dragX,
      dragY,
      magnusX,
      magnusY,
      gravX,
      gravY,
    });

    if (Math.hypot(x - targetX, y - targetY) <= targetRadius) {
      return { points, hit: true };
    }

    if (v < V_MIN) break;

    const Fx = dragX + magnusX + gravX;
    const Fy = dragY + magnusY + gravY;

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
        vx,
        vy,
        dragX,
        dragY,
        magnusX,
        magnusY,
        gravX,
        gravY,
      });
      return { points, hit: false };
    }

    x = xNext;
    y = yNext;
  }
  return { points, hit: false };
}

/**
 * Pure public entry point that picks between the analytic vacuum path and the
 * drag/Magnus integrator, then packages the sampled path and comparable
 * summary metrics with no side effects.
 */
export function calculateTrajectory(params: SimulationParams): SimulationResult {
  const g = normalizeGravity(params.gravity);
  const mass = Math.max(params.mass ?? DEFAULT_BALL_MASS, 1e-10);
  const vacuum = vacuumMetrics(params.initialVelocity, params.launchAngleDeg, g);
  const useVacuum = shouldUseVacuumModel(params.airDensity, params.dragCoefficient);

  if (useVacuum) {
    const points = analyticalTrajectory(
      params.initialVelocity,
      params.launchAngleDeg,
      g,
      300,
      mass,
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
    mass,
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
