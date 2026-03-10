import { useMemo, useState, type FC } from "react";
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

interface PlotHoverPoint {
  customdata?: unknown;
  pointNumber?: number;
  curveNumber?: number;
}

interface PlotHoverEvent {
  points?: PlotHoverPoint[];
}

const VECTOR_SCALE = 0.25;
const FORCE_SCALE_MULTIPLIER = 18;

function vectorMagnitude(x: number, y: number): number {
  return Math.hypot(x, y);
}

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

function extractHoverIndex(event: unknown, pointsLength: number): number | null {
  const hoverEvent = event as PlotHoverEvent;
  const firstPoint = hoverEvent?.points?.[0];
  if (!firstPoint) return null;
  let candidateIndex: number | null = null;
  if (typeof firstPoint.customdata === "number" && Number.isInteger(firstPoint.customdata)) {
    candidateIndex = firstPoint.customdata;
  } else if (
    Array.isArray(firstPoint.customdata)
    && typeof firstPoint.customdata[0] === "number"
    && Number.isInteger(firstPoint.customdata[0])
  ) {
    candidateIndex = firstPoint.customdata[0];
  } else if (typeof firstPoint.pointNumber === "number" && Number.isInteger(firstPoint.pointNumber)) {
    candidateIndex = firstPoint.pointNumber;
  }
  if (candidateIndex == null) return null;
  if (candidateIndex < 0 || candidateIndex >= pointsLength) return null;
  return candidateIndex;
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
}: TrajectoryChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const x = points.map((p) => p.x);
  const y = points.map((p) => p.y);
  const hoveredPoint =
    hoverIndex != null && hoverIndex >= 0 && hoverIndex < points.length
      ? points[hoverIndex]
      : null;

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

  data.push({
    x,
    y,
    type: "scatter",
    mode: "lines",
    line: { color: "rgba(0,0,0,0)", width: 16 },
    name: "Hover capture",
    showlegend: false,
    customdata: points.map((_, idx) => idx),
    hovertemplate: "<extra></extra>",
  });

  if (hoveredPoint) {
    data.push({
      x: [hoveredPoint.x],
      y: [hoveredPoint.y],
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
    if (!hoveredPoint) return nextShapes;

    const axisSpan = Math.max(1, Math.min(xRange[1] - xRange[0], yRange[1] - yRange[0]));
    const maxVectorLength = axisSpan * 0.22;
    const minVectorLength = axisSpan * 0.03;

    const velocity = scaleVector(hoveredPoint.vx, hoveredPoint.vy, VECTOR_SCALE, maxVectorLength, minVectorLength);
    const drag = scaleVector(
      hoveredPoint.dragX,
      hoveredPoint.dragY,
      VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
      maxVectorLength,
      minVectorLength,
    );
    const magnus = scaleVector(
      hoveredPoint.magnusX,
      hoveredPoint.magnusY,
      VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
      maxVectorLength,
      minVectorLength,
    );
    const gravity = scaleVector(
      hoveredPoint.gravX,
      hoveredPoint.gravY,
      VECTOR_SCALE * FORCE_SCALE_MULTIPLIER,
      maxVectorLength,
      minVectorLength,
    );

    nextShapes.push(
      ...buildArrowShapes(hoveredPoint.x, hoveredPoint.y, velocity.dx, velocity.dy, "#22c55e"),
      ...buildArrowShapes(hoveredPoint.x, hoveredPoint.y, drag.dx, drag.dy, "#ef4444"),
      ...buildArrowShapes(hoveredPoint.x, hoveredPoint.y, magnus.dx, magnus.dy, "#a855f7"),
      ...buildArrowShapes(hoveredPoint.x, hoveredPoint.y, gravity.dx, gravity.dy, "#3b82f6"),
    );
    return nextShapes;
  }, [hit, hoveredPoint, targetSize, targetX, targetY, xRange, yRange]);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", display: "flex" }}>
      <Plot
        data={data}
        onHover={(event) => {
          setHoverIndex(extractHoverIndex(event, points.length));
        }}
        onUnhover={() => setHoverIndex(null)}
        layout={{
          margin: { t: 24, r: 24, b: 40, l: 48 },
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
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          minWidth: 0,
          maxWidth: "calc(100% - 24px)",
          padding: "0.6rem 0.75rem",
          borderRadius: 8,
          background: "rgba(17, 24, 39, 0.82)",
          color: "#e5e7eb",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: "0.82rem",
          lineHeight: 1.45,
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          overflow: "hidden",
          zIndex: 5,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "0.25rem", color: "#f9fafb" }}>Data HUD</div>
        {hoveredPoint ? (
          <>
            <div>pos  = ({hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)}) m</div>
            <div>vel  = ({hoveredPoint.vx.toFixed(2)}, {hoveredPoint.vy.toFixed(2)}) m/s</div>
            <div>|v|  = {vectorMagnitude(hoveredPoint.vx, hoveredPoint.vy).toFixed(2)} m/s</div>
            <div>|drag|   = {vectorMagnitude(hoveredPoint.dragX, hoveredPoint.dragY).toFixed(3)} N</div>
            <div>|magnus| = {vectorMagnitude(hoveredPoint.magnusX, hoveredPoint.magnusY).toFixed(3)} N</div>
            <div>|gravity|= {vectorMagnitude(hoveredPoint.gravX, hoveredPoint.gravY).toFixed(3)} N</div>
          </>
        ) : (
          <div style={{ color: "#cbd5e1" }}>Hover the current trajectory to inspect vectors.</div>
        )}
        <div
          style={{
            marginTop: "0.45rem",
            paddingTop: "0.35rem",
            borderTop: "1px solid rgba(148,163,184,0.35)",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.15rem 0.45rem",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#22c55e", fontWeight: 700 }}>→</span>
          <span>Velocity</span>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>→</span>
          <span>Drag force</span>
          <span style={{ color: "#a855f7", fontWeight: 700 }}>→</span>
          <span>Magnus force</span>
          <span style={{ color: "#3b82f6", fontWeight: 700 }}>→</span>
          <span>Gravity force</span>
        </div>
      </div>
    </div>
  );
}
