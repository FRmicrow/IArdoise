---

description: "Task list for PWA Drawing Game implementation"
---

# Tasks: PWA Drawing Game

**Input**: Design documents from `specs/001-pwa-drawing-game/`

**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/)

**Stack**: TypeScript 5 · Node.js 20 · Fastify 4 · `ws` · Vite 5 · Vanilla TS frontend · `vite-plugin-pwa`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the monorepo, tooling, and shared configuration. No user-story work begins here.

- [X] T001 Initialise npm workspace root with `package.json` (workspaces: `["backend","frontend"]`) at `package.json`
- [X] T002 [P] Scaffold `backend/` workspace: `backend/package.json`, `backend/tsconfig.json`, `backend/src/index.ts` (empty Fastify stub)
- [X] T003 [P] Scaffold `frontend/` workspace: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/main.ts` (empty router stub)
- [X] T004 [P] Add `backend` dependencies: `fastify@4`, `@fastify/websocket`, `@fastify/static`, `ws`, `qrcode`, `bcryptjs`, `jose`, `dotenv` in `backend/package.json`
- [X] T005 [P] Add `frontend` dev dependencies: `vite@5`, `vite-plugin-pwa` in `frontend/package.json`
- [X] T006 [P] Add `backend` dev dependencies: `vitest`, `@types/node`, `@types/ws`, `@types/qrcode`, `@types/bcryptjs`, `tsx` in `backend/package.json`
- [X] T007 [P] Add `frontend` dev dependencies: `vitest`, `@playwright/test` in `frontend/package.json`
- [X] T008 Configure root `package.json` scripts: `dev`, `build`, `start`, `test`, `test:e2e` delegating to workspaces
- [X] T009 [P] Create `.env.example` at repo root with `HOST_USERNAME`, `HOST_PASSWORD_HASH`, `JWT_SECRET`, `PORT=3000`
- [X] T010 [P] Add `.gitignore` covering `node_modules/`, `dist/`, `.env`, `frontend/dist/` at repo root
- [X] T011 Configure Vite in `frontend/vite.config.ts`: `vite-plugin-pwa` with `display: standalone`, `start_url: /`, network-first caching strategy
- [X] T012 [P] Create `frontend/public/manifest.json`: app name, icons array (192px, 512px placeholders), `display`, `start_url`, `background_color: #000000`, `theme_color: #000000`

**Checkpoint**: `npm install` succeeds from root; both workspaces resolve; `npm run dev` starts Vite dev server

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure — config loading, auth, `SessionManager`, and WebSocket plumbing — that every user story depends on.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T013 Create `backend/src/config.ts`: load `.env` via `dotenv`, export typed `Config` object (`username`, `passwordHash`, `jwtSecret`, `port`)
- [X] T014 Create `backend/src/auth/jwt.ts`: `signToken(payload)` and `verifyToken(token)` using `jose` (HS256, 1 h expiry), reading `jwtSecret` from config
- [X] T015 Create `backend/src/auth/middleware.ts`: Fastify `preHandler` hook that validates `Authorization: Bearer <token>` header and attaches decoded payload to `request.user`
- [X] T016 Create `backend/src/session/types.ts`: TypeScript interfaces `Session`, `Player`, `Prompt`, `SessionStatus`, `ConnectionStatus` exactly as defined in `data-model.md`
- [X] T017 Create `backend/src/session/SessionManager.ts`: singleton class with `Map<string, Session>` store; methods `createSession(hostUsername)`, `getSession(id)`, `addPlayer(sessionId, name)`, `removeSession(id)`; enforces single active session per host
- [X] T018 Create `backend/src/session/nameDedup.ts`: pure function `dedupName(existing: string[], candidate: string): string` — appends ` 2`, ` 3`, etc. on collision
- [X] T019 Create `backend/src/ws/WsRouter.ts`: WebSocket event router; parses JSON envelope `{ type, payload }`, routes by `type` to registered handlers, sends `ERROR` on unknown type or auth failure
- [X] T020 Create `backend/src/ws/broadcast.ts`: helpers `broadcastToSession(sessionId, message)` and `sendToClient(wsClientId, message)` operating on an in-memory `Map<string, WebSocket>` connection registry
- [X] T021 Create `backend/src/ws/connectionRegistry.ts`: `register(wsClientId, ws)`, `deregister(wsClientId)`, `getWs(wsClientId)` — the single source of truth for live WS connections
- [X] T022 Wire Fastify app in `backend/src/index.ts`: register `@fastify/websocket`, `@fastify/static` (serving `frontend/dist/`), mount `/api` routes, mount `/ws` WebSocket endpoint, start server on `config.port`
- [X] T023 [P] Create `backend/src/qr/generateQr.ts`: `generateQrDataUrl(url: string): Promise<string>` using `qrcode` package, returns PNG data URL
- [X] T024 [P] Add Vitest config in `backend/vitest.config.ts` covering `backend/tests/unit/` and `backend/tests/integration/`

