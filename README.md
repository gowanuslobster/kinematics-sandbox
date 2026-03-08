# Kinematics Sandbox

An interactive projectile-motion playground for students.

The project includes:

- **React app (primary):** modern UI for experimentation, challenge mode, and trajectory comparison.
- **Streamlit app (legacy):** earlier Python UI kept for reference.

If you are new here, start with the React app.

---

## Quick start

### 1) Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.13+** (only needed if you want to run the legacy Streamlit app)
- **uv** for Python environment/package management

### 2) Run the React app

From the repository root:

1. `cd kinematics-web`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173`

You should see the control panel on the left and the trajectory chart on the right.

---

## Intro Tutorial

This is a simple guided flow for first-time users.

### Step A: Learn the baseline shot

1. Stay in **Live Mode**.
2. Set:
   - Initial Velocity = `50`
   - Launch Angle = `45`
   - Gravity = `9.81`
   - Drag Coefficient = `0.50`
3. Observe the current trajectory and target.

### Step B: Compare two trajectories

1. Click **📌 Pin Current Trajectory**.
2. Change 1-2 controls (for example: velocity and angle).
3. You now see:
   - **Pinned trajectory** (reference shot)
   - **Current trajectory** (new shot)
4. Hover either line to see a popup with that trajectory's settings.

This makes side-by-side reasoning easier (same target, different settings).

### Step C: Try challenge mode

1. Switch to **Challenge Mode**.
2. Adjust parameters before firing.
3. Click **Fire!** to animate a single attempt.
4. Check whether you hit the target.

### Step D: Explore physics intuition

Try these mini experiments:

- Set launch angle near **45°** and compare range.
- Increase **drag** and watch trajectory shorten/flatten.
- Use **spin** to explore lift effects.
- Set **air density** to `0` to simulate vacuum-like behavior.

---

## Controls overview

- **Mode:** Live vs Challenge
- **Launch:** velocity, angle, gravity
- **Aerodynamics:** drag coefficient, spin, air density
- **Ball properties:** mass, radius, presets
- **Target:** x/y position and diameter
- **Chart options:** axis bounds
- **Comparison:** pin/clear a reference trajectory (one pinned + one current)

---

## Troubleshooting

### React app does not start

- Confirm Node/npm versions.
- Re-run `npm install` in `kinematics-web`.
- Ensure port `5173` is free, or run `npm run dev -- --port <new-port>`.

### Build/lint notes

There are known pre-existing issues in Storybook/example files:

- `npm run build` may fail on TypeScript checks in:
  - `src/stories/Button.tsx`
  - `src/stories/Header.tsx`
- `npm run lint` may report pre-existing lint findings.

The core app still runs in dev mode.

---

## Legacy Streamlit app (optional)

Run from repo root:

1. `uv run streamlit run app.py --server.headless true`
2. Open `http://localhost:8501`

This path is maintained for compatibility, but React is the primary experience.

---

## Developer notes

### High-level layout

- `kinematics-web/` — React + TypeScript + Vite frontend (primary)
  - `src/App.tsx` — main UI and state orchestration
  - `src/physics.ts` — physics simulation and derived metrics
  - `src/TrajectoryChart.tsx` — Plotly trajectory rendering
- `app.py` — Streamlit entrypoint (legacy)
- `physics_engine.py` — Python projectile model (legacy)
- `visualizer.py` — Plotly builder for Streamlit (legacy)

### Common commands

- React dev: `cd kinematics-web && npm run dev`
- React build: `cd kinematics-web && npm run build`
- React lint: `cd kinematics-web && npm run lint`
- Streamlit dev: `uv run streamlit run app.py --server.headless true`
