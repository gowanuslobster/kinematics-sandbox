"""Streamlit app for Kinematics Sandbox - Interactive projectile motion visualization."""

import numpy as np
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

# Earth's atmosphere drag coefficient for reference
EARTH_DRAG = 0.0022  # kg/m for a 10cm diameter, 1kg smooth sphere at STP

cd = st.sidebar.slider(
    "Air Resistance/Drag (C_d)",
    min_value=0.0,
    max_value=EARTH_DRAG * 10.0,  # 10x Earth's atmosphere
    value=EARTH_DRAG,  # Start at Earth's atmosphere
    step=0.0001,
    format="%.4f",
    help=f"Drag coefficient in kg/m. Earth's atmosphere ≈ {EARTH_DRAG:.4f} kg/m (for a 10cm, 1kg sphere).",
)

# Show Earth's drag reference marker
st.sidebar.caption(f"🌍 Earth's atmosphere: {EARTH_DRAG:.4f} kg/m")

# Target settings
st.sidebar.header("Target Settings")

target_x = st.sidebar.slider(
    "Target X",
    min_value=0.0,
    max_value=1200.0,
    value=100.0,
    step=10.0,
    help="X coordinate of the target in meters",
)

target_y = st.sidebar.slider(
    "Target Y",
    min_value=0.0,
    max_value=600.0,
    value=50.0,
    step=10.0,
    help="Y coordinate of the target in meters",
)

target_diameter = st.sidebar.slider(
    "Target Diameter",
    min_value=0.5,
    max_value=50.0,
    value=3.0,
    step=0.5,
    help="Diameter of the target in meters",
)

# Animation settings
st.sidebar.header("Display Settings")

animate_launch = st.sidebar.checkbox(
    "Animate Launch",
    value=False,
    help="If enabled, the trajectory will animate over time. If disabled, the full path appears instantly.",
)

# Initialize session state for ghost path (previous trajectory)
if "prev_trajectory" not in st.session_state:
    st.session_state.prev_trajectory = None
if "prev_params" not in st.session_state:
    st.session_state.prev_params = None

# Check if parameters changed (to show ghost path)
current_params = (v0, theta, g, cd, target_x, target_y)
params_changed = st.session_state.prev_params != current_params

# Create projectile with air resistance
projectile = Projectile(v0=v0, theta=theta, g=g, cd=cd)

# Create vacuum projectile for comparison
projectile_vacuum = Projectile(v0=v0, theta=theta, g=g, cd=0.0)

# Calculate fixed axis ranges based on maximum possible range and target
# Default axis maximums
default_x_max = 200.0  # meters
default_y_max = 100.0  # meters

margin_x = 150.0  # meters margin
margin_y = 75.0   # meters margin

# Calculate theoretical maximum range and height
max_v0 = 100.0  # From slider max
min_g = 0.1  # From slider min (but use actual g if > 0.1)
effective_g = max(g, 0.1)  # Avoid division by zero
max_range_theoretical = (max_v0 ** 2) / effective_g  # At 45 degrees
max_height_theoretical = (max_v0 ** 2) / (2 * effective_g)  # At 90 degrees

# Consider target position and theoretical maximums
if target_x is not None and target_y is not None:
    target_radius = target_diameter / 2.0
    x_max = max(
        default_x_max,
        max_range_theoretical + margin_x,
        target_x + target_radius + margin_x,
    )
    y_max = max(
        default_y_max,
        max_height_theoretical + margin_y,
        target_y + target_radius + margin_y,
    )
else:
    x_max = max(default_x_max, max_range_theoretical + margin_x)
    y_max = max(default_y_max, max_height_theoretical + margin_y)

# Fixed axis ranges
x_range = (0.0, x_max)
y_range = (0.0, y_max)

# Calculate key metrics (using vacuum solution for display)
time_of_flight = projectile_vacuum.time_of_flight()
max_height = projectile_vacuum.max_height()
range_val = projectile_vacuum.range()

