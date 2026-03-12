import { useEffect, useMemo, useRef, useState, type FC } from "react";
import PlotLib from "react-plotly.js";
import type { TrajectoryPoint } from "./physics";

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
  onHoverPointChange?: (point: TrajectoryPoint | null) => void;
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

function scaleVector(
  x: number,
  y: number,
  factor: number,
  maxLength: number,
  minLength: number,
): { dx: number; dy: number } {
  const sourceLength = Math.hypot(x, y);
  if (sourceLength < 1e-8) {
    return { dx: 0, dy: 0 };
  }
  let dx = x * factor;
  let dy = y * factor;
  let len = Math.hypot(dx, dy);
  if (len > 0 && len < minLength) {
    const ratio = minLength / len;
    dx *= ratio;
    dy *= ratio;
    len = Math.hypot(dx, dy);
  }
  if (len > maxLength && len > 0) {
    const ratio = maxLength / len;
    dx *= ratio;
    dy *= ratio;
  }
  return { dx, dy };
}

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
  onHoverPointChange,
}: TrajectoryChartProps) {
  const plotContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const x = points.map((p) => p.x);
  const y = points.map((p) => p.y);
  const manualHoveredPoint =
    hoverIndex != null && hoverIndex >= 0 && hoverIndex < points.length
      ? points[hoverIndex]
      : null;
  const analysisPoint = activeAnalysisPoint ?? manualHoveredPoint;

  useEffect(() => {
    onHoverPointChange?.(manualHoveredPoint);
  }, [manualHoveredPoint, onHoverPointChange]);

  const data: object[] = [];

  if (pinnedPath != null && pinnedPath.length > 0) {
    data.push({
      x: pinnedPath.map((p) => p.x),
      y: pinnedPath.map((p) => p.y),
      type: "scatter",
      mode: "lines",
      line: { color: "#9ca3af", width: 2, dash: "dot" },
      opacity: 0.6,
      name: "Pinned trajectory",
      hoverinfo: "skip",
    });
  }

  if (vacuumPath != null && vacuumPath.length > 0) {
    data.push({
      x: vacuumPath.map((p) => p.x),
      y: vacuumPath.map((p) => p.y),
      type: "scatter",
      mode: "lines",
      line: { color: "#6b7280", width: 2, dash: "dash" },
      name: "Vacuum path",
      hoverinfo: "skip",
    });
  }

  data.push({
    x,
    y,
    type: "scatter",
    mode: "lines",
    line: { shape: "spline", color: trajectoryColor, width: 2 },
    name: "Current trajectory",
    hoverinfo: "skip",
  });

  if (analysisPoint) {
    data.push({
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

  const shapes = useMemo(() => {
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

    const velocity = scaleVector(analysisPoint.vx, analysisPoint.vy, VECTOR_SCALE, maxVectorLength, minVectorLength);
    const drag = scaleVector(
      analysisPoint.dragX,
      analysisPoint.dragY,
      VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
      maxVectorLength,
      minVectorLength,
    );
    const magnus = scaleVector(
      analysisPoint.magnusX,
      analysisPoint.magnusY,
      VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
      maxVectorLength,
      minVectorLength,
    );
    const gravity = scaleVector(
      analysisPoint.gravX,
      analysisPoint.gravY,
      VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
      maxVectorLength,
      minVectorLength,
    );

    nextShapes.push(
      ...buildArrowShapes(analysisPoint.x, analysisPoint.y, velocity.dx, velocity.dy, "#22c55e"),
      ...buildArrowShapes(analysisPoint.x, analysisPoint.y, drag.dx, drag.dy, "#ef4444"),
      ...buildArrowShapes(analysisPoint.x, analysisPoint.y, magnus.dx, magnus.dy, "#a855f7"),
      ...buildArrowShapes(analysisPoint.x, analysisPoint.y, gravity.dx, gravity.dy, "#3b82f6"),
    );
    return nextShapes;
  }, [analysisPoint, hit, targetSize, targetX, targetY, xRange, yRange]);

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

    const xSpan = Math.max(1e-9, xRange[1] - xRange[0]);
    const ySpan = Math.max(1e-9, yRange[1] - yRange[0]);
    let closestIdx = -1;
    let closestDistPx = Number.POSITIVE_INFINITY;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const px = PLOT_MARGIN.l + ((p.x - xRange[0]) / xSpan) * plotWidth;
      const py = PLOT_MARGIN.t + ((yRange[1] - p.y) / ySpan) * plotHeight;
      const dist = Math.hypot(localX - px, localY - py);
      if (dist < closestDistPx) {
        closestDistPx = dist;
        closestIdx = i;
      }
    }
    if (closestIdx >= 0 && closestDistPx <= HOVER_DISTANCE_PX) {
      setHoverIndex(closestIdx);
    } else {
      setHoverIndex(null);
    }
  };

  return (
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
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          background: "transparent",
        }}
      />
    </div>
  );
}
