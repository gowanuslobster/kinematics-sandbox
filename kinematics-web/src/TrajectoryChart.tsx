import type { FC } from "react";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- no types from package
import PlotLib from "react-plotly.js";

const Plot = PlotLib as FC<{
  data: object[];
  layout?: object;
  config?: object;
  style?: React.CSSProperties;
}>;

export interface TrajectoryPoint {
  x: number;
  y: number;
}

export interface TrajectoryChartProps {
  points: TrajectoryPoint[];
  xRange?: [number, number];
  yRange?: [number, number];
  targetX?: number;
  targetY?: number;
  targetSize?: number;
  hit?: boolean;
  pinnedPath?: TrajectoryPoint[];
  pinnedSettings?: string;
  currentSettings?: string;
  vacuumPath?: TrajectoryPoint[];
}

export function TrajectoryChart({
  points,
  xRange = [0, 100],
  yRange = [0, 50],
  targetX,
  targetY,
  targetSize = 5,
  hit = false,
  pinnedPath,
  pinnedSettings,
  currentSettings,
  vacuumPath,
}: TrajectoryChartProps) {
  const x = points.map((p) => p.x);
  const y = points.map((p) => p.y);

  const targetColor = hit ? "#16a34a" : "#dc2626";
  const buildHoverTemplate = (label: string, settings?: string) => {
    const settingsBlock = settings != null && settings.length > 0
      ? `<br><br><b>Settings</b><br>${settings}`
      : "";
    return `<b>${label}</b><br>x: %{x:.2f} m<br>y: %{y:.2f} m${settingsBlock}<extra></extra>`;
  };

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
      hovertemplate: buildHoverTemplate("Pinned trajectory", pinnedSettings),
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
    });
  }

  data.push({
    x,
    y,
    type: "scatter",
    mode: "lines",
    line: { shape: "spline" },
    name: "Current trajectory",
    hovertemplate: buildHoverTemplate("Current trajectory", currentSettings),
  });

  const shapes =
    targetX != null && targetY != null && targetSize > 0
      ? [
          {
            type: "circle" as const,
            x0: targetX - targetSize,
            y0: targetY - targetSize,
            x1: targetX + targetSize,
            y1: targetY + targetSize,
            line: { color: targetColor, width: 2 },
            fillcolor: targetColor,
            opacity: 0.4,
          },
        ]
      : undefined;

  return (
    <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex" }}>
      <Plot
        data={data}
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
          shapes,
        }}
        config={{ responsive: true }}
        style={{ width: "100%", height: "100%", minHeight: 400 }}
      />
    </div>
  );
}
