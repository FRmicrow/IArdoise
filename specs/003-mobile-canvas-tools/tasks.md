---

description: "Task list for Mobile Fullscreen Canvas & Drawing Tools (003-mobile-canvas-tools)"
---

# Tasks: Mobile Fullscreen Canvas & Drawing Tools

**Input**: Design documents from `/specs/003-mobile-canvas-tools/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: NOT optional for this feature. Constitution Principle II mandates a Playwright E2E scenario for any change to a user-facing flow (all four user stories change the player's drawing screen), and plan.md commits to Vitest coverage for the new tool-state logic.

**Testing-scope note**: The frontend has no DOM test environment today (no `jsdom`/`happy-dom`, no existing `*.test.ts` files, Vitest defaults to the Node environment per `frontend/vite.config.ts`). Adding one just for this feature would itself be a new-dependency call beyond what's justified (plan.md's Constitution Check already spends this feature's one YAGNI exception on Fabric.js itself). So: Vitest covers the framework-free `toolState.ts` logic only; everything that requires a real `fabric.Canvas`/DOM/rendering (mode switching, actual erasing, actual stroke color/width, viewport sizing) is covered by Playwright against a real WebKit engine (`Mobile Safari` project), which is the more authoritative tool for that anyway.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no same-phase dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Every task names an exact file path

## Path Conventions

Existing web-application monorepo — `frontend/src/`, `frontend/tests/` (see `plan.md` → Project Structure for the full touched-file map). This feature only touches the frontend; `backend/` is untouched.

---

## Phase 1: Setup

**Purpose**: Establish a known-clean starting point and bring in the new dependency.

- [X] T001 Run `npm install && npm run build --workspaces` at the repo root and confirm both workspaces build cleanly before any change (baseline per `quickstart.md` prerequisites)
- [X] T002 Add `"dependencies": { "fabric": "^7.4.0", "@erase2d/fabric": "^1.2.1" }` to `frontend/package.json`, then run `npm install`; confirm `@types/fabric` is **not** present anywhere in `frontend/package.json` or `package-lock.json` (per research.md: it targets the old v5 API shape and conflicts with `fabric@7`'s own bundled types)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migrate the drawing engine from the hand-rolled Canvas 2D code to Fabric.js, and stand up an (initially empty) toolbar mount point. This is the shared prerequisite for User Stories 2, 3, and 4 (erase/color/size all extend the same rewritten class and toolbar). **User Story 1 (mobile fullscreen) does not depend on this phase at all** — it is a pure CSS/HTML change to a different file and may be done before, after, or in parallel with this phase; see Dependencies below.

**⚠️ CRITICAL**: No work on US2, US3, or US4 can begin until this phase is complete.

- [X] T003 [P] Create `frontend/src/canvas/toolState.ts` exporting `export interface DrawingToolState { mode: 'draw' | 'erase'; color: string; width: number }` and `export function createDefaultToolState(defaultColor: string): DrawingToolState` returning `{ mode: 'draw', color: defaultColor, width: 4 }` (width `4` matches today's hardcoded stroke width in the current `DrawingCanvas.ts:63`, so the default look is unchanged) — pure, framework-free, no Fabric/DOM import, per data-model.md's `DrawingToolState`
- [X] T004 [P] Vitest unit test in `frontend/tests/canvas/toolState.test.ts`: assert `createDefaultToolState('#ffffff')` returns `{ mode: 'draw', color: '#ffffff', width: 4 }`; assert the returned object's fields are independently mutable (changing `.color` on a state object does not affect a second `createDefaultToolState()` call's `.width`/`.mode`) — locks down FR-006/FR-007/FR-010's "each setting is independent and has a sane default" behavior (depends on T003)
- [X] T005 Rewrite `frontend/src/canvas/DrawingCanvas.ts` to wrap Fabric.js instead of the raw Canvas 2D API:
  - Constructor creates `new Canvas(canvas, { isDrawingMode: true, backgroundColor: readColorToken('--color-canvas-bg', '#000000') })` (keep the existing `readColorToken` helper); initializes `private toolState = createDefaultToolState(readColorToken('--color-canvas-stroke', '#ffffff'))` (from T003) and calls a new `private applyBrush()` that sets `this.canvas.freeDrawingBrush` to `new PencilBrush(this.canvas)` (mode `'draw'`) or `new EraserBrush(this.canvas)` imported from `@erase2d/fabric` (mode `'erase'` — **not** `fabric.EraserBrush`, which does not exist in `fabric@7`, per research.md), then applies `.color`/`.width` from `toolState` onto the new brush
  - Add `setMode(mode: 'draw' | 'erase'): void`, `setColor(color: string): void`, `setWidth(width: number): void` — each updates `this.toolState` then re-applies to the current brush (`setMode` calls `applyBrush()`; `setColor`/`setWidth` mutate the existing brush's properties directly, so an in-progress mode isn't interrupted) — never touches already-created `Path` objects, satisfying FR-008
  - Register `this.canvas.on('path:created', ({ path }) => { path.erasable = true; })` — verify empirically (per research.md's caveat that Fabric objects are not erasable by default) whether this explicit set is required for `@erase2d/fabric` to act on freshly drawn strokes, and keep it if so
  - Replace the `ResizeObserver` callback's manual `canvas.width`/`canvas.height` + redraw (old `resize()`, lines 145-153) with `this.canvas.setDimensions({ width, height })`, keeping the same `Math.max(container.clientWidth, 1)` / `Math.max(container.clientHeight, 1)` guards — confirms FR-003 (strokes stay correctly positioned across resize) and FR-010 (toolState is untouched by resize, since it isn't read during `setDimensions`)
  - `clear()` → `this.canvas.clear()` then re-set `this.canvas.backgroundColor` (Fabric's `clear()` wipes it) — do **not** reset `toolState`
  - `destroy()` → `this.resizeObserver.disconnect()` then `this.canvas.dispose()` (Fabric's own cleanup, replacing the old manual `rafId`/`cancelAnimationFrame` bookkeeping, which no longer exists once `flushPendingSegments`/`scheduleFlush` are removed)
  - Delete the now-dead hand-rolled methods: `bindEvents`, `scheduleFlush`, `flushPendingSegments`, `drawDot`, `redraw`, `drawFullStroke`, `getPoint`, and the `activeStroke`/`lastDrawnPointIndex`/`rafId`/`strokeStore` fields — Fabric's `isDrawingMode` owns pointer capture and rendering internally
  - Verify empirically whether Fabric's auto-generated wrapper `<div>` (created around the lower/upper canvas elements — see research.md) needs an explicit `width: 100%; height: 100%` rule added under `.canvas-container` in `frontend/src/style.css`, alongside the existing `.canvas-container canvas` rule (`style.css:267-272`), which still matches the lower/upper canvas elements Fabric nests inside it
  (depends on T002, T003)
- [X] T006 [P] Delete `frontend/src/canvas/strokeStore.ts` (superseded by Fabric's own object model, per data-model.md) and remove its now-unused `import { StrokeStore, type Stroke } from './strokeStore'` from `DrawingCanvas.ts` (depends on T005)
- [X] T007 [P] Create `frontend/src/canvas/toolbar.ts` exporting `export function mountDrawingToolbar(container: HTMLElement, drawingCanvas: DrawingCanvas): HTMLElement` that creates and appends an initially-empty `<div class="drawing-toolbar"></div>` into `container` (the same `#canvas-container` element used by `DrawingCanvas`) and returns it, so each user story below can append its own control without touching this file's mounting logic
- [X] T008 [P] In `frontend/src/style.css`, add a `.drawing-toolbar` rule: `position: absolute`, anchored to a corner of `.canvas-container` (e.g. `bottom: var(--space-sm); right: var(--space-sm);`) with `display: flex; gap: var(--space-2xs);`, `background: var(--color-surface);`, `border-radius: var(--radius-sm);`, `padding: var(--space-2xs);` — reusing existing tokens only (Constitution's Frontend & UX Standards; no hardcoded hex/px), following the same absolutely-positioned-over-canvas precedent as `.overlay` (`style.css:274-285`) so it never shrinks the canvas's `1fr` grid row (FR-009)
- [X] T009 In `frontend/src/pages/game-player.ts`, import `mountDrawingToolbar` and call it inside `mountCanvas()` right after constructing `drawingCanvas` (after line 39), passing `canvasContainer` and the new `drawingCanvas` instance — **not** added to `frontend/src/pages/game-host.ts` (FR-011: the host's secondary canvas panel is explicitly out of scope) (depends on T005, T007)

**Checkpoint**: `npm run build --workspace=frontend` passes. Manually confirm drawing on the player screen still looks and behaves like before (default white stroke, width 4) — Fabric.js is now doing the work, with no visible regression. `toolState.test.ts` is green. US2, US3, US4 can now begin.

---

## Phase 3: User Story 1 - Full-Screen Drawing Canvas on Mobile (Priority: P1) 🎯 MVP

**Goal**: The player's mobile drawing screen shows only the phrase/question as a header, with the canvas filling all remaining space, staying full through orientation changes and mobile browser chrome show/hide.

**Independent Test**: Per `quickstart.md` §2 — load the drawing screen on a mobile device/emulated viewport in both orientations, confirm the canvas fills all space below the header with no gaps or clipping.

**Note**: Independent of Phase 2 (Foundational) — touches only CSS/HTML, not `DrawingCanvas.ts`. Can be implemented and shipped on its own even before Fabric.js work lands.

### Tests for User Story 1

- [X] T010 [US1] Playwright E2E in `frontend/tests/e2e/game-flow.spec.ts`, `Mobile Safari` project: once a player reaches the active drawing screen, assert `#canvas-container`'s bounding-box height plus the `#phrase` header's bounding-box height together account for the full page viewport height (`page.viewportSize()`), with no unaccounted gap (tolerance a few px for borders/padding); then call `page.setViewportSize()` with swapped width/height (simulating device rotation) and re-assert the same relationship holds at the new dimensions. **Note the coverage boundary**: Playwright/WebKit device emulation uses a fixed viewport and cannot simulate a real mobile browser's address-bar show/hide, so this test covers FR-001 and FR-003 (fills the screen; survives orientation change) but not the address-bar-collapse portion of FR-002 — that remains a manual check per `quickstart.md` §2.3. Assert strokes keep their exact coordinates after rotation (not that they stay visible — a stroke near an edge may legitimately fall outside a now-smaller dimension, per spec.md's Assumptions). Write this test first and confirm it fails against the current `100vh` CSS before implementing T011.

### Implementation for User Story 1

- [X] T011 [US1] In `frontend/src/style.css`: after the existing `min-height: 100vh;` on `#app` (line 54), add `min-height: 100dvh;` on its own line (browsers without `dvh` support ignore the unknown-unit line and keep the `100vh` fallback); apply the same pattern to `.page--full`'s `height: 100vh;` (line 81) — add `height: 100dvh;` immediately after it (depends on T010)
- [X] T012 [P] [US1] In `frontend/index.html`, change the viewport `<meta>` tag to `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` so `env(safe-area-inset-*)` values become available
- [X] T013 [US1] In `frontend/src/style.css`, replace `.page--full`'s flat `padding: var(--space-md);` (line 85) with safe-area-aware padding, e.g. `padding: max(var(--space-md), env(safe-area-inset-top)) max(var(--space-md), env(safe-area-inset-right)) max(var(--space-md), env(safe-area-inset-bottom)) max(var(--space-md), env(safe-area-inset-left));`, so the header/canvas aren't obscured by a notch or rounded screen corners (depends on T012)

**Checkpoint**: T010 passes. Manually verify on a real mobile device per `quickstart.md` §2 (address-bar collapse, both orientations). Demoable standalone.

---

## Phase 4: User Story 2 - Erase Drawing Mistakes (Priority: P1)

**Goal**: A precise eraser tool that removes marks at the point of contact without affecting the rest of the drawing.

**Independent Test**: Per `quickstart.md` §3 — draw strokes, switch to eraser, drag over part of the drawing, confirm only the touched marks disappear.

### Tests for User Story 2

- [X] T014 [US2] Playwright E2E in `frontend/tests/e2e/game-flow.spec.ts`: on the active drawing screen, simulate a pointer-drag to draw a stroke across a known region; read a pixel color at a known point on that stroke via `page.evaluate` against the Fabric `lower-canvas` element's 2D context (`getImageData`) and assert it differs from the background color; click the toolbar's eraser toggle (added in T015); simulate a pointer-drag over that same point; re-read the same pixel and assert it now matches the background color again; then simulate a drag over a *different*, untouched stroke and assert its pixels are unchanged. Write this test first and confirm it fails (no eraser button exists yet) before implementing T015.

### Implementation for User Story 2

- [X] T015 [US2] In `frontend/src/canvas/toolbar.ts`, inside `mountDrawingToolbar`, append an eraser `<button type="button" class="drawing-toolbar__eraser" aria-pressed="false">Gomme</button>`; on click, toggle `drawingCanvas`'s mode between `'erase'` and `'draw'` via `setMode` (added in T005), and toggle the button's `aria-pressed` attribute to reflect the active mode (depends on T009, T014)

**Checkpoint**: T014 passes. Manually verify per `quickstart.md` §3. Demoable standalone — a player can now draw and correct mistakes, independent of color/size controls.

---

## Phase 5: User Story 3 - Change Stroke Color (Priority: P2)

**Goal**: A free (not fixed-palette) color picker for new strokes.

**Independent Test**: Per `quickstart.md` §4 — pick a new color, draw, confirm the new stroke uses it and earlier strokes keep their original color.

### Tests for User Story 3

- [X] T016 [US3] Playwright E2E in `frontend/tests/e2e/game-flow.spec.ts`: draw a stroke with the default color; sample its pixel color as in T014; change the toolbar's color input (added in T017) to a distinct color (e.g. red); draw a second, spatially separate stroke; sample a pixel on the second stroke and assert it matches the newly selected color; re-sample a pixel on the first stroke and assert it still matches the original default color (FR-008). Write this test first and confirm it fails before implementing T017.

### Implementation for User Story 3

- [X] T017 [US3] In `frontend/src/canvas/toolbar.ts`, inside `mountDrawingToolbar`, append `<input type="color" class="drawing-toolbar__color" aria-label="Couleur du trait" />`, initialized to the canvas's current default stroke color; on `input`, call `drawingCanvas.setColor(event.target.value)` (added in T005) (depends on T009, T016)

**Checkpoint**: T016 passes. Manually verify per `quickstart.md` §4. Demoable standalone (works with or without US2/US4 present).

---

## Phase 6: User Story 4 - Adjust Stroke Size (Priority: P3)

**Goal**: A continuous stroke-thickness control for new strokes.

**Independent Test**: Per `quickstart.md` §5 — pick a new size, draw, confirm the new stroke uses it and earlier strokes keep their original thickness.

### Tests for User Story 4

- [X] T018 [US4] Playwright E2E in `frontend/tests/e2e/game-flow.spec.ts`: draw a stroke at the default width; via `page.evaluate` and `getImageData`, count non-background pixels along a short scan line perpendicular to the stroke (an approximation of its rendered thickness); change the toolbar's width input (added in T019) to a visibly larger value; draw a second stroke and repeat the scan-line pixel count at that stroke; assert the second count is meaningfully larger than the first (approximate/tolerance-based, not exact-pixel, per plan.md's testing-scope note). Write this test first and confirm it fails before implementing T019.

