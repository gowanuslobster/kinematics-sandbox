import { useEffect, useMemo, useRef, useState, type FC } from "react";
import PlotLib from "react-plotly.js";
import type { TrajectoryPoint } from "./physics";
import { scaleVector } from "./vectorUtils";

const Plot = PlotLib as FC<{
  data: object[];
  layout?: object;
  config?: object;
  style?: React.CSSProperties;
  onHover?: (event: unknown) => void;
  onUnhover?: () => void;
}>;

export interface TrajectoryChartProps {
  points: TrajectoryPoint[];
  xRange?: [number, number];
  yRange?: [number, number];
  trajectoryColor?: string;
  targetX?: number;
  targetY?: number;
  targetSize?: number;
  hit?: boolean;
  pinnedPath?: TrajectoryPoint[];
  vacuumPath?: TrajectoryPoint[];
  activeAnalysisPoint?: TrajectoryPoint | null;
  selectedAnalysisPoint?: TrajectoryPoint | null;
  onHoverPointChange?: (point: TrajectoryPoint | null) => void;
  onSelectedPointChange?: (point: TrajectoryPoint | null) => void;
  selectionEnabled?: boolean;
  trajectoryProgress?: number | null;
  onTrajectoryProgressChange?: (progress: number | null) => void;
  trajectoryProgressEnabled?: boolean;
  showPlaybackSpeedControl?: boolean;
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
}

interface PlotShape {
  type: "line" | "circle";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  xref: "x";
  yref: "y";
  line: {
    color: string;
    width: number;
  };
  layer?: "above" | "below";
  fillcolor?: string;
  opacity?: number;
}

const VECTOR_SCALE = 0.25;
const FORCE_SCALE_MULTIPLIER = 18;
const PLOT_MARGIN = { t: 24, r: 24, b: 40, l: 48 };
const HOVER_DISTANCE_PX = 24;

/** Builds a simple line-and-head arrow overlay anchored at the analysis point. */
function buildArrowShapes(
  originX: number,
  originY: number,
  dx: number,
  dy: number,
  color: string,
): PlotShape[] {
  const length = Math.hypot(dx, dy);
  if (length <= 1e-12) return [];

  const xTip = originX + dx;
  const yTip = originY + dy;
  const ux = dx / length;
  const uy = dy / length;
  const headLength = length * 0.24;
  const headWidth = length * 0.12;
  const baseX = xTip - ux * headLength;
  const baseY = yTip - uy * headLength;
  const px = -uy;
  const py = ux;

  return [
    {
      type: "line",
      x0: originX,
      y0: originY,
      x1: xTip,
      y1: yTip,
      xref: "x",
      yref: "y",
      line: { color, width: 2 },
      layer: "above",
    },
    {
      type: "line",
      x0: xTip,
      y0: yTip,
      x1: baseX + px * headWidth,
      y1: baseY + py * headWidth,
      xref: "x",
      yref: "y",
      line: { color, width: 2 },
      layer: "above",
    },
    {
      type: "line",
      x0: xTip,
      y0: yTip,
      x1: baseX - px * headWidth,
      y1: baseY - py * headWidth,
      xref: "x",
      yref: "y",
      line: { color, width: 2 },
      layer: "above",
    },
  ];
}

/** Builds a Plotly line trace from a sampled trajectory path and line styling. */
function buildLineTrace(
  path: TrajectoryPoint[],
  {
    color,
    name,
    dash,
    opacity,
    shape,
  }: {
    color: string;
    name: string;
    dash?: string;
    opacity?: number;
    shape?: string;
  },
) {
  return {
    x: path.map((point) => point.x),
    y: path.map((point) => point.y),
    type: "scatter",
    mode: "lines",
    line: { color, width: 2, dash, shape },
    opacity,
    name,
    hoverinfo: "skip",
  };
}

