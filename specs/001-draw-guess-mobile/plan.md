# Implementation Plan: Mobile Drawing Party Game

**Branch**: `001-draw-guess-mobile` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-draw-guess-mobile/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

An admin creates a session and shares a QR code / join link; players scan it,
enter a (non-unique) nickname, and wait in a lobby the admin watches live.
When the admin starts the game, every player moves to a screen showing the
admin's current phrase as a persistent label above a full-remaining-space,
private, freehand drawing canvas. The admin can publish new phrases at any
time (immediately propagated to all players) and can end the session, moving
everyone to a closing screen. All UI is French; there is no scoring in this
iteration.

Technically, this reuses the existing Fastify + Vite two-workspace app
(`SessionManager` as single source of truth, `WsRouter` broadcast pattern,
shared-credential host JWT auth) almost entirely as-is. The gap between what
already exists and this spec is: remove nickname dedup and the whole scoring
subsystem, make phrase publishing an explicit validated action instead of
live-as-you-type, add a session-status lookup so the join page can show a
"not found" / "already started" / "ended" message, make session resumption
survive a full app relaunch (not just an in-tab reconnect) via `localStorage`,
translate all UI copy to French, and close two pre-existing Frontend & UX
Standards gaps (no CSS design tokens today; canvas drawing isn't
`requestAnimationFrame`-batched) on every page this feature touches anyway.
See `research.md` for the itemized decision log.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict: true` in both workspaces), Node.js 20, ES modules throughout.

**Primary Dependencies**: Backend — Fastify 4, `@fastify/websocket`, `@fastify/static`, `ws`, `jose` (JWT), `bcryptjs`, `qrcode`, `dotenv`. Frontend — Vite 5, `vite-plugin-pwa`; no UI framework (vanilla DOM/Canvas API + a small hand-rolled `WebSocketClient` event emitter). No new dependency is introduced by this feature.

**Storage**: N/A — in-memory only, owned by `SessionManager` (a process-local singleton `Map`); no database, per Constitution Principle V and `ARCHITECTURE.md`'s documented MVP tradeoff.

**Testing**: Vitest (backend: `SessionManager` unit tests, HTTP route integration tests, WS handler tests) + Playwright (frontend E2E golden path), per Constitution Principle II.

**Target Platform**: Mobile web browsers (iOS Safari, Android Chrome) as an installable PWA for both admin and players; admin flow also usable on a desktop/tablet browser as a secondary target (spec Assumptions).

**Project Type**: Web application — existing two-workspace npm monorepo (`backend/`, `frontend/`); no new project/workspace added.

**Performance Goals**: Roster update visible to admin ≤2s of a join (SC-002); ≥95% of players reach the game screen ≤3s after start (SC-003); ≥95% of players see a published phrase ≤2s after publish (SC-004); ≥95% of players see the closing screen ≤3s after end (SC-007); local canvas rendering at 60fps via `requestAnimationFrame` (Constitution, Frontend & UX Standards); ≥20 concurrent drawing players per session with no noticeable input lag on any individual screen (SC-005).

**Constraints**: PWA installability and offline static-asset caching must keep working (manifest + service worker untouched by this feature); drawings are never transmitted over the network (FR-018 — local-only rendering, no draw WS traffic to throttle); secrets only via env vars, structured `app.log` logging only (Constitution Principle IV); all endpoints/WS handlers validate input before touching shared state (Constitution Principle III).

**Scale/Scope**: Casual in-person groups, up to ~20 simultaneous players per session (spec Assumptions); single Fastify process, no cross-instance/horizontal scaling in this iteration (matches `ARCHITECTURE.md`'s existing ~50-sessions-per-instance ceiling — unchanged by this feature).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Status | Notes |
|---|---|---|
| I. Real-Time State Consistency (NON-NEGOTIABLE) | **PASS** | Reuses `SessionManager` as the sole state owner; every mutation this feature adds (`SET_PROMPT` validation, session-status lookup, dropped score field) still broadcasts through the existing `broadcast.ts` path before the initiating request/message is acknowledged. No parallel/shadow state introduced. |
| II. Test-First for Game Logic and Flows | **PASS (commitment)** | Every changed `SessionManager`/handler behavior (dedup removal, empty-phrase rejection, status endpoint, scoring removal) gets a Vitest test; the golden path (join → wait → start → draw → publish phrase → end) gets a Playwright scenario. Enforced at task level in `tasks.md`. |
| III. Type-Safe, Validated Boundaries | **PASS** | TypeScript strict mode already on in both workspaces (unchanged). New/changed inputs (`SET_PROMPT.text`, new `GET /:id/status`, `POST /sessions` optional `initialPhrase`) are validated before touching `SessionManager` state, matching the existing per-handler validation pattern (no schema library change needed — existing style is manual type/emptiness guards, consistent across handlers). |
| IV. Secure by Default (NON-NEGOTIABLE) | **PASS** | Host auth (shared `HOST_USERNAME`/`HOST_PASSWORD_HASH` + JWT) is unchanged. See research.md D10: this shared-credential gate is compatible with the spec's "no persistent admin identity" assumption — it authenticates a *role*, not a personal account, so no tension exists. The new `GET /:sessionId/status` endpoint is intentionally unauthenticated (players are anonymous by design) and exposes only a coarse status enum, no session contents. |
| V. Minimal-Footprint, YAGNI | **PASS** | No persistence layer added. Scoring code is *removed*, not extended, because it now contradicts the spec (research.md D3) — net reduction in surface area. CSS token migration and rAF-batched canvas rendering are scoped only to files this feature already rewrites for French copy (research.md D8/D9), not a separate sweep. |
| Frontend & UX Standards | **GAP → CLOSED BY THIS PLAN** | Today there is *no* CSS file in `frontend/src` — every colour/spacing value is an inline literal, and `DrawingCanvas` draws synchronously per pointer event rather than via `requestAnimationFrame`. Phase 1 design (research.md D8, D9) closes both gaps on every page this feature touches. PWA manifest/service worker are untouched and remain compliant. |
| Development Workflow & Quality Gates | **PASS (commitment)** | `npm run build` (both workspaces), `npm test` (backend), and `npm run test:e2e` are the completion gate for this feature, per Constitution — tracked in `tasks.md`. No `.env`/config shape changes, so no README/DEPLOYMENT.md update is required. |

**Result**: No unjustified violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-draw-guess-mobile/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── http-api.md
│   └── websocket-events.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

Existing web-application layout — no new top-level directory. Only the files
below are touched by this feature (see research.md's "Summary of required
changes by area" table for the full change/rationale list per file).

```text
backend/
├── src/
│   ├── index.ts                       # unchanged
│   ├── config.ts                      # unchanged
│   ├── auth/                          # unchanged (login, jwt, middleware)
│   ├── qr/generateQr.ts               # unchanged
│   ├── session/
│   │   ├── SessionManager.ts          # CHANGED: drop score, drop dedupName call
│   │   ├── types.ts                   # CHANGED: rename currentPrompt→currentPhrase, prompts→phrases (Prompt→Phrase), drop Player.score
│   │   ├── nameDedup.ts               # REMOVED
│   │   ├── sessionRoutes.ts           # CHANGED: initialPhrase on create; NEW GET /:id/status
│   │   └── playerRoutes.ts            # unchanged (validation already correct)
│   └── ws/
│       ├── WsRouter.ts                # unchanged
│       ├── broadcast.ts               # unchanged
│       ├── connectionRegistry.ts      # unchanged
│       └── handlers/
│           ├── authHandler.ts         # CHANGED: SESSION_STATE payload field rename only
│           ├── connectionHandler.ts   # unchanged
│           ├── gameHandler.ts         # CHANGED: remove UPDATE_SCORE; GAME_ENDED drops scoreboard
│           ├── hostPlayerHandler.ts   # unchanged
│           └── promptHandler.ts       # CHANGED: reject empty text; require active status
└── tests/
    ├── unit/SessionManager.test.ts    # CHANGED: dedup test removed, new coverage added
    ├── unit/auth.test.ts              # unchanged
    └── integration/api.test.ts        # CHANGED: new status endpoint, updated player/session flows