**Checkpoint**: `npm run dev` (backend) starts without errors; `/ws` endpoint accepts connections; `SessionManager` unit-testable in isolation

---

## Phase 3: User Story 1 — Host creates a game session (Priority: P1) 🎯 MVP

**Goal**: Host can log in, create a session, receive a QR code, and watch player names appear in the lobby in real-time.

**Independent Test**: Log in → create session → receive QR code → open join URL in second window → submit name → verify name appears in host lobby list within 3 s (no page refresh). See `quickstart.md` Scenario 1 & 2.

### Implementation for User Story 1

- [X] T025 [US1] Implement `POST /api/auth/login` in `backend/src/auth/loginRoute.ts`: validate body, compare password with `bcryptjs.compare`, call `signToken`, return `{ token }` or `401` per `contracts/http-api.md`
- [X] T026 [US1] Implement `POST /api/sessions` in `backend/src/session/sessionRoutes.ts`: require auth middleware (T015), call `SessionManager.createSession`, return `{ sessionId, joinUrl }` or `409` per `contracts/http-api.md`
- [X] T027 [US1] Implement `GET /api/sessions/:sessionId/qr` in `backend/src/session/sessionRoutes.ts`: call `generateQrDataUrl(session.joinUrl)`, return `{ dataUrl }` per `contracts/http-api.md`
- [X] T028 [US1] Implement `POST /api/sessions/:sessionId/players` in `backend/src/session/playerRoutes.ts`: validate name (1–32 chars), check session status is `"lobby"`, call `dedupName`, call `SessionManager.addPlayer`, return `{ playerId, name }` per `contracts/http-api.md`; return `409` if status ≠ `"lobby"`, `400` on validation failure
- [X] T029 [US1] Implement `AUTH` WS handler in `backend/src/ws/handlers/authHandler.ts`: accept `role: "host"` (verify JWT) or `role: "player"` (verify playerId exists in session); register connection; send `AUTH_OK` then `SESSION_STATE` snapshot per `contracts/websocket-events.md`
- [X] T030 [US1] Implement `SESSION_STATE` builder in `backend/src/ws/handlers/authHandler.ts`: assembles full snapshot payload (status, prompt, roundIndex, players array with connectionStatus) and sends to newly authenticated client
- [X] T031 [US1] Emit `PLAYER_JOINED` broadcast in `backend/src/session/playerRoutes.ts` after successful registration: broadcast `{ playerId, name, score: 0 }` to all clients in session via `broadcast.ts`
- [X] T032 [US1] Create `frontend/src/pages/login.ts`: renders login form; on submit POSTs to `/api/auth/login`; stores JWT in `sessionStorage`; redirects to `#/host/lobby` on success; shows error on `401`
- [X] T033 [US1] Create `frontend/src/ws/WebSocketClient.ts`: connects to `ws://<origin>/ws`; sends `AUTH` on open; dispatches incoming events to a typed `EventEmitter`; reconnects with exponential back-off on close
- [X] T034 [US1] Create `frontend/src/pages/lobby-host.ts`: POSTs to `/api/sessions` to create session; GETs QR data URL and renders it in `<img>`; opens `WebSocketClient`; listens for `PLAYER_JOINED` and `PLAYER_DISCONNECTED` events; updates player list DOM in real-time
- [X] T035 [US1] Create `frontend/src/pages/join.ts`: reads `sessionId` from URL path (`/join/<id>`); renders name form; POSTs to `/api/sessions/:id/players`; stores `playerId` in `sessionStorage`; redirects to `#/player/game` on success; shows "Registration closed" message on `409`
- [X] T036 [US1] Implement SPA hash router in `frontend/src/main.ts`: maps `#/login`, `#/host/lobby`, `#/host/game`, `#/player/game`, `#/player/wait`, `#/scoreboard` to their page modules; guards `#/host/*` routes behind JWT check
- [X] T037 [US1] Add `PLAYER_DISCONNECTED` and `PLAYER_RECONNECTED` WS handlers in `backend/src/ws/handlers/connectionHandler.ts`: update `player.connectionStatus`; broadcast to session on WS close/reopen

**Checkpoint**: Host can log in, generate QR, share join URL; player names appear in host lobby in real-time; "Registration closed" on late join