# Calculate actual metrics with air resistance if applicable
# Use high resolution for accurate metrics
if cd > 0:
    x_actual, y_actual = projectile.trajectory(num_points=500)
    if len(x_actual) > 0 and len(y_actual) > 0:
        range_actual = x_actual[-1]
        max_height_actual = np.max(y_actual) if len(y_actual) > 0 else 0
        # Estimate time of flight from trajectory
        time_actual = len(x_actual) * 0.01  # Approximate from simulation
    else:
        range_actual = 0
        max_height_actual = 0
        time_actual = 0
else:
    range_actual = range_val
    max_height_actual = max_height
    time_actual = time_of_flight

# Display equations section
st.header("📐 Core Equations")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("**Horizontal Position (Vacuum):**")
    st.latex(r"x(t) = v_0 \cos(\theta) \cdot t")

with col2:
    st.markdown("**Vertical Position (Vacuum):**")
    st.latex(r"y(t) = v_0 \sin(\theta) \cdot t - \frac{1}{2}gt^2")

with col3:
    st.markdown("**Time of Flight (Vacuum):**")
    st.latex(r"T = \frac{2v_0 \sin(\theta)}{g}")

col4, col5, col6 = st.columns(3)

with col4:
    st.markdown("**Maximum Height (Vacuum):**")
    st.latex(r"H_{max} = \frac{(v_0 \sin(\theta))^2}{2g}")

with col5:
    st.markdown("**Range (Vacuum):**")
    st.latex(r"R = \frac{v_0^2 \sin(2\theta)}{g}")

with col6:
    st.markdown("**Drag Force:**")
    st.latex(r"F_d = -C_d \cdot v^2 \cdot \frac{\vec{v}}{|\vec{v}|}")

# Hit detection (before visualization so we can color the target)
hit = False
if target_x is not None and target_y is not None:
    # Use target radius (diameter/2) as the hit detection threshold
    hit = projectile.check_hit(target_x, target_y, threshold=target_diameter / 2.0)

# Visualization
st.header("📊 Trajectory Visualization")
show_vacuum = cd > 0  # Show vacuum path when air resistance is enabled

# Get ghost path if parameters changed
ghost_path = None
if params_changed and st.session_state.prev_trajectory is not None:
    ghost_path = st.session_state.prev_trajectory

# Generate current trajectory with high resolution for smooth display
num_points = 500  # High resolution for smooth curves
x_current, y_current = projectile.trajectory(num_points=num_points)

# Store current trajectory for next iteration (as ghost path)
st.session_state.prev_trajectory = (x_current.copy(), y_current.copy())
st.session_state.prev_params = current_params

# Create visualization
if animate_launch and len(x_current) > 0:
    # Animated path using Plotly frames
    chart_placeholder = st.empty()
    num_frames = min(len(x_current), 50)  # Limit frames for performance
    frame_indices = np.linspace(0, len(x_current) - 1, num_frames, dtype=int)
    
    # Create a simple wrapper class for partial trajectories
    class PartialProjectile:
        def __init__(self, proj, x_part, y_part):
            self.cd = proj.cd
            self.v0x = proj.v0x
            self.v0y = proj.v0y
            self.g = proj.g
            self.x_part = x_part
            self.y_part = y_part
        
        def trajectory(self, num_points=100):
            return self.x_part, self.y_part
        
        def trajectory_vacuum(self, num_points=100):
            return self.x_part, self.y_part
    
    # Show progressive frames quickly
    for i in frame_indices:
        x_partial = x_current[:i + 1]
        y_partial = y_current[:i + 1]
        
        temp_proj = PartialProjectile(projectile, x_partial, y_partial)
        
        fig = create_trajectory_plot(
            temp_proj,
            show_vacuum=show_vacuum,
            target_x=target_x,
            target_y=target_y,
            target_diameter=target_diameter,
            target_hit=False,  # Don't check hit during animation
            ghost_path=ghost_path,
            x_range=x_range,
            y_range=y_range,
        )
        chart_placeholder.plotly_chart(fig, width="stretch", use_container_width=True)
    
    # Final frame with full trajectory and hit detection
    fig = create_trajectory_plot(
        projectile,
        show_vacuum=show_vacuum,
        target_x=target_x,
        target_y=target_y,
        target_diameter=target_diameter,
        target_hit=hit,
        ghost_path=ghost_path,
        x_range=x_range,
        y_range=y_range,
    )
    chart_placeholder.plotly_chart(fig, width="stretch", use_container_width=True)