### Implementation for User Story 4

- [X] T019 [US4] In `frontend/src/canvas/toolbar.ts`, inside `mountDrawingToolbar`, append `<input type="range" class="drawing-toolbar__width" min="1" max="30" step="1" aria-label="Épaisseur du trait" />`, initialized to the canvas's current default width (`4`); on `input`, call `drawingCanvas.setWidth(Number(event.target.value))` (added in T005) (depends on T009, T018)

**Checkpoint**: T018 passes. Manually verify per `quickstart.md` §5. All four user stories now independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T020 [P] Manually run `quickstart.md` §6 regression check: host's "Mon canevas" tab still works unchanged (FR-011 scope boundary), desktop/tablet layout unaffected, app still installs as a PWA and works offline after a first successful load (verifies the `fabric`/`@erase2d/fabric` bundle addition doesn't break `vite-plugin-pwa`'s runtime caching, per plan.md's Constraints)
- [X] T021 [P] Confirm SC-006 (no perceptible drawing-lag regression): manually compare drawing responsiveness before/after this change on a mid-range mobile device, per plan.md's Performance Goals
- [X] T022 Run `npm run build --workspaces`, `npm test --workspace=frontend`, and `npm run test:e2e --workspace=frontend`; fix any failures (Constitution: Development Workflow gate) (depends on T001–T021)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS User Stories 2, 3, and 4 (all three extend the rewritten `DrawingCanvas`/`toolbar.ts` from this phase). Does **not** block User Story 1.
- **User Story 1 (Phase 3)**: Depends only on Setup (T001). Independent of Foundational and of every other user story — can be done first, last, or in parallel with Phase 2.
- **User Story 2 (Phase 4)**: Depends on Foundational completion (T005, T007, T009). No dependency on US1, US3, or US4.
- **User Story 3 (Phase 5)**: Depends on Foundational completion. No dependency on US1, US2, or US4 — the color `<input>` is appended independently of the eraser button; both simply live in the same `.drawing-toolbar` container.
- **User Story 4 (Phase 6)**: Depends on Foundational completion. No dependency on US1, US2, or US3, for the same reason as US3.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Parallel Opportunities

