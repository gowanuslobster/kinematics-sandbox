# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is the **Kinematics Sandbox** — an interactive 2D projectile motion physics simulator. There are two frontends:

- **React/Vite app** (`kinematics-web/`) — the primary, actively developed frontend. Run with `npm run dev` from `kinematics-web/`.
- **Streamlit app** (`app.py`) — legacy. Run with `uv run streamlit run app.py --server.headless true`.

No backend services, databases, or Docker required. Both apps are fully self-contained.

### React app (primary)

- **Dev server:** `cd kinematics-web && npm run dev` (port 5173)
- **Lint:** `cd kinematics-web && npm run lint` — note: there are pre-existing ESLint errors related to `useRef` access during render in `App.tsx`; these are in the existing code.
- **Build:** `cd kinematics-web && npm run build` — note: pre-existing TS errors in `src/stories/Button.tsx` and `src/stories/Header.tsx` (unused `React` import) will cause `tsc` to fail. Vite build itself succeeds if you skip type-checking.
- **Tests:** `cd kinematics-web && npx vitest` (uses Playwright for browser tests)
- **Storybook:** `cd kinematics-web && npm run storybook` (port 6006, optional)

### Python/Streamlit app (legacy)

- **Run:** `uv run streamlit run app.py --server.headless true` (port 8501)
- **Lint:** `uv run ruff check .`
- Python 3.13+ required (installed via `uv python install 3.13` if not present).

### Key gotchas

- `uv` must be installed and on PATH (`$HOME/.local/bin`). The update script handles this.
- The React app uses `package-lock.json` (npm), not pnpm or yarn.
- The workspace rule mandates using `uv` for Python package management, never `pip`.