else:
    # Instant full trajectory
    fig = create_trajectory_plot(
        projectile,
        show_vacuum=show_vacuum,
        target_x=target_x,
        target_y=target_y,
        target_diameter=target_diameter,
        target_hit=hit,
        ghost_path=ghost_path,
        x_range=x_range,
        y_range=y_range,
    )
    st.plotly_chart(fig, width="stretch")

# Hit detection and feedback
if target_x is not None and target_y is not None:
    
    if hit:
        st.success("🎯 **TARGET HIT!**", icon="🎯")
    else:
        # Get trajectory to find closest point and provide hints
        x_traj, y_traj = projectile.trajectory(num_points=200)
        if len(x_traj) > 0 and len(y_traj) > 0:
            # Find closest point on trajectory to target
            distances = np.sqrt((x_traj - target_x) ** 2 + (y_traj - target_y) ** 2)
            min_idx = np.argmin(distances)
            closest_x = x_traj[min_idx]
            closest_y = y_traj[min_idx]
            final_x = x_traj[-1]
            
            # Provide helpful hints based on position
            if final_x < target_x:
                st.warning("💡 **Too short!** The projectile lands before reaching the target. Try increasing the initial velocity or adjusting the angle.")
            elif final_x > target_x:
                st.warning("💡 **Too far!** The projectile overshoots the target. Try decreasing the initial velocity or adjusting the angle.")
            else:
                # Check if we're too high or too low
                if closest_y < target_y:
                    st.warning("💡 **Too low!** The trajectory passes below the target. Try increasing the launch angle.")
                else:
                    st.warning("💡 **Too high!** The trajectory passes above the target. Try decreasing the launch angle.")

# Results section
st.header("📈 Results")

if cd > 0:
    col7, col8, col9, col10 = st.columns(4)

    with col7:
        st.metric("Time of Flight (Vacuum)", f"{time_of_flight:.2f} s")
        st.metric("Time of Flight (Actual)", f"{time_actual:.2f} s", delta=f"{time_actual - time_of_flight:.2f} s")

    with col8:
        st.metric("Maximum Height (Vacuum)", f"{max_height:.2f} m")
        st.metric("Maximum Height (Actual)", f"{max_height_actual:.2f} m", delta=f"{max_height_actual - max_height:.2f} m")

    with col9:
        st.metric("Range (Vacuum)", f"{range_val:.2f} m")
        st.metric("Range (Actual)", f"{range_actual:.2f} m", delta=f"{range_actual - range_val:.2f} m")

    with col10:
        st.metric("Initial Speed", f"{v0:.2f} m/s")
        st.metric("Drag Coefficient", f"{cd:.4f} kg/m")
else:
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
    if cd > 0:
        explanation = f"""
        The projectile was launched horizontally (at 0°) with air resistance (C_d = {cd:.4f} kg/m).
        - **Vacuum path**: It would travel **{range_val:.2f} meters** horizontally.
        - **Actual path**: It travels **{range_actual:.2f} meters** - air resistance reduces the range!
        - The maximum height is **0 meters** since it was launched horizontally.
        - Air resistance slows down the projectile, reducing both speed and distance traveled.
        """
    else:
        explanation = f"""
        The projectile was launched horizontally (at 0°). 
        - It travels horizontally for **{range_val:.2f} meters** before hitting the ground.
        - The maximum height is **0 meters** since it was launched horizontally.
        - It takes **{time_of_flight:.2f} seconds** to hit the ground.
        - Since there's no upward component, gravity pulls it straight down!
        """
