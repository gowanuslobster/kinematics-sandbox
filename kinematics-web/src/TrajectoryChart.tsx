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
}

export function TrajectoryChart({ points }: TrajectoryChartProps) {
  const x = points.map((p) => p.x);
  const y = points.map((p) => p.y);

  return (
    <Plot
      data={[
        {
          x,
          y,
          type: "scatter",
          mode: "lines",
          line: { shape: "spline" },
        },
      ]}
      layout={{
        margin: { t: 24, r: 24, b: 40, l: 48 },
        xaxis: {
          title: "Distance",
          showgrid: true,
        },
        yaxis: {
          title: "Height",
          showgrid: true,
        },
        showlegend: false,
      }}
      config={{ responsive: true }}
      style={{ width: "100%", minHeight: 300 }}
    />
  );
}