---

## Phase 4: User Story 2 — Player joins and draws (Priority: P2)

**Goal**: Player lands on game screen, sees the host's prompt, and can draw freely on a black canvas using touch or mouse.

**Independent Test**: With a session in `"lobby"` state, a player can join via QR URL, see the current prompt text, draw on the canvas (strokes render smoothly), and see the canvas clear when host triggers "Next question". See `quickstart.md` Scenario 3 & 4.

### Implementation for User Story 2

- [X] T038 [P] [US2] Create `frontend/src/canvas/DrawingCanvas.ts`: wraps `<canvas>` element; initialises black background with `fillRect`; listens to `PointerEvent` (`pointerdown`, `pointermove`, `pointerup`) for unified mouse + touch input; draws strokes as white lines; exposes `clear()` method (re-fills black); attaches `ResizeObserver` to container and scales canvas on resize, re-rendering stored stroke array
- [X] T039 [P] [US2] Create `frontend/src/canvas/strokeStore.ts`: in-memory array of `Stroke[]` (`{ points: { x, y }[], colour: string, width: number }`); exposes `addStroke`, `clear`, `getAll` — used by `DrawingCanvas` for resize re-render; never serialised to server
- [X] T040 [US2] Create `frontend/src/pages/game-player.ts`: renders prompt text (`<p id="prompt">`) and mounts `DrawingCanvas` on a full-screen `<canvas>`; subscribes to `PROMPT_UPDATED` WS event to update prompt text; subscribes to `QUESTION_ADVANCED` to call `DrawingCanvas.clear()`; shows waiting indicator (`<div id="waiting">`) until `GAME_STARTED` received
- [X] T041 [US2] Handle `GAME_STARTED` WS event in `frontend/src/ws/WebSocketClient.ts` event bus: hide waiting indicator on player screen; transition player page state to active drawing mode
- [X] T042 [US2] Implement `SET_PROMPT` WS handler in `backend/src/ws/handlers/promptHandler.ts`: validate sender is host; update `session.currentPrompt`; push to `session.prompts` history; broadcast `PROMPT_UPDATED` to all player clients with `{ text, roundIndex }` per `contracts/websocket-events.md`
- [X] T043 [US2] Add prompt input field to `frontend/src/pages/lobby-host.ts`: text `<input>` that sends `SET_PROMPT` WS event on `input` (debounced 300 ms); prompt also visible while in lobby so players see it upon joining

**Checkpoint**: Player opens join URL, enters name, lands on game screen with prompt and black canvas; can draw smoothly; canvas clears on "Next question"

---

## Phase 5: User Story 3 — Host manages the game (Priority: P3)

**Goal**: Host can start the game (locking registration), advance questions, score players with +/−, and end the game triggering a final scoreboard on all screens.

**Independent Test**: With players joined, host starts game → player screens lock into active view → host taps +/− and scores update immediately → host clicks "Next question" → canvases clear → host ends game → all screens show ranked scoreboard. See `quickstart.md` Scenarios 5 & 6.

### Implementation for User Story 3

- [X] T044 [US3] Implement `START_GAME` WS handler in `backend/src/ws/handlers/gameHandler.ts`: validate sender is host; validate `session.players.size >= 1`; set `session.status = "active"`; broadcast `GAME_STARTED` with `{ sessionId, currentPrompt }` to all clients per `contracts/websocket-events.md`
- [X] T045 [US3] Implement `NEXT_QUESTION` WS handler in `backend/src/ws/handlers/gameHandler.ts`: validate sender is host and session is `"active"`; push current prompt to history; increment `session.roundIndex`; reset `session.currentPrompt = ""`; broadcast `QUESTION_ADVANCED` with `{ roundIndex }` to all clients
- [X] T046 [US3] Implement `UPDATE_SCORE` WS handler in `backend/src/ws/handlers/gameHandler.ts`: validate sender is host and session is `"active"`; apply `delta` (+1 or −1) to `player.score`; broadcast `SCORE_UPDATED` with `{ playerId, newScore }` to all clients per `contracts/websocket-events.md`
- [X] T047 [US3] Implement `END_GAME` WS handler in `backend/src/ws/handlers/gameHandler.ts`: validate sender is host; set `session.status = "ended"`; build scoreboard array sorted descending by score; broadcast `GAME_ENDED` with `{ scoreboard }` to all clients per `contracts/websocket-events.md`
- [X] T048 [US3] Create `frontend/src/pages/game-host.ts`: displays player list with name and current score; shows +/− buttons per player that send `UPDATE_SCORE` WS event; shows "Next Question" button (sends `NEXT_QUESTION`) and "End Game" button (sends `END_GAME` with confirmation dialog); shows prompt input (sends `SET_PROMPT`); updates scores in real-time on `SCORE_UPDATED` events
- [X] T049 [US3] Add "Start Game" button to `frontend/src/pages/lobby-host.ts`: disabled when `players.size === 0`; on click sends `START_GAME` WS event; on `GAME_STARTED` received, navigate router to `#/host/game`
- [X] T050 [US3] Create `frontend/src/pages/scoreboard.ts`: renders final ranked scoreboard table from `GAME_ENDED` payload (`{ scoreboard[] }`); shown on all client screens (host and players) when `GAME_ENDED` WS event is received; router transitions to `#/scoreboard` on event
- [X] T051 [US3] Subscribe to `GAME_STARTED` in `frontend/src/pages/lobby-host.ts` (player side): player client receives `GAME_STARTED` and router transitions from `#/player/wait` to `#/player/game`
- [X] T052 [US3] Enforce registration lock in `backend/src/session/playerRoutes.ts`: `POST /api/sessions/:id/players` returns `409 { error: "Registration is closed" }` when `session.status !== "lobby"` (already coded in T028 — verify and add integration test scenario)

