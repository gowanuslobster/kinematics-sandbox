# Kinematics Web (React App)

Primary frontend for the Kinematics Sandbox project.

This app lets students explore projectile motion with:

- live parameter control
- challenge mode with shot animation
- drag + spin + air-density effects
- target hit feedback
- pinned trajectory comparison (one pinned trajectory + one current trajectory)

## Quick start

From the repository root:

1. `cd kinematics-web`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173`

## First run walkthrough

1. Leave the app in **Live Mode**.
2. Adjust `Initial Velocity`, `Launch Angle`, `Gravity`, and `Drag coefficient`.
3. Click **Pin Current Trajectory**.
4. Change launch parameters again and compare the new path to the pinned one.
5. Hover either trajectory line to inspect the exact settings used for that shot.
6. Switch to **Challenge Mode** and click **Fire!** to animate an attempt.

## Scripts

- `npm run dev` - start local development server (Vite)
- `npm run build` - type-check and production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint
- `npm test` - run unit tests
- `npm run test:unit` - run unit tests directly
- `npm run test:unit:watch` - run unit tests in watch mode
- `npm run storybook` - run Storybook
- `npm run build-storybook` - build Storybook static site

## Testing

Unit tests live in `src/**/*.test.ts` and run through `vitest.unit.config.ts`.

Current baseline tests focus on `calculateTrajectory()` and cover:

- vacuum-mode behavior
- drag-mode behavior
- zero-gravity stability
- hit detection

Run tests with:

- `npm test`

## Known caveats

- `npm run build` can fail on pre-existing TypeScript issues in:
  - `src/stories/Button.tsx`
  - `src/stories/Header.tsx`
- `npm run lint` may report pre-existing lint findings unrelated to physics logic changes.

These issues are outside normal runtime usage; `npm run dev` works for local development.

## Code map

- `src/App.tsx` - app state, controls, mode switching, and orchestration
- `src/physics.ts` - physics simulation and derived metrics
- `src/TrajectoryChart.tsx` - Plotly rendering and hover display
- `src/physics.test.ts` - physics unit tests
- `vitest.unit.config.ts` - standalone unit test config

## Tech stack

- React 19
- TypeScript
- Vite
- Plotly (`react-plotly.js`)
- Vitest
