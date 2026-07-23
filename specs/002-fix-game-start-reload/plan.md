# Implementation Plan: Fix — Players Stuck on Waiting Screen When Game Starts

**Branch**: `002-fix-game-start-reload` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-fix-game-start-reload/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Players who join a session and stay on the waiting screen with the app open
in the foreground can end up on a WebSocket connection that is silently dead
(NAT/mobile network idle-drop) without either side ever seeing a `close`
event. The server's existing heartbeat (added in `4bc36d4`) reaps these dead
sockets within ~50s, and the client's existing reconnect logic (added in
`e889e04`) fixes the case where the tab is backgrounded and re-foregrounded.
But there is no client-side trigger at all for a socket that dies while the
tab stays foregrounded the whole time — so the player never reconnects, never
gets the `SESSION_STATE` resync, and stays stuck on the waiting screen
indefinitely when the admin starts the game.

The fix adds an application-level heartbeat driven by the client itself
(`PING`/`PONG` over the existing WS JSON channel), independent of tab
visibility: the client periodically probes the connection and forces a
reconnect if no reply arrives in time. This reuses the existing reconnect/backoff
and `SESSION_STATE`-resync machinery already in `WebSocketClient.ts` and
`authHandler.ts` — no new recovery path, just a new, visibility-independent
trigger for the one that already works.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict: true` in both workspaces), Node.js 20, ES modules throughout. Unchanged by this feature.

**Primary Dependencies**: Backend — Fastify 4, `@fastify/websocket`, `ws`. Frontend — Vite 5, hand-rolled `WebSocketClient` event emitter (`frontend/src/ws/WebSocketClient.ts`). No new dependency is introduced by this feature.

**Storage**: N/A — in-memory only, owned by `SessionManager`; unaffected by this feature.

**Testing**: Vitest (backend: WS handler heartbeat/reply behavior) + Playwright (frontend E2E — extend the existing golden-path start-game assertion with a simulated silently-dead player socket), per Constitution Principle II.

**Target Platform**: Mobile web browsers (iOS Safari, Android Chrome) as an installable PWA — this is precisely the environment where NAT/carrier idle-drops make the bug reproduce.

**Project Type**: Web application — existing two-workspace npm monorepo (`backend/`, `frontend/`); no new project/workspace added.

**Performance Goals**: Players with a healthy connection keep seeing the transition within 3s of game start (SC-002, unchanged from spec 001's SC-003). Players whose connection had silently died reach the correct screen within 15s of the client-side heartbeat detecting the failure (SC-003). The added heartbeat traffic (one small JSON frame roughly every 20s per idle player) must stay negligible relative to existing per-player WS traffic.

**Constraints**: Must not change the admin-side experience (FR-006) or require a full page reload for players (FR-003) — the fix must ride entirely on the existing in-place `SESSION_STATE`/`GAME_STARTED` handling. Must not block or delay `START_GAME` for the admin regardless of how many players currently have a degraded connection (FR-005). All new client→server input validated before touching shared state (Constitution Principle III).

**Scale/Scope**: Same as spec 001 — casual in-person groups, up to ~20 simultaneous players per session; single Fastify process. This feature only touches the WS connection-liveness path, not session/game logic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Status | Notes |
|---|---|---|
| I. Real-Time State Consistency (NON-NEGOTIABLE) | **PASS** | No new state owner introduced. The fix only changes *when* a player's client reconnects and re-runs the existing `AUTH` → `SESSION_STATE` resync — `SessionManager` remains the sole source of truth, and the resync path already broadcasts nothing new; it re-reads current state. |
| II. Test-First for Game Logic and Flows | **PASS (commitment)** | New backend WS handler behavior (`PING` → `PONG`) gets a Vitest integration test. The player-stuck-on-waiting-screen scenario gets a Playwright regression test that simulates a silently-dead socket (no `close` event) and asserts the player still reaches the game screen within the bounded time. |
| III. Type-Safe, Validated Boundaries | **PASS** | The new `PING` message has an empty/no payload; the handler still goes through the same `WsRouter` dispatch and typed `EventMap` pattern as every other message — no untyped/unvalidated input added. |
| IV. Secure by Default | **PASS** | Heartbeat messages carry no session-mutating capability — `PING`/`PONG` do not touch `SessionManager` state and are unauthenticated-safe no-ops (they don't leak or accept anything beyond a liveness probe), consistent with how the existing native ping/pong already behaves at the transport layer. |
| V. Minimal-Footprint, YAGNI Changes | **PASS** | Reuses the existing reconnect/backoff and resync machinery end-to-end; the only new surface is the liveness probe itself (one interval, one timeout, two message types). No new abstraction layer, no persistence, no change to unrelated flows. This is a direct root-cause fix (the client has no way today to detect a socket that's dead-but-still-`OPEN`), not a symptomatic patch. |
| Frontend & UX Standards | **PASS** | No UI/canvas change. Heartbeat traffic is far below the existing ~100ms draw-event throttle guidance and doesn't touch canvas rendering at all. |
| Development Workflow & Quality Gates | **PASS (commitment)** | `npm run build` (both workspaces), `npm test` (backend), and `npm run test:e2e` remain the completion gate — tracked in `tasks.md`. No `.env`/config shape change, so no README/DEPLOYMENT.md update required. |

**Result**: No unjustified violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-game-start-reload/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── websocket-events.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

Existing web-application layout — no new top-level directory. Only the files
below are touched by this feature (see research.md's decision log for the
full rationale per file).

```text
backend/
├── src/
│   ├── index.ts                       # unchanged (existing native ping/pong reaper stays as-is)
│   └── ws/
│       ├── WsRouter.ts                # unchanged
│       ├── broadcast.ts               # unchanged
│       ├── connectionRegistry.ts      # unchanged
│       └── handlers/
│           ├── authHandler.ts         # unchanged (existing SESSION_STATE resync on AUTH is reused as-is)
│           ├── connectionHandler.ts   # unchanged
│           └── heartbeatHandler.ts    # NEW: registers PING → PONG (no session/state access)
└── tests/
    └── integration/heartbeat.test.ts  # NEW: PING → PONG round trip

frontend/
├── src/
│   ├── ws/WebSocketClient.ts          # CHANGED: add visibility-independent liveness probe (send PING on an interval, force reconnect if PONG doesn't arrive in time)
│   └── pages/game-player.ts           # unchanged (already reacts correctly to GAME_STARTED / SESSION_STATE once the socket reconnects)
└── tests/e2e/game-flow.spec.ts        # CHANGED: new regression scenario — simulate a silently-dead player socket (no close event) before the admin starts the game, assert the player still reaches the game screen
```

**Structure Decision**: Existing two-workspace web-application structure
(`backend/` Fastify API + WS, `frontend/` Vite PWA SPA) is kept unchanged;
this feature is implemented entirely within the existing WS connection
layer, touching only the files listed above. No new project, workspace, or
top-level directory.

## Complexity Tracking

*No entries — Constitution Check reported no unjustified violations.*