**Checkpoint**: Full game loop functional: lobby → active game with scoring → question advancement → end game scoreboard on all screens

---

## Phase 6: User Story 4 — Host participates as a player (Priority: P4)

**Goal**: Host can optionally join the session as a named player, gaining access to the drawing canvas alongside host controls.

**Independent Test**: Host clicks "Join as player", enters a name, appears in the player list, and can access a drawing canvas while retaining access to host controls. See `quickstart.md` Scenario 8.

### Implementation for User Story 4

- [X] T053 [US4] Implement `HOST_JOIN_AS_PLAYER` WS handler in `backend/src/ws/handlers/hostPlayerHandler.ts`: validate sender is host and session is `"lobby"`; call `SessionManager.addPlayer` with `isHost: true`; broadcast `PLAYER_JOINED` for the host-player entry per `contracts/websocket-events.md`
- [X] T054 [US4] Add "Join as player" button to `frontend/src/pages/lobby-host.ts`: opens inline name input; on submit sends `HOST_JOIN_AS_PLAYER` WS event; button hidden once host has joined
- [X] T055 [US4] Add view toggle to `frontend/src/pages/game-host.ts`: "My Canvas" tab that mounts `DrawingCanvas` (from T038) alongside the host control panel; implemented as a CSS tab/panel toggle — no page navigation
- [X] T056 [US4] Ensure host-player entry appears in host's own player list and scoreboard using existing `PLAYER_JOINED`, `SCORE_UPDATED`, and `GAME_ENDED` event flows (no new backend events required — verify existing handlers cover `isHost: true` players)

**Checkpoint**: Host appears in player list; can draw on canvas; host controls remain accessible; host score is updated the same way as any other player

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements spanning multiple user stories — error handling, edge cases, PWA manifest finalisation, and end-to-end validation.

