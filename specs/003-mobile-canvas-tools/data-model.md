# Data Model: Mobile Fullscreen Canvas & Drawing Tools

All state described here is **client-side, in-memory, per-player-tab only**. Nothing in this feature is persisted, sent over HTTP, or broadcast over WebSocket — this matches the spec's Assumptions (tool selection is local to each player's own drawing session) and requires no change to `SessionManager` or any WS contract.

## DrawingToolState

The player's currently active drawing settings, held inside the `DrawingCanvas` wrapper (owner of the `fabric.Canvas` instance).

| Field | Type | Notes |
|---|---|---|
| `mode` | `'draw' \| 'erase'` | Determines whether `canvas.freeDrawingBrush` is the `PencilBrush` or the `@erase2d/fabric` `EraserBrush` instance. Default `'draw'`. |
| `color` | CSS color string (e.g. `#ff3b30`) | Applied to `PencilBrush.color` before each new stroke. Default: current `--color-canvas-stroke` token value (preserves today's default appearance). Any color is valid — FR-006 rules out restricting to a fixed palette. |
| `width` | `number` (px) | Applied to `PencilBrush.width` / `EraserBrush.width`. Default `4` (matches the current hardcoded value in `DrawingCanvas.ts:63`). Continuous range per FR-007; UI-level bounds (e.g. slider min/max) are a presentation detail, not a data constraint. |

**Validation rules**: None beyond what the browser's native color `<input type="color">` and range `<input type="range">` controls already guarantee (always a valid color, always a numeric value within the slider's min/max). No server-side validation applies — this state never crosses a network boundary, so Constitution Principle III (validate all untrusted boundary input) does not apply here.

**Lifecycle / state transitions**:
- Initialized once per mounted `DrawingCanvas` (i.e., once per active round, since `game-player.ts:33-40` creates a fresh canvas on `mountCanvas()`).
- `mode`, `color`, and `width` persist across canvas `resize()` calls (orientation change, browser-chrome show/hide) — resizing must not reset tool selection (FR-010).
- `mode`, `color`, and `width` also persist across `clear()` (new round / new phrase via `QUESTION_ADVANCED`, which calls `drawingCanvas?.clear()` in both `game-player.ts:87-90` and `game-host.ts:138-141` — `clear()` wipes the drawn strokes on the existing canvas instance, it does **not** destroy and recreate it). A player's chosen color/width/mode carries over to the next phrase within the same session, and is only reset when the `DrawingCanvas` instance itself is destroyed and a new one constructed (on navigation away, `game-player.ts:109-112`).

## Stroke (Fabric `Path` object)

Previously a plain `{ points, colour, width }` record in the hand-rolled `strokeStore.ts`. Under Fabric.js, each finished freehand stroke becomes a `fabric.Path` object owned by `canvas.getObjects()` — Fabric's own object model replaces the custom `StrokeStore`/`Stroke` types, so `frontend/src/canvas/strokeStore.ts` is removed rather than adapted.

| Concept | Fabric.js equivalent |
|---|---|
| Stroke points | `Path` geometry (SVG path data), generated internally by `PencilBrush`/`EraserBrush` from captured pointer points. |
| Stroke color | `Path.stroke` (set from `DrawingToolState.color` at draw time). |
| Stroke width | `Path.strokeWidth` (set from `DrawingToolState.width` at draw time). |
| Erasability | `Path.erasable` — must be confirmed/set `true` on newly drawn paths so the `EraserBrush` can act on them (see research.md §2 caveat); verified during implementation, not assumed. |

**Relationships**: A canvas holds an ordered list of `Path` objects (`draw` mode output) that erasing can partially or fully remove/clip; no relationship to any other entity in the system (no player/session FK — the canvas is destroyed and recreated per round with no cross-round persistence, matching current behavior).