frontend/
├── index.html                         # CHANGED: lang="fr", <title>, link style.css
├── src/
│   ├── main.ts                        # CHANGED: bootstrap resume-from-localStorage routing
│   ├── style.css                      # NEW: design tokens
│   ├── canvas/
│   │   ├── DrawingCanvas.ts           # CHANGED: rAF batching, token colours
│   │   └── strokeStore.ts             # unchanged
│   ├── ws/WebSocketClient.ts          # CHANGED: event payload type renames (currentPhrase, no score)
│   └── pages/
│       ├── login.ts                   # CHANGED: French copy, CSS tokens
│       ├── lobby-host.ts              # CHANGED: explicit phrase publish, French, tokens, localStorage
│       ├── game-host.ts               # CHANGED: remove scoring UI, explicit publish, French, tokens
│       ├── join.ts                    # CHANGED: status pre-check, 3-way message, French, tokens, localStorage
│       ├── game-player.ts             # CHANGED: hide canvas until started, French, tokens
│       └── scoreboard.ts              # REMOVED → replaced by a closing screen (new: pages/closing.ts)
└── tests/e2e/game-flow.spec.ts        # CHANGED: golden path updated for no-dedup/no-score/French copy
```

**Structure Decision**: Existing two-workspace web-application structure
(`backend/` Fastify API + WS, `frontend/` Vite PWA SPA) is kept unchanged at
the top level; this feature is implemented entirely within the existing
directories, touching only the files listed above.

## Complexity Tracking

*No entries — Constitution Check reported no unjustified violations.*
