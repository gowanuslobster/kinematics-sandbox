"""Visualization module for projectile trajectories using Plotly."""

import plotly.graph_objects as go
from plotly.graph_objects import Figure

from physics_engine import Projectile


def create_trajectory_plot(projectile: Projectile) -> Figure:
    """
    Create a styled Plotly figure showing the projectile trajectory.

    Parameters
    ----------
    projectile : Projectile
        The projectile object to visualize

    Returns
    -------
    Figure
        A Plotly figure object with the trajectory plot
    """
    x, y = projectile.trajectory(num_points=200)

    # Create the figure
    fig = go.Figure()

    # Add trajectory line
    fig.add_trace(
        go.Scatter(
            x=x,
            y=y,
            mode="lines",
            name="Trajectory",
            line=dict(color="#1f77b4", width=3),
            hovertemplate="<b>Position</b><br>" + "x: %{x:.2f} m<br>" + "y: %{y:.2f} m<extra></extra>",
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

    # Add landing point
    range_val = projectile.range()
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
    max_height = projectile.max_height()
    t_max_height = projectile.v0y / projectile.g
    x_max_height = projectile.v0x * t_max_height
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
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor="lightgray",
            gridwidth=1,
            zeroline=True,
            zerolinecolor="black",
            zerolinewidth=2,
        ),
        hovermode="closest",
        template="plotly_white",
        height=600,
        showlegend=True,
        legend=dict(x=0.02, y=0.98, bgcolor="rgba(255,255,255,0.8)"),
    )

    return fig
