"""Visualization module for projectile trajectories using Plotly."""

import numpy as np
import plotly.graph_objects as go
from plotly.graph_objects import Figure

from physics_engine import Projectile


def create_trajectory_plot(
    projectile: Projectile,
    show_vacuum: bool = False,
    target_x: float | None = None,
    target_y: float | None = None,
    target_diameter: float = 3.0,
    target_hit: bool = False,
    ghost_path: tuple[np.ndarray, np.ndarray] | None = None,
    x_range: tuple[float, float] | None = None,
    y_range: tuple[float, float] | None = None,
) -> Figure:
    """
    Create a styled Plotly figure showing the projectile trajectory.

    Parameters
    ----------
    projectile : Projectile
        The projectile object to visualize
    show_vacuum : bool
        If True, also show the vacuum trajectory for comparison
    target_x : float | None
        X coordinate of the target (optional)
    target_y : float | None
        Y coordinate of the target (optional)
    target_diameter : float
        Diameter of the target in meters (default: 3.0)
    target_hit : bool
        Whether the target was hit (default: False)
    ghost_path : tuple[np.ndarray, np.ndarray] | None
        Previous trajectory to show as ghost path (optional)
    x_range : tuple[float, float] | None
        Fixed x-axis range (min, max) (optional)
    y_range : tuple[float, float] | None
        Fixed y-axis range (min, max) (optional)

    Returns
    -------
    Figure
        A Plotly figure object with the trajectory plot
    """
    # Create the figure
    fig = go.Figure()

    # Add ghost path (previous trajectory) if provided
    if ghost_path is not None:
        x_ghost, y_ghost = ghost_path
        if len(x_ghost) > 0 and len(y_ghost) > 0:
            fig.add_trace(
                go.Scatter(
                    x=x_ghost,
                    y=y_ghost,
                    mode="lines",
                    name="Previous Path",
                    line=dict(color="#cccccc", width=2, dash="dot"),
                    opacity=0.6,
                    hovertemplate="<b>Previous Path</b><br>" + "x: %{x:.2f} m<br>" + "y: %{y:.2f} m<extra></extra>",
                )
            )

    # Add vacuum trajectory if requested
    if show_vacuum:
        x_vacuum, y_vacuum = projectile.trajectory_vacuum(num_points=500)
        fig.add_trace(
            go.Scatter(
                x=x_vacuum,
                y=y_vacuum,
                mode="lines",
                name="Vacuum Path",
                line=dict(color="#888888", width=2, dash="dash"),
                hovertemplate="<b>Vacuum Path</b><br>" + "x: %{x:.2f} m<br>" + "y: %{y:.2f} m<extra></extra>",
            )
        )

    # Add actual trajectory (with or without air resistance)
    x, y = projectile.trajectory(num_points=500)
    trajectory_name = "Air Resistance Path" if projectile.cd > 0 else "Trajectory"
    line_color = "#1f77b4" if projectile.cd == 0 else "#ff7f0e"

    fig.add_trace(
        go.Scatter(
            x=x,
            y=y,
            mode="lines",
            name=trajectory_name,
            line=dict(color=line_color, width=3),
            hovertemplate="<b>" + trajectory_name + "</b><br>" + "x: %{x:.2f} m<br>" + "y: %{y:.2f} m<extra></extra>",
        )
    )

    # Add launch point
    fig.add_trace(
        go.Scatter(
            x=[0],
            y=[0],
            mode="markers",
            name="Launch Point",
            marker=dict(size=12, color="green", symbol="circle"),
            hovertemplate="<b>Launch Point</b><br>" + "x: 0 m<br>" + "y: 0 m<extra></extra>",
        )
    )

    # Add landing point for actual trajectory
    if len(x) > 0 and len(y) > 0:
        range_val = x[-1]
        fig.add_trace(
            go.Scatter(
                x=[range_val],
                y=[0],
                mode="markers",
                name="Landing Point",
                marker=dict(size=12, color="red", symbol="x"),
                hovertemplate=f"<b>Landing Point</b><br>x: {range_val:.2f} m<br>y: 0 m<extra></extra>",
            )
        )

    # Add max height point
    if projectile.cd == 0:
        # Use analytical solution
        max_height = projectile.max_height()
        t_max_height = projectile.v0y / projectile.g
        x_max_height = projectile.v0x * t_max_height
    else:
        # Find max height from trajectory
        if len(y) > 0:
            max_height = np.max(y)
            max_idx = np.argmax(y)
            x_max_height = x[max_idx] if max_idx < len(x) else 0
        else:
            max_height = 0
            x_max_height = 0

    if max_height > 0:
        fig.add_trace(
            go.Scatter(
                x=[x_max_height],
                y=[max_height],
                mode="markers",
                name="Max Height",
                marker=dict(size=12, color="orange", symbol="diamond"),
                hovertemplate=f"<b>Max Height</b><br>x: {x_max_height:.2f} m<br>y: {max_height:.2f} m<extra></extra>",
            )
        )

    # Add target if specified
    if target_x is not None and target_y is not None:
        # Choose color based on hit status
        target_color = "red" if target_hit else "black"
        # Add center marker
        fig.add_trace(
            go.Scatter(
                x=[target_x],
                y=[target_y],
                mode="markers",
                name="Target Center",
                marker=dict(size=8, color=target_color, symbol="circle"),
                hovertemplate=f"<b>Target</b><br>x: {target_x:.2f} m<br>y: {target_y:.2f} m<br>diameter: {target_diameter:.2f} m<extra></extra>",
                showlegend=False,
            )
        )

    # Use fixed ranges if provided, otherwise calculate dynamically
    if x_range is not None and y_range is not None:
        x_min, x_max = x_range
        y_min, y_max = y_range
    else:
        # Calculate axis ranges based on target location + margin
        # If target is specified, use it to set the scale; otherwise use defaults
        margin_x = 100.0  # meters margin
        margin_y = 50.0   # meters margin
        x_min = 0.0
        y_min = 0.0

        if target_x is not None and target_y is not None:
            # Calculate ranges to include target with margin
            # Always include launch point (0, 0) and target (including its diameter)
            target_radius = target_diameter / 2.0
            x_max = max(target_x + target_radius + margin_x, margin_x, 200.0)  # At least 200m wide
            y_max = max(target_y + target_radius + margin_y, margin_y, 100.0)  # At least 100m tall
            
            # Also consider trajectory extent
            if len(x) > 0 and len(y) > 0:
                x_max = max(x_max, np.max(x) + margin_x)
                y_max = max(y_max, np.max(y) + margin_y)
        else:
            # Default ranges when no target
            x_max = 1200.0  # meters
            y_max = 600.0   # meters
            
            # Still consider trajectory extent
            if len(x) > 0 and len(y) > 0:
                x_max = max(x_max, np.max(x) + margin_x)
                y_max = max(y_max, np.max(y) + margin_y)

    # Add target circle shape if target is specified
    shapes = []
    if target_x is not None and target_y is not None:
        target_radius = target_diameter / 2.0
        # Choose color based on hit status
        target_color = "red" if target_hit else "black"
        target_fill = "rgba(255, 0, 0, 0.2)" if target_hit else "rgba(0, 0, 0, 0.1)"
        shapes.append(
            dict(
                type="circle",
                xref="x",
                yref="y",
                x0=target_x - target_radius,
                y0=target_y - target_radius,
                x1=target_x + target_radius,
                y1=target_y + target_radius,
                line=dict(color=target_color, width=2),
                fillcolor=target_fill,
            )
        )

    # Update layout
    fig.update_layout(
        title={
            "text": "Projectile Trajectory",
            "x": 0.5,
            "xanchor": "center",
            "font": {"size": 24},
        },
        xaxis_title="Horizontal Distance (m)",
        yaxis_title="Height (m)",
        xaxis=dict(
            showgrid=True,
            gridcolor="lightgray",
            gridwidth=1,
            zeroline=True,
            zerolinecolor="black",
            zerolinewidth=2,
            range=[x_min, x_max],
            fixedrange=True,  # Prevent zoom/pan
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor="lightgray",
            gridwidth=1,
            zeroline=True,
            zerolinecolor="black",
            zerolinewidth=2,
            range=[y_min, y_max],
            fixedrange=True,  # Prevent zoom/pan
        ),
        hovermode="closest",
        template="plotly_white",
        height=600,
        showlegend=True,
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.8)"),
        shapes=shapes,
    )

    return fig
