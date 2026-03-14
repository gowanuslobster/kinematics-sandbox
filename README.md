# Kinematics Sandbox

Interactive projectile-motion simulator focused on intuition:

- Compare real trajectory vs vacuum behavior
- Explore drag, spin (Magnus), and air density effects
- Tune ball mass/radius or use presets (baseball, ping pong, cannonball)
- Use the **Physics Microscope** to inspect local flow + force vectors
- Practice in **Challenge Mode** with animated shots

Start with the React app. The Streamlit app is legacy.

## What To Try First

1. **Baseline shot**
Set `Initial Velocity = 50`, `Launch Angle = 45`, `Gravity = 9.81`, `Drag = 0.50`.

2. **Pin and compare**
Click `📌 Pin Current Trajectory`, change velocity/angle, compare paths directly.

3. **Spin experiment**
Set spin to `+2600` then `-2600` RPM and watch trajectory bend differently.

4. **Vacuum check**
Set `Air density = 0` and compare against non-zero air density.

5. **Mass sensitivity**
Switch to Ping Pong preset (or lower mass manually) and observe stronger aerodynamic response.

## Quick Start (Users)

Prerequisites:

- Node.js 20+
- npm

Run:

1. `cd kinematics-web`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173`

## Core Features

- **Live Mode**: continuous parameter exploration
- **Challenge Mode**: one-shot animated attempt with hit/miss feedback
- **Pinned trajectory**: keep one reference path while testing changes
- **Ball presets + custom values**: presets switch to `custom` if mass/radius/drag are edited
- **Physics Microscope**:
  - draggable/resizable overlay panel
  - collapsed by default
  - streamline/pressure visualization around ball
  - force/velocity vectors with per-axis components and magnitudes
  - optional `Keep velocity vector horizontal` display-frame toggle

## Troubleshooting

- If dev server does not start: rerun `npm install` in `kinematics-web`.
- If port `5173` is busy: `npm run dev -- --port <new-port>`.
- There are known pre-existing Storybook/type-check caveats in `src/stories/*`; core dev UI works with `npm run dev`.

## Developer Notes

Repository layout:

- `kinematics-web/` - primary React + TypeScript + Vite frontend
  - `src/App.tsx` - app state and controls
  - `src/physics.ts` - simulation model
  - `src/TrajectoryChart.tsx` - trajectory rendering
  - `src/PhysicsMicroscope.tsx` - local flow/vector visualization
  - `src/vectorUtils.ts` - shared vector scaling helpers
- `app.py` - legacy Streamlit entrypoint
- `physics_engine.py`, `visualizer.py` - legacy Python modules

Common commands:

- React dev: `cd kinematics-web && npm run dev`
- React lint: `cd kinematics-web && npm run lint`
- React build: `cd kinematics-web && npm run build`

## Legacy Streamlit App (Optional)

If needed:

1. Install Python 3.13+ and `uv`
2. From repo root: `uv run streamlit run app.py --server.headless true`
3. Open `http://localhost:8501`