/** Builds the Plotly traces for the active trajectory plus optional overlays. */
function buildChartData({
  points,
  trajectoryColor,
  pinnedPath,
  vacuumPath,
  analysisPoint,
}: {
  points: TrajectoryPoint[];
  trajectoryColor: string;
  pinnedPath?: TrajectoryPoint[];
  vacuumPath?: TrajectoryPoint[];
  analysisPoint?: TrajectoryPoint | null;
}) {
  const traces: object[] = [];

  if (pinnedPath != null && pinnedPath.length > 0) {
    traces.push(buildLineTrace(pinnedPath, {
      color: "#9ca3af",
      name: "Pinned trajectory",
      dash: "dot",
      opacity: 0.6,
    }));
  }

  if (vacuumPath != null && vacuumPath.length > 0) {
    traces.push(buildLineTrace(vacuumPath, {
      color: "#6b7280",
      name: "Vacuum path",
      dash: "dash",
    }));
  }

  traces.push(buildLineTrace(points, {
    color: trajectoryColor,
    name: "Current trajectory",
    shape: "spline",
  }));

  if (analysisPoint) {
    traces.push({
      x: [analysisPoint.x],
      y: [analysisPoint.y],
      type: "scatter",
      mode: "markers",
      marker: {
        size: 10,
        color: trajectoryColor,
        line: { color: "#ffffff", width: 1.5 },
      },
      name: "Hover point",
      showlegend: false,
      hoverinfo: "skip",
    });
  }

  return traces;
}

/** Builds target and force/velocity overlay shapes for the active analysis point. */
function buildAnalysisShapes({
  analysisPoint,
  hit,
  targetSize,
  targetX,
  targetY,
  xRange,
  yRange,
}: {
  analysisPoint: TrajectoryPoint | null;
  hit: boolean;
  targetSize: number;
  targetX?: number;
  targetY?: number;
  xRange: [number, number];
  yRange: [number, number];
}) {
  const nextShapes: PlotShape[] = [];
  const targetColor = hit ? "#16a34a" : "#dc2626";

  if (targetX != null && targetY != null && targetSize > 0) {
    nextShapes.push({
      type: "circle",
      x0: targetX - targetSize,
      y0: targetY - targetSize,
      x1: targetX + targetSize,
      y1: targetY + targetSize,
      xref: "x",
      yref: "y",
      line: { color: targetColor, width: 2 },
      fillcolor: targetColor,
      opacity: 0.4,
    });
  }

  if (!analysisPoint) return nextShapes;

  const axisSpan = Math.max(1, Math.min(xRange[1] - xRange[0], yRange[1] - yRange[0]));
  const maxVectorLength = axisSpan * 0.22;
  const minVectorLength = axisSpan * 0.03;

  const velocity = scaleVector(analysisPoint.vx, analysisPoint.vy, VECTOR_SCALE, minVectorLength, maxVectorLength);
  const drag = scaleVector(
    analysisPoint.dragX,
    analysisPoint.dragY,
    VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
    minVectorLength,
    maxVectorLength,
  );
  const magnus = scaleVector(
    analysisPoint.magnusX,
    analysisPoint.magnusY,
    VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
    minVectorLength,
    maxVectorLength,
  );
  const gravity = scaleVector(
    analysisPoint.gravX,
    analysisPoint.gravY,
    VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
    minVectorLength,
    maxVectorLength,
  );

  nextShapes.push(
    ...buildArrowShapes(analysisPoint.x, analysisPoint.y, velocity.dx, velocity.dy, "#22c55e"),
    ...buildArrowShapes(analysisPoint.x, analysisPoint.y, drag.dx, drag.dy, "#ef4444"),
    ...buildArrowShapes(analysisPoint.x, analysisPoint.y, magnus.dx, magnus.dy, "#a855f7"),
    ...buildArrowShapes(analysisPoint.x, analysisPoint.y, gravity.dx, gravity.dy, "#3b82f6"),
  );

  return nextShapes;
}

