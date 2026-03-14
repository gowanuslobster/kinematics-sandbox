# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is the **Kinematics Sandbox** — an interactive 2D projectile motion physics simulator. There are two frontends:

- **React/Vite app** (`kinematics-web/`) — the primary, actively developed frontend. Run with `npm run dev` from `kinematics-web/`.
- **Streamlit app** (`app.py`) — legacy. Run with `uv run streamlit run app.py --server.headless true`.

No backend services, databases, or Docker required. Both apps are fully self-contained.

### React app (primary)

- **Dev server:** `cd kinematics-web && npm run dev` (port 5173)
- **Lint:** `cd kinematics-web && npm run lint`
- **Build:** `cd kinematics-web && npm run build` — note: pre-existing TS errors in `src/stories/Button.tsx` and `src/stories/Header.tsx` (unused `React` import) will cause `tsc` to fail. Vite build itself succeeds if you skip type-checking.
- **Unit tests:** `cd kinematics-web && npm run test:unit`
- **Storybook/browser tests:** `cd kinematics-web && npx vitest` (Storybook/Playwright-oriented config)
- **Storybook:** `cd kinematics-web && npm run storybook` (port 6006, optional)

### Python/Streamlit app (legacy)

- **Run:** `uv run streamlit run app.py --server.headless true` (port 8501)
- **Lint:** `uv run ruff check .`
- Python 3.13+ required (installed via `uv python install 3.13` if not present).

### Key gotchas

- `uv` must be installed and on PATH (`$HOME/.local/bin`). The update script handles this.
- The React app uses `package-lock.json` (npm), not pnpm or yarn.
- The workspace rule mandates using `uv` for Python package management, never `pip`.

## Preferred engineering style for this repo

### Refactoring approach

- Prefer small, reviewable refactors over large rewrites.
- Work one file at a time when practical, especially for readability-focused cleanup.
- When refactoring, first separate mixed concerns into named helpers/hooks/components before adding lots of commentary.
- Prefer extracting coherent units such as state hooks, pure helper functions, or small presentational components over introducing broad abstractions early.
- Keep behavior stable unless the user explicitly asks for behavior changes.

### Naming conventions

- Prefer names that reflect the conceptual role of the code, not just the implementation detail.
- In UI code, treat repeated controls as "elements" with clear parts such as label, value, helper text, and input.
- For style objects, use names that make their role obvious and keep `Style` in the name for actual style objects.
- Avoid generic names like `data`, `helper`, or `style2` when a more specific role-based name is available.
- Prefer consistent naming families within a file once a pattern has been established.

### Comments and docstrings

- Write comments for another developer who may be smart but new to the codebase or less familiar with the domain.
- Aim for "beginner-friendly but not overkill" comments.
- Prefer short one-line docstrings/comments that explain what a helper, block, or state variable is for.
- Add comments when the "what" or "why" is not obvious from the code, especially in:
  - physics-heavy logic
  - visualization heuristics
  - state machines / animation flow
  - coordinate transforms
  - custom hover / pointer interaction code
- Do not narrate obvious syntax or repeat what a clear function name already says.
- Prefer stable explanatory comments over change-log style comments like `NEW`, `FIXME` used as history, or implementation diary notes.
- When comments sit directly above function/interface declarations, prefer coherent `/** ... */` doc comments rather than mixing `//` and doc-comment blocks for the same idea.
- For JSX/HTML-heavy sections, comment larger structural blocks rather than individual tags.
- If a visualization or UI heuristic is approximate rather than physically literal, say that explicitly in comments so readers do not mistake it for simulation truth.

### Comment examples

- Good helper docstring: `/** Converts the live physics vectors into readable microscope overlays, including arrow paths, legend data, and pressure-highlight colors. */`
- Good state comment: `// Mutable drag/resize session state used by global pointer event handlers.`
- Good JSX block comment: `/* Main microscope visualization: pressure field, streamlines, ball, and vector arrows. */`

### Documentation consistency

- If a file has been substantially refactored, do a short consistency pass so comments/docstrings across nearby files feel similar in tone and depth.
- Favor comments that explain intent, constraints, or mental model over comments that enumerate every branch.

### Verification habits

- After focused React refactors, prefer targeted checks first:
  - `cd kinematics-web && npx eslint <touched-files>`
  - `cd kinematics-web && npm run test:unit`
- Prefer targeted lint on touched files before full lint when unrelated repo-wide issues are known or likely.
- If a dev server shows a blank page after a refactor, first suspect a compile-time error and verify with lint/build output before debugging runtime behavior.
