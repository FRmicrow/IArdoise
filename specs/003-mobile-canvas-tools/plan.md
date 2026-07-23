# Implementation Plan: Mobile Fullscreen Canvas & Drawing Tools

**Branch**: `003-mobile-canvas-tools` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-mobile-canvas-tools/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

On mobile, the player's drawing screen must reduce to just the phrase/question as a header with the canvas filling every remaining pixel, staying full even as the mobile browser's address bar shows/hides or the device rotates. The root cause is a static `100vh` layout unit (`frontend/src/style.css:54,81`) that doesn't track the mobile browser's dynamic viewport; the fix is switching to `100dvh` with safe-area support, no JS polyfill needed.

Players also get a real toolbar: eraser, free color choice, and continuous stroke-width control. Per explicit stakeholder direction, the current hand-rolled Canvas 2D drawing code (`frontend/src/canvas/DrawingCanvas.ts`) is rebuilt on top of the Fabric.js library (`fabric` + the companion `@erase2d/fabric` eraser addon), which provides a maintained free-drawing brush and object-model-based erasing instead of reimplementing hit-testing erasure by hand. This is a frontend-only change: drawing is already private per-player with no WebSocket draw sync, so no backend or WS contract is touched.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict: true` in both workspaces), Node.js 20, ES modules throughout. Backend unchanged.

**Primary Dependencies**: Frontend — adds `fabric` (v7.x) and `@erase2d/fabric` (v1.x, peer-dependency `fabric >= 6.0.0`) as new runtime dependencies, replacing the hand-rolled `DrawingCanvas.ts` Canvas-2D code. No `@types/fabric` (fabric v6+ ships its own types; the separate `@types/fabric` package targets the old v5 shape and must not be installed alongside it). Backend dependencies unchanged.

**Storage**: N/A — unchanged; this feature is entirely client-side, in-memory UI state (see data-model.md).

**Testing**: Vitest (new unit coverage for the `DrawingToolState`/mode-switching logic in the rebuilt `DrawingCanvas.ts` wrapper) + Playwright, using the already-configured `Mobile Safari` (iPhone 14) project in `frontend/playwright.config.ts:23-26` to assert the canvas fills the viewport and that color/size/eraser controls work, per Constitution Principle II.

**Target Platform**: Mobile web browsers (iOS Safari, Android Chrome) as an installable PWA — this is the environment the "canvas doesn't fill the screen" bug is specific to. Desktop/tablet must not regress.

**Project Type**: Web application — existing two-workspace npm monorepo (`backend/`, `frontend/`); no new project/workspace added.

**Performance Goals**: Maintain the Constitution's 60fps drawing target. Verified (Context7, `/fabricjs/fabricjs.com`): Fabric.js's rendering is scheduled through `requestRenderAll()`, which internally calls `fabric.util.requestAnimFrame` (a `requestAnimationFrame` wrapper) and de-duplicates redundant render requests within a frame — the same mechanism the constitution mandates, not a bespoke one. Free-drawing brush strokes (`PencilBrush`/`EraserBrush`) render through this same path. Still must be verified empirically during T005 to not introduce perceptible input lag versus the current hand-rolled `requestAnimationFrame` batching (SC-006) — the scheduling *mechanism* matches the constitution, but actual frame-budget cost under Fabric's fuller object model needs a real-device check.

**Constraints**: No new backend/WS surface (tool state stays client-local, per spec Assumptions). Toolbar UI must use the project's existing CSS design tokens, not hardcoded colors/px (Constitution's Frontend & UX Standards). The app must remain installable and offline-capable after adding the new dependency — verified as low-risk since `vite-plugin-pwa`'s `NetworkFirst` runtime-caching rule (`frontend/vite.config.ts:45-52`) caches any JS/CSS asset by pattern, not a static precache list, so the added Fabric.js bundle is covered automatically.

**Scale/Scope**: Same as existing (casual in-person groups, ~20 players/session). Only the player's drawing screen changes; the host's secondary "Mon canevas" panel is explicitly out of scope (spec FR-011).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Status | Notes |
|---|---|---|
| I. Real-Time State Consistency (NON-NEGOTIABLE) | **PASS** | No `SessionManager` state introduced or changed. Tool selection (color/size/mode) is local UI state, not broadcast — consistent with drawing already being unsynced/private today. |
| II. Test-First for Game Logic and Flows | **PASS (commitment)** | New Vitest unit tests for the rebuilt `DrawingCanvas` wrapper's tool-state logic (mode switching, color/width application to new vs. existing strokes). Existing Playwright E2E golden path is extended with mobile-fullscreen and toolbar assertions on the `Mobile Safari` project. |
| III. Type-Safe, Validated Boundaries | **PASS** | No new HTTP/WS input surface is added — tool state never crosses a network boundary, so there is no new boundary to validate. TypeScript strict mode is kept for the Fabric.js integration (native v6+ types, no `@types/fabric` mismatch). |
| IV. Secure by Default | **PASS** | No secrets, auth, or logging changes. |
| V. Minimal-Footprint, YAGNI Changes | **VIOLATION — justified, see Complexity Tracking** | Adds a new, fairly large third-party dependency (Fabric.js + eraser addon) to replace working hand-rolled code, where color/width alone would have been a small in-place change. Justified by explicit stakeholder direction (spec.md Assumptions) and by the disproportionate hand-rolled effort/risk of implementing precise, resize-safe erasing from scratch. |
| Frontend & UX Standards | **PASS** | Toolbar styled with existing CSS custom-property tokens only, following the established `.overlay` pattern (`style.css:274-285`). The "60fps via `requestAnimationFrame`" requirement is confirmed at the mechanism level: Fabric.js's render scheduling (`requestRenderAll()`) is itself `requestAnimationFrame`-backed (verified via Context7, see Technical Context → Performance Goals) — actual frame-budget headroom remains a T005/T021 empirical check (SC-006), not a compliance question. PWA offline/install behavior verified unaffected (see Constraints above). |
| Development Workflow & Quality Gates | **PASS (commitment)** | `npm run build` (both workspaces), `npm test` (backend, unaffected), and `npm run test:e2e` remain the completion gate, tracked in `tasks.md`. No `.env`/config shape change, so no README/DEPLOYMENT.md update required. |

**Result**: One violation (Principle V), justified below in Complexity Tracking. No other unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-mobile-canvas-tools/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

No `contracts/` directory: this feature adds no new HTTP endpoint or WebSocket message — it is purely a frontend rendering/UI change (see Technical Context → Constraints).

### Source Code (repository root)

Existing web-application layout — no new top-level directory. Only the files below are touched.

```text
frontend/
├── package.json                       # CHANGED: add `fabric`, `@erase2d/fabric` dependencies
├── index.html                         # CHANGED: viewport meta gains `viewport-fit=cover`
├── src/
│   ├── style.css                      # CHANGED: `#app`/`.page--full` 100vh → 100dvh (with vh fallback) + safe-area padding; NEW toolbar styles using existing tokens
│   ├── canvas/
│   │   ├── DrawingCanvas.ts           # REWRITTEN: wraps `fabric.Canvas` + `PencilBrush`/`EraserBrush`, exposes setColor/setWidth/setMode/clear/destroy
│   │   ├── strokeStore.ts             # REMOVED: superseded by Fabric's own object model (see data-model.md)
│   │   └── toolbar.ts                 # NEW: renders the overlay color/size/eraser controls, wires them to DrawingCanvas
│   └── pages/
│       ├── game-player.ts             # CHANGED: mounts the new toolbar alongside the canvas
│       └── game-host.ts               # unchanged (host's secondary canvas panel is out of scope, FR-011)
└── tests/
    ├── canvas/DrawingCanvas.test.ts   # NEW: Vitest coverage for tool-state logic
    └── e2e/game-flow.spec.ts          # CHANGED: mobile-fullscreen + toolbar assertions on the Mobile Safari project
```

**Structure Decision**: Existing two-workspace web-application structure (`backend/` Fastify API + WS, `frontend/` Vite PWA SPA) is kept unchanged; this feature is implemented entirely within the existing frontend drawing/canvas layer, touching only the files listed above. No new project, workspace, or top-level directory. Backend is untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New third-party dependency (`fabric` + `@erase2d/fabric`) replacing working hand-rolled canvas code, contrary to Principle V's "prefer the smallest change" | Stakeholder explicitly directed this approach when clarifying the spec (see spec.md Assumptions: "Technical direction (stakeholder decision)"); the eraser requirement in particular needs precise, resize-safe hit-testing/removal that a hand-rolled `destination-out` composite can't provide without losing the existing redraw-on-resize capability | Extending `DrawingCanvas.ts` in place (add `colour`/`width` params — trivial; hand-roll an eraser via pixel compositing or manual hit-testing — non-trivial, would need to reimplement object-level erasure Fabric already provides, and risks resize/replay bugs the current architecture is built around) was rejected per explicit stakeholder direction, not evaluated as technically inferior on its own |