/** Finds the nearest trajectory sample to the current mouse position in plot pixels. */
function findClosestHoverIndex({
  localX,
  localY,
  plotHeight,
  plotWidth,
  points,
  xRange,
  yRange,
}: {
  localX: number;
  localY: number;
  plotHeight: number;
  plotWidth: number;
  points: TrajectoryPoint[];
  xRange: [number, number];
  yRange: [number, number];
}) {
  const xSpan = Math.max(1e-9, xRange[1] - xRange[0]);
  const ySpan = Math.max(1e-9, yRange[1] - yRange[0]);
  let closestIdx = -1;
  let closestDistPx = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const pointX = PLOT_MARGIN.l + ((point.x - xRange[0]) / xSpan) * plotWidth;
    const pointY = PLOT_MARGIN.t + ((yRange[1] - point.y) / ySpan) * plotHeight;
    const distancePx = Math.hypot(localX - pointX, localY - pointY);
    if (distancePx < closestDistPx) {
      closestDistPx = distancePx;
      closestIdx = i;
    }
  }

  if (closestIdx >= 0 && closestDistPx <= HOVER_DISTANCE_PX) {
    return closestIdx;
  }
  return null;
}

/** Converts a trajectory point reference into a percent-complete position along the path. */
function getTrajectoryProgressForPoint(point: TrajectoryPoint | null | undefined, points: TrajectoryPoint[]) {
  if (!point || points.length <= 1) return 0;
  const pointIndex = points.indexOf(point);
  if (pointIndex < 0) return 0;
  return (pointIndex / (points.length - 1)) * 100;
}

