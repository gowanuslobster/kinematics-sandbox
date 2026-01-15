"""Visualization module for projectile trajectories using Plotly."""

import numpy as np
import plotly.graph_objects as go
from plotly.graph_objects import Figure

from physics_engine import Projectile


def create_trajectory_plot(
    projectile: Projectile, show_vacuum: bool = False
) -> Figure:
    """
    Create a styled Plotly figure showing the projectile trajectory.

    Parameters
    ----------
    projectile : Projectile
        The projectile object to visualize
    show_vacuum : bool
        If True, also show the vacuum trajectory for comparison

    Returns
    -------
    Figure
        A Plotly figure object with the trajectory plot
    """
    # Create the figure
    fig = go.Figure()

    # Add vacuum trajectory if requested
    if show_vacuum:
        x_vacuum, y_vacuum = projectile.trajectory_vacuum(num_points=200)
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
    x, y = projectile.trajectory(num_points=200)
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

    # Calculate maximum possible range and height for fixed axes
    # Max range occurs at θ=45°: R = v₀²/g (with minimum g)
    # Max height occurs at θ=90°: H = v₀²/(2g) (with minimum g)
    # Using slider max values: v₀=100 m/s, g_min=0.1 m/s²
    # R_max ≈ 100,000 m, H_max ≈ 50,000 m (too large for educational purposes)
    # Use reasonable fixed ranges that cover most educational scenarios
    x_max = 1200.0  # meters
    y_max = 600.0   # meters

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
            range=[0, x_max],
            fixedrange=True,  # Prevent zoom/pan
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor="lightgray",
            gridwidth=1,
            zeroline=True,
            zerolinecolor="black",
            zerolinewidth=2,
            range=[0, y_max],
            fixedrange=True,  # Prevent zoom/pan
        ),
        hovermode="closest",
        template="plotly_white",
        height=600,
        showlegend=True,
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.8)"),
    )

    return fig
