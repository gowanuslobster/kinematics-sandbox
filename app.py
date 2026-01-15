"""Streamlit app for Kinematics Sandbox - Interactive projectile motion visualization."""

import streamlit as st
from physics_engine import Projectile
from visualizer import create_trajectory_plot

# Page configuration
st.set_page_config(
    page_title="Kinematics Sandbox",
    page_icon="🚀",
    layout="wide",
)

# Title
st.title("🚀 Kinematics Sandbox")
st.markdown("**Explore projectile motion with interactive controls!**")

# Sidebar controls
st.sidebar.header("Launch Parameters")

v0 = st.sidebar.slider(
    "Initial Velocity (v₀)",
    min_value=0.0,
    max_value=100.0,
    value=30.0,
    step=1.0,
    help="Initial speed of the projectile in m/s",
)

theta = st.sidebar.slider(
    "Launch Angle (θ)",
    min_value=0.0,
    max_value=90.0,
    value=45.0,
    step=1.0,
    help="Launch angle measured from horizontal in degrees",
)

g = st.sidebar.slider(
    "Gravity (g)",
    min_value=0.0,
    max_value=20.0,
    value=9.81,
    step=0.1,
    help="Acceleration due to gravity in m/s²",
)

# Create projectile
projectile = Projectile(v0=v0, theta=theta, g=g)

# Calculate key metrics
time_of_flight = projectile.time_of_flight()
max_height = projectile.max_height()
range_val = projectile.range()

# Display equations section
st.header("📐 Core Equations")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("**Horizontal Position:**")
    st.latex(r"x(t) = v_0 \cos(\theta) \cdot t")

with col2:
    st.markdown("**Vertical Position:**")
    st.latex(r"y(t) = v_0 \sin(\theta) \cdot t - \frac{1}{2}gt^2")

with col3:
    st.markdown("**Time of Flight:**")
    st.latex(r"T = \frac{2v_0 \sin(\theta)}{g}")

col4, col5, col6 = st.columns(3)

with col4:
    st.markdown("**Maximum Height:**")
    st.latex(r"H_{max} = \frac{(v_0 \sin(\theta))^2}{2g}")

with col5:
    st.markdown("**Range:**")
    st.latex(r"R = \frac{v_0^2 \sin(2\theta)}{g}")

with col6:
    st.markdown("**Initial Velocity Components:**")
    st.latex(r"v_{0x} = v_0 \cos(\theta)")
    st.latex(r"v_{0y} = v_0 \sin(\theta)")

# Visualization
st.header("📊 Trajectory Visualization")
fig = create_trajectory_plot(projectile)
st.plotly_chart(fig, width="stretch")

# Results section
st.header("📈 Results")

col7, col8, col9, col10 = st.columns(4)

with col7:
    st.metric("Time of Flight", f"{time_of_flight:.2f} s")

with col8:
    st.metric("Maximum Height", f"{max_height:.2f} m")

with col9:
    st.metric("Range", f"{range_val:.2f} m")

with col10:
    st.metric("Initial Speed", f"{v0:.2f} m/s")

# What happened section
st.header("💡 What Happened?")

# Generate explanation
if v0 == 0:
    explanation = "The projectile has no initial velocity, so it doesn't move! Increase the initial velocity to see projectile motion."
elif theta == 0:
    explanation = f"""
    The projectile was launched horizontally (at 0°). 
    - It travels horizontally for **{range_val:.2f} meters** before hitting the ground.
    - The maximum height is **0 meters** since it was launched horizontally.
    - It takes **{time_of_flight:.2f} seconds** to hit the ground.
    - Since there's no upward component, gravity pulls it straight down!
    """
elif theta == 90:
    explanation = f"""
    The projectile was launched straight up (at 90°)! 
    - It reaches a maximum height of **{max_height:.2f} meters**.
    - It takes **{time_of_flight:.2f} seconds** to go up and come back down.
    - The range is **0 meters** because it goes straight up and down - no horizontal motion!
    - This is like throwing a ball straight up in the air.
    """
elif theta < 45:
    explanation = f"""
    The projectile was launched at a **shallow angle** ({theta}°).
    - It travels **{range_val:.2f} meters** horizontally before landing.
    - It reaches a maximum height of **{max_height:.2f} meters**.
    - The flight lasts **{time_of_flight:.2f} seconds**.
    - Shallow angles favor horizontal distance over height - think of a baseball sliding along the ground!
    """
elif theta == 45:
    explanation = f"""
    The projectile was launched at the **optimal angle** (45°) for maximum range!
    - It travels **{range_val:.2f} meters** horizontally - this is the farthest it can go with this initial velocity.
    - It reaches a maximum height of **{max_height:.2f} meters**.
    - The flight lasts **{time_of_flight:.2f} seconds**.
    - At 45°, the horizontal and vertical components are balanced perfectly for maximum distance!
    """
else:  # theta > 45
    explanation = f"""
    The projectile was launched at a **steep angle** ({theta}°).
    - It travels **{range_val:.2f} meters** horizontally before landing.
    - It reaches a maximum height of **{max_height:.2f} meters** - quite high!
    - The flight lasts **{time_of_flight:.2f} seconds**.
    - Steep angles favor height over distance - think of shooting a basketball high into the air!
    """

# Add general physics explanation
explanation += f"""

**The Physics Behind It:**
- The projectile follows a **parabolic path** due to gravity pulling it downward.
- Horizontal motion is constant (no acceleration), so it moves at **{projectile.v0x:.2f} m/s** horizontally.
- Vertical motion is affected by gravity, starting upward at **{projectile.v0y:.2f} m/s** and slowing down until it reaches the peak, then accelerating downward.
- Gravity ({g} m/s²) acts downward, causing the curved trajectory you see above.
"""

st.markdown(explanation)

# Footer
st.markdown("---")
st.markdown(
    "*Kinematics Sandbox - Learn projectile motion through interactive exploration!*"
)