- Setup: T001 and T002 are sequential (T002's `npm install` should follow a known-clean baseline from T001), not parallel.
- Foundational: T003 and T004 are sequential by design (test depends on the module existing, per this feature's practical, non-strict-TDD ordering for foundational infra — see 002's precedent). T006, T007, T008 can proceed in parallel with each other once T005 lands, since they touch different files (`strokeStore.ts` deletion, `toolbar.ts` creation, `style.css`). T009 depends on both T005 and T007.
- Once Foundational completes, **US2, US3, and US4 can be implemented in parallel by different developers** — each only appends one independent control to `toolbar.ts` and adds one independent Playwright scenario to `game-flow.spec.ts`. (Note: if worked on literally simultaneously by different people, the shared edits to `toolbar.ts` and `game-flow.spec.ts` will need a trivial merge — not a design conflict, just the same file being extended three times.)
- US1 can run fully in parallel with Phase 2 + US2/US3/US4, on a different file set entirely (`style.css`'s viewport units + `index.html`, vs. `DrawingCanvas.ts`/`toolbar.ts`).

---

## Parallel Example: Foundational Phase

```bash
# After T005 (DrawingCanvas rewrite) lands, launch together:
Task: "Delete strokeStore.ts and its now-unused import (frontend/src/canvas/strokeStore.ts)"
Task: "Create toolbar.ts mount point (frontend/src/canvas/toolbar.ts)"
Task: "Add .drawing-toolbar styles (frontend/src/style.css)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 (skip Phase 2 entirely — not required for US1).
3. **STOP and VALIDATE**: run T010 green, walk `quickstart.md` §2 on a real device.
4. Demo: the literal first half of the bug report ("le canvas doit faire toute la taille de l'écran") is fixed, with zero new dependencies yet.

### Incremental Delivery

1. Setup → baseline confirmed.
2. + US1 → demo: mobile canvas fills the screen (MVP for the fullscreen half of the ask).
3. + Foundational → Fabric.js migration complete, no visible change yet, toolbar mount point ready.
4. + US2 → demo: players can erase mistakes.
5. + US3 → demo: players can change stroke color.
6. + US4 → demo: players can change stroke size. All four user stories, and the full original request, delivered.
7. Polish → build/test/e2e gate green, manual regression walkthrough complete.

### Parallel Team Strategy

With multiple developers:

1. One developer takes User Story 1 immediately (no dependency on anything but Setup).
2. Another developer completes Foundational.
3. Once Foundational lands: up to three developers take US2, US3, US4 in parallel (each appends independently to `toolbar.ts`).
4. Stories complete and integrate independently; Polish once all are done.