- [X] T057 [P] Handle duplicate name edge case end-to-end: verify `dedupName` (T018) is called in `playerRoutes.ts` (T028) and that the suffixed name is returned to the player's join page and shown in the browser
- [X] T058 [P] Implement host-disconnected detection in `backend/src/ws/handlers/connectionHandler.ts`: when host WS closes, broadcast `{ type: "HOST_DISCONNECTED" }` to all players; on reconnect, host re-sends `AUTH` and `SESSION_STATE` is resent
- [X] T059 [P] Add `HOST_DISCONNECTED` handler in `frontend/src/ws/WebSocketClient.ts`: show "Host disconnected — waiting for reconnect" overlay on all player screens
- [X] T060 [P] Disable "Start Game" button when `session.players.size === 0` in `frontend/src/pages/lobby-host.ts` (enforce client-side guard for the edge case noted in spec)
- [X] T061 Add global error display in `frontend/src/main.ts`: catch unhandled `ERROR` WS events and display a dismissible toast notification
- [X] T062 [P] Finalise PWA assets: replace icon placeholders in `frontend/public/icons/` with actual 192×192 and 512×512 PNG icons; verify `manifest.json` passes Lighthouse PWA audit
- [X] T063 [P] Add `backend/tests/unit/SessionManager.test.ts`: unit tests for `createSession`, `addPlayer`, `dedupName`, state transitions, single-session-per-host constraint
- [X] T064 [P] Add `backend/tests/unit/auth.test.ts`: unit tests for `signToken`/`verifyToken` round-trip, expired token rejection
- [X] T065 [P] Add `backend/tests/integration/api.test.ts`: HTTP integration tests for `POST /api/auth/login`, `POST /api/sessions`, `POST /api/sessions/:id/players` (happy path + error cases)
- [X] T066 Add `frontend/tests/e2e/game-flow.spec.ts`: Playwright test covering the full flow — login → create session → player joins → host starts game → host scores → end game → scoreboard visible (maps to `quickstart.md` Scenarios 1–6)
- [X] T067 [P] Write `README.md` at repo root: prerequisites, `.env` setup, `npm install`, `npm run dev`, `npm run build && npm start`, link to `specs/001-pwa-drawing-game/quickstart.md`
- [ ] T068 Run `quickstart.md` validation checklist manually against the running app; tick off all 8 scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup          → no dependencies; start immediately
Phase 2: Foundational   → requires Phase 1 complete; BLOCKS all user stories
Phase 3 (US1)           → requires Phase 2; no other story dependency       🎯 MVP
Phase 4 (US2)           → requires Phase 2; integrates with US1 WS events
Phase 5 (US3)           → requires Phase 2; extends US1 lobby + US2 canvas clear
Phase 6 (US4)           → requires Phase 3 + 5; adds host-as-player to existing flows
Phase 7: Polish         → requires all desired stories complete
```

### User Story Dependencies

| Story | Depends on | Independently testable? |
|-------|-----------|------------------------|
| US1 (P1) | Phase 2 only | ✅ Yes — login + QR + lobby fully self-contained |
| US2 (P2) | Phase 2 + US1 WS infrastructure | ✅ Yes — canvas + prompt work without scoring |
| US3 (P3) | Phase 2 + US1 lobby + US2 canvas | ✅ Yes — full game loop verifiable end-to-end |
| US4 (P4) | US3 complete | ✅ Yes — additive; existing events handle host-player |

### Within Each User Story

- Models / types before services (T016 before T017)
- Services before WS handlers (T017, T020 before T025–T031)
- Backend handlers before frontend pages
- Frontend pages before E2E tests

---

## Parallel Execution Examples

### Phase 2 parallelisable cluster

```
T013 config.ts
T014 jwt.ts         ← parallel with T013
T015 middleware.ts  ← parallel with T013–T014 once T014 done
T016 types.ts       ← parallel with T013–T015
T023 generateQr.ts  ← fully independent, run any time in Phase 2
T024 vitest config  ← fully independent
```

### Phase 3 (US1) parallelisable cluster (after T017, T019, T020 done)

```
T025 login route          ← depends on T014
T026 session route        ← depends on T017
T027 QR route             ← depends on T023, T026
T028 player route         ← depends on T017, T018
T032 login.ts (frontend)  ← parallel with backend work
T033 WebSocketClient.ts   ← parallel with backend work
```

### Phase 4 (US2) parallelisable cluster

```
T038 DrawingCanvas.ts  ← fully independent frontend task
T039 strokeStore.ts    ← parallel with T038
T042 promptHandler.ts  ← backend, parallel with T038–T039
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Host logs in, creates session, QR code works, player joins and appears in lobby
5. Deploy/demo — this is a working skeleton with real-time presence

### Incremental Delivery

1. **Phase 1 + 2** → Infrastructure ready
2. **Phase 3 (US1)** → Login + QR + lobby → demo to stakeholders (MVP)
3. **Phase 4 (US2)** → Drawing canvas + prompt → playable
4. **Phase 5 (US3)** → Scoring + game flow → complete game
5. **Phase 6 (US4)** → Host-as-player → nice-to-have parity
6. **Phase 7** → Polish, tests, PWA audit → production-ready

### Parallel Team Strategy (2 developers)

After Phase 1 + 2 complete:

- **Dev A**: US1 backend (T025–T031) → US3 backend (T044–T047)
- **Dev B**: US1 frontend (T032–T036) → US2 frontend (T038–T043)
- Merge after Phase 3; US3 and US2 integrate naturally via existing WS events

---

## Notes

- `[P]` tasks = different files, no incomplete task dependencies — safe to run in parallel
- `[USn]` label maps each task to a specific user story for traceability
- Each user story is independently completable and demonstrates value without the next
- Canvas drawing state is **never** sent to the server — `strokeStore.ts` is purely client-side
- Commit after each task or logical group; tag each user-story checkpoint
- Stop at any phase checkpoint to validate the story independently before proceeding
- No test tasks included by default (not explicitly requested in spec); add with `/speckit.tasks --tdd` if desired