elif theta == 90:
    if cd > 0:
        explanation = f"""
        The projectile was launched straight up (at 90°) with air resistance (C_d = {cd:.4f} kg/m)!
        - **Vacuum path**: It would reach **{max_height:.2f} meters** and take **{time_of_flight:.2f} seconds**.
        - **Actual path**: It reaches **{max_height_actual:.2f} meters** - air resistance reduces the height!
        - The range is **0 meters** because it goes straight up and down - no horizontal motion!
        - Air resistance opposes the upward motion, reducing the maximum height reached.
        """
    else:
        explanation = f"""
        The projectile was launched straight up (at 90°)! 
        - It reaches a maximum height of **{max_height:.2f} meters**.
        - It takes **{time_of_flight:.2f} seconds** to go up and come back down.
        - The range is **0 meters** because it goes straight up and down - no horizontal motion!
        - This is like throwing a ball straight up in the air.
        """
elif theta < 45:
    if cd > 0:
        explanation = f"""
        The projectile was launched at a **shallow angle** ({theta}°) with air resistance (C_d = {cd:.4f} kg/m).
        - **Vacuum path**: It would travel **{range_val:.2f} meters** and reach **{max_height:.2f} meters**.
        - **Actual path**: It travels **{range_actual:.2f} meters** and reaches **{max_height_actual:.2f} meters**.
        - Air resistance significantly reduces both range and height for shallow angles!
        - The drag force opposes motion in both horizontal and vertical directions.
        """
    else:
        explanation = f"""
        The projectile was launched at a **shallow angle** ({theta}°).
        - It travels **{range_val:.2f} meters** horizontally before landing.
        - It reaches a maximum height of **{max_height:.2f} meters**.
        - The flight lasts **{time_of_flight:.2f} seconds**.
        - Shallow angles favor horizontal distance over height - think of a baseball sliding along the ground!
        """
elif theta == 45:
    if cd > 0:
        explanation = f"""
        The projectile was launched at the **optimal angle** (45°) for maximum range in vacuum, with air resistance (C_d = {cd:.4f} kg/m)!
        - **Vacuum path**: It would travel **{range_val:.2f} meters** - the theoretical maximum.
        - **Actual path**: It travels **{range_actual:.2f} meters** - air resistance reduces the range!
        - With air resistance, the optimal angle is actually less than 45°!
        - Air resistance affects the trajectory, making it shorter and steeper.
        """
    else:
        explanation = f"""
        The projectile was launched at the **optimal angle** (45°) for maximum range!
        - It travels **{range_val:.2f} meters** horizontally - this is the farthest it can go with this initial velocity.
        - It reaches a maximum height of **{max_height:.2f} meters**.
        - The flight lasts **{time_of_flight:.2f} seconds**.
        - At 45°, the horizontal and vertical components are balanced perfectly for maximum distance!
        """
else:  # theta > 45
    if cd > 0:
        explanation = f"""
        The projectile was launched at a **steep angle** ({theta}°) with air resistance (C_d = {cd:.4f} kg/m).
        - **Vacuum path**: It would travel **{range_val:.2f} meters** and reach **{max_height:.2f} meters**.
        - **Actual path**: It travels **{range_actual:.2f} meters** and reaches **{max_height_actual:.2f} meters**.
        - Steep angles favor height over distance, but air resistance reduces both!
        - The drag force is most significant when the projectile is moving fastest.
        """
    else:
        explanation = f"""
        The projectile was launched at a **steep angle** ({theta}°).
        - It travels **{range_val:.2f} meters** horizontally before landing.
        - It reaches a maximum height of **{max_height:.2f} meters** - quite high!
        - The flight lasts **{time_of_flight:.2f} seconds**.
        - Steep angles favor height over distance - think of shooting a basketball high into the air!
        """

# Add general physics explanation
if cd > 0:
    explanation += """

**The Physics Behind It:**
- The projectile follows a **parabolic path in vacuum**, but air resistance creates a **shorter, steeper trajectory**.
- Air resistance (drag) is proportional to the square of velocity: F_d = -C_d · v²
- The drag force opposes motion in both horizontal and vertical directions, reducing speed over time.
- We use **Symplectic Euler-Cromer numerical integration** to solve the equations since there's no closed-form solution with air resistance.
- Notice how the actual path (orange) is always shorter than the vacuum path (gray dashed line)!
"""
else:
    explanation += """

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