/** Plotly wrapper that renders the current trajectory and analysis overlays. */
export function TrajectoryChart({
  points,
  xRange = [0, 100],
  yRange = [0, 50],
  trajectoryColor = "#d97706",
  targetX,
  targetY,
  targetSize = 5,
  hit = false,
  pinnedPath,
  vacuumPath,
  activeAnalysisPoint,
  selectedAnalysisPoint,
  onHoverPointChange,
  onSelectedPointChange,
  selectionEnabled = false,
  trajectoryProgress,
  onTrajectoryProgressChange,
  trajectoryProgressEnabled = false,
  showPlaybackSpeedControl = false,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
}: TrajectoryChartProps) {
  const plotContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const manualHoveredPoint =
    hoverIndex != null && hoverIndex >= 0 && hoverIndex < points.length
      ? points[hoverIndex]
      : null;
  const analysisPoint = selectedAnalysisPoint ?? activeAnalysisPoint ?? manualHoveredPoint;
  // The slider shows explicit trajectory progress when present; otherwise it
  // falls back to whichever point is currently driving the overlays.
  const displayedTrajectoryProgress = useMemo(() => {
    if (trajectoryProgress != null) return trajectoryProgress;
    return getTrajectoryProgressForPoint(selectedAnalysisPoint ?? activeAnalysisPoint, points);
  }, [activeAnalysisPoint, points, selectedAnalysisPoint, trajectoryProgress]);

  // Forward hover ownership to the parent so challenge playback can decide
  // whether the chart or the autoplay animation controls the analysis point.
  useEffect(() => {
    onHoverPointChange?.(manualHoveredPoint);
  }, [manualHoveredPoint, onHoverPointChange]);

  const data = useMemo(() => buildChartData({
    points,
    trajectoryColor,
    pinnedPath,
    vacuumPath,
    analysisPoint,
  }), [analysisPoint, pinnedPath, points, trajectoryColor, vacuumPath]);

  const shapes = useMemo(() => buildAnalysisShapes({
    analysisPoint,
    hit,
    targetSize,
    targetX,
    targetY,
    xRange,
    yRange,
  }), [analysisPoint, hit, targetSize, targetX, targetY, xRange, yRange]);

  // The transparent overlay lets us run our own nearest-point hit testing instead
  // of relying on Plotly's hover behavior for spline-smoothed lines.
  const handlePlotMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (points.length === 0) {
      setHoverIndex(null);
      return;
    }
    const container = plotContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const plotWidth = rect.width - PLOT_MARGIN.l - PLOT_MARGIN.r;
    const plotHeight = rect.height - PLOT_MARGIN.t - PLOT_MARGIN.b;
    if (plotWidth <= 0 || plotHeight <= 0) return;
    if (
      localX < PLOT_MARGIN.l
      || localX > PLOT_MARGIN.l + plotWidth
      || localY < PLOT_MARGIN.t
      || localY > PLOT_MARGIN.t + plotHeight
    ) {
      setHoverIndex(null);
      return;
    }

    setHoverIndex(findClosestHoverIndex({
      localX,
      localY,
      plotHeight,
      plotWidth,
      points,
      xRange,
      yRange,
    }));
  };

  const handlePlotClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectionEnabled || points.length === 0) return;
    const container = plotContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const plotWidth = rect.width - PLOT_MARGIN.l - PLOT_MARGIN.r;
    const plotHeight = rect.height - PLOT_MARGIN.t - PLOT_MARGIN.b;
    if (plotWidth <= 0 || plotHeight <= 0) return;
    if (
      localX < PLOT_MARGIN.l
      || localX > PLOT_MARGIN.l + plotWidth
      || localY < PLOT_MARGIN.t
      || localY > PLOT_MARGIN.t + plotHeight
    ) {
      return;
    }

    const nextIndex = findClosestHoverIndex({
      localX,
      localY,
      plotHeight,
      plotWidth,
      points,
      xRange,
      yRange,
    });
    if (nextIndex == null) {
      onSelectedPointChange?.(null);
      return;
    }

    const nextPoint = points[nextIndex];
    if (selectedAnalysisPoint === nextPoint) {
      onSelectedPointChange?.(null);
      return;
    }
    onSelectedPointChange?.(nextPoint);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, width: "100%" }}>
      {/* Plotly renders the chart while a transparent overlay captures custom hover behavior. */}
      <div
        ref={plotContainerRef}
        style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", display: "flex" }}
      >
        <Plot
          data={data}
          layout={{
            margin: PLOT_MARGIN,
            xaxis: {
              title: "Distance",
              showgrid: true,
              range: xRange,
            },
            yaxis: {
              title: "Height",
              showgrid: true,
              range: yRange,
            },
            showlegend: pinnedPath != null || vacuumPath != null,
            legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.8)" },
            hovermode: "closest",
            shapes,
          }}
          config={{ responsive: true }}
          style={{ width: "100%", height: "100%", minHeight: 400 }}
        />
        <div
          onMouseMove={handlePlotMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          onClick={handlePlotClick}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            background: "transparent",
          }}
        />
      </div>

      {(points.length > 0 || showPlaybackSpeedControl) ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem 1rem",
            padding: "0.5rem 0.75rem 0.25rem",
            borderTop: "1px solid #e5e7eb",
            background: "#f9fafb",
            fontSize: "0.8125rem",
          }}
        >
          {points.length > 0 ? (
            <>
              {/* Timeline controls let the user lock the chart and microscope onto one percentage of the path. */}
              <label
                htmlFor="trajectory-progress"
                style={{ fontWeight: 600, color: "#374151", minWidth: 122 }}
              >
                Trajectory progress
              </label>
              <input
                id="trajectory-progress"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(displayedTrajectoryProgress)}
                disabled={!trajectoryProgressEnabled}
                onChange={(event) => {
                  onTrajectoryProgressChange?.(Number(event.target.value));
                }}
                style={{ flex: 1, minWidth: 180 }}
              />
              <span style={{ minWidth: 44, color: "#4b5563", textAlign: "right" }}>
                {Math.round(displayedTrajectoryProgress)}%
              </span>
            </>
          ) : null}
          {showPlaybackSpeedControl ? (
            <>
              {/* Challenge mode can speed up or slow down the reveal loop without changing the trajectory itself. */}
              <label
                htmlFor="animation-speed"
                style={{ fontWeight: 600, color: "#374151" }}
              >
                Animation speed
              </label>
              <select
                id="animation-speed"
                value={String(playbackSpeed)}
                onChange={(event) => onPlaybackSpeedChange?.(Number(event.target.value))}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  padding: "0.25rem 0.5rem",
                  background: "#fff",
                  color: "#111827",
                }}
              >
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
                <option value="8">8x</option>
              </select>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
