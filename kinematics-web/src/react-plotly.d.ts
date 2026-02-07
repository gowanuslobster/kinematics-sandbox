declare module "react-plotly.js" {
  import type { ReactElement } from "react";

  interface PlotParams {
    data: object[];
    layout?: object;
    config?: object;
    style?: React.CSSProperties;
  }

  export default function Plot(props: PlotParams): ReactElement;
}
