---

description: "Task list for Fix — Players Stuck on Waiting Screen When Game Starts (002-fix-game-start-reload)"
---

# Tasks: Fix — Players Stuck on Waiting Screen When Game Starts

**Input**: Design documents from `/specs/002-fix-game-start-reload/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/websocket-events.md](./contracts/websocket-events.md), [quickstart.md](./quickstart.md)

**Tests**: NOT optional for this feature. Constitution Principle II mandates a
Vitest test for the new WS contract (`PING`/`PONG`) and a Playwright E2E
scenario for the changed user-facing flow (player recovers and reaches the
game screen), green before this fix is "done."

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P2)
to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no same-phase dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US2)
- Every task names an exact file path

## Path Conventions

Existing web-application monorepo — `backend/src/`, `backend/tests/`,
`frontend/src/`, `frontend/tests/` (see `plan.md` → Project Structure for the
full touched-file map). This feature only touches the WebSocket connection
layer, not session/game logic, HTTP routes, or any page component.

---

## Phase 1: Setup

**Purpose**: Establish a known-clean starting point. This is an established
codebase (see `research.md`), so there is no scaffolding to create.

- [X] T001 Run `npm install && npm run build --workspaces` at the repo root and confirm both workspaces build cleanly before any change (baseline per `quickstart.md` prerequisites)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the server-side application-level heartbeat reply
(`PING` → `PONG`) that the client-side fix in User Story 1 depends on to
actually recover a connection, and that User Story 2's resync check depends
on to stay healthy after recovery.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create backend/src/ws/handlers/heartbeatHandler.ts exporting `registerHeartbeatHandler(router: WsRouter)`, which registers the `'PING'` message type and immediately replies with `sendToClient(wsClientId, { type: 'PONG', payload: {} })` (imported from `../broadcast.js`) — no `SessionManager`, `authContext`, or session-state access at all, matching contracts/websocket-events.md's "pure echo, unauthenticated-safe" contract
- [X] T003 Wire `registerHeartbeatHandler(wsRouter)` into backend/src/index.ts alongside the existing `registerAuthHandler`/`registerConnectionHandler`/`registerPromptHandler`/`registerGameHandler`/`registerHostPlayerHandler` calls (depends on T002)
- [X] T004 [P] Vitest integration test: add `registerHeartbeatHandler` to the handler-registration list inside `buildTestApp()`, then add a `describe('Heartbeat (PING/PONG)', ...)` block asserting a connected client that sends `{ type: 'PING', payload: {} }` receives back `{ type: 'PONG', payload: {} }`, and that this works even before `AUTH` has been sent on that connection, in backend/tests/integration/api.test.ts (depends on T002)

**Checkpoint**: Server replies `PONG` to `PING` end-to-end (production wiring + test coverage). User story work can now begin.

---

## Phase 3: User Story 1 - Player transitions to the game screen after waiting idle (Priority: P1) 🎯 MVP

**Goal**: A player whose WebSocket connection has silently died (no `close`/`error` event on either end) while their tab stays in the foreground the whole time still automatically reaches the game screen when the admin starts the game, without any manual refresh/rejoin and without ever backgrounding the tab.

**Independent Test**: Per `quickstart.md`'s manual regression check — have a player's connection go silently unresponsive while the tab stays visible, have the admin start the game, restore the connection, and confirm the player lands on the game screen within the bounded recovery window, with no action on the player's device.

### Tests for User Story 1

- [X] T005 [US1] Playwright E2E regression: in frontend/tests/e2e/game-flow.spec.ts, before the player navigates, call `page.routeWebSocket('/ws', ws => { const server = ws.connectToServer(); ws.onMessage(msg => { if (!blackhole) server.send(msg); }); server.onMessage(msg => { if (!blackhole) ws.send(msg); }); })` on the player's page/context, where `blackhole` is a `let` captured in the test's outer scope (starts `false`); have the player join and reach the waiting screen normally; set `blackhole = true` (this silently drops messages in both directions — including any future `PING`/`PONG` and `GAME_STARTED` — without ever closing the underlying connection, so no `close`/`error` fires and `readyState` stays `OPEN`, faithfully reproducing the reported bug); record a timestamp, then have the admin click "Commencer la partie" and assert the **admin's own** page reaches `#/host/game` within ~1s regardless of the still-blackholed player (FR-005/SC-004 — the admin must never be blocked by a degraded player connection); wait long enough for the heartbeat's detect-and-reconnect cycle (a little over the reply-timeout from T006, e.g. 10s); set `blackhole = false`; assert the player's page reaches `#/player/game` (waiting banner hidden, phrase visible) within `quickstart.md`'s ~15s recovery bound (SC-003), and assert a brand-new native `WebSocket` was constructed for the player during this window (track via a counter incremented each time `page.routeWebSocket`'s handler fires) — proving the *heartbeat* triggered the reconnect, not some other path. This test MUST fail before T006 is implemented (no reconnect trigger exists yet) and pass after.

### Implementation for User Story 1

- [X] T006 [US1] In frontend/src/ws/WebSocketClient.ts: add `PONG: Record<string, never>` to `EventMap`; after a successful `connect()` (in the `open` listener), start a `setInterval` (~20s) that sends `{ type: 'PING', payload: {} }` via the existing `send()` and arms a short reply-timeout (~8s); on receiving `PONG`, clear the pending reply-timeout; if the reply-timeout elapses with no `PONG`, treat the connection as dead and run the exact same force-close-and-reconnect sequence already used by the `visibilitychange` handler at lines 106-107 (`this.socket?.close(); this.connect();`); clear both the heartbeat interval and any pending reply-timeout in `close()` so a manually-closed client doesn't keep probing (depends on T003, T005)

**Checkpoint**: User Story 1 complete — the literally reported bug (player never sees their page reload after the admin starts the game) is fixed for a silently-dead, foregrounded connection. This is a demoable MVP on its own.

---

## Phase 4: User Story 2 - Player whose connection silently degraded still catches up (Priority: P2)

**Goal**: When a heartbeat-triggered reconnect (from User Story 1) succeeds, the player lands on the session's *actual current* state — not a stale replay of "game just started" — even if the admin has already moved further (published a new phrase, or ended the game) while the player was cut off.

**Independent Test**: Blackhole a player's connection before the admin starts, have the admin start the game *and* publish a second phrase (or end the game) while the player is still cut off, then restore connectivity — confirm the player lands on the session's real current phrase/screen, not the one active at the moment `GAME_STARTED` was first broadcast.

### Tests for User Story 2

- [X] T007 [US2] Playwright E2E regression: in frontend/tests/e2e/game-flow.spec.ts, reuse the same `routeWebSocket` blackhole technique from T005 on a fresh player; set `blackhole = true`, have the admin start the game, then have the admin publish a second phrase (`SET_PROMPT`/"Commencer la partie" UI flow) while the player is still blackholed, then set `blackhole = false`; assert the recovering player's game screen shows the *second* phrase (not the first one that was active at the original `GAME_STARTED` broadcast), confirming the heartbeat-triggered reconnect resyncs via `SESSION_STATE` rather than replaying a stale `GAME_STARTED` payload — in frontend/tests/e2e/game-flow.spec.ts (depends on T006)

### Implementation for User Story 2

No production code change is needed: `authHandler.ts`'s existing `AUTH` → `SESSION_STATE` resync (unchanged by this feature, see research.md D2) already sends the session's real current `status`/`currentPhrase` on every successful re-authentication, including one triggered by the new heartbeat-driven reconnect from User Story 1. This story's only job is to lock that guarantee in with T007's regression test, for this specific recovery path.

**Checkpoint**: Both user stories independently verified. A recovering player always ends up correctly synced, regardless of how far the game progressed while they were cut off.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T008 [P] Manually run `quickstart.md`'s full regression checklist (steps 1-6) against a local dev build: confirm the silently-dead-while-foregrounded scenario recovers within ~15s, and confirm the healthy-connection path still transitions within ~3s with no extra `PLAYER_DISCONNECTED`/`PLAYER_RECONNECTED` flicker on the host's roster (SC-002, FR-006 non-regression check)
- [X] T009 Run `npm run build --workspaces`, `npm test --workspace=backend`, and `npm run test:e2e --workspace=frontend`; fix any failures (Constitution: Development Workflow gate) (depends on T001–T008)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories (US1's client heartbeat has nothing to talk to without T002/T003; US2's recovery-then-resync check needs a working `PONG` reply too).
- **User Story 1 (Phase 3)**: Depends on Foundational completion. No dependency on User Story 2.
- **User Story 2 (Phase 4)**: Depends on Foundational completion *and* on User Story 1's client heartbeat (T006) existing, since it reuses the exact same reconnect trigger — this is the one deliberate cross-story dependency (spec.md's own "Why this priority" for US2 states it "keeps re-appearing for players on shakier networks" *without* US1's fix in place first).
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Parallel Opportunities

- Foundational: T002 and T004 can be started in parallel once independently understood (T004 only needs T002's export to exist, not T003's production wiring); T003 depends on T002.
- User Story 1: T005 (test) should be written first and confirmed failing, then T006 (implementation) makes it pass — these are sequential by design (Constitution Principle II: write the failing test before the fix), not parallel.
- User Story 2: T007 has no parallel sibling within its phase.
- Polish: T008 can run in parallel with drafting T009, but T009 itself should be the final gate after everything else.

---

## Parallel Example: Foundational Phase

```bash
# Launch together:
Task: "Create heartbeatHandler.ts — PING -> PONG, no state access (backend/src/ws/handlers/heartbeatHandler.ts)"
Task: "Add Heartbeat (PING/PONG) integration test to api.test.ts (backend/tests/integration/api.test.ts)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run T004/T005 green, walk the "silently dead, foregrounded" scenario from `quickstart.md` manually.
5. Demo: a player whose connection silently died while staring at the waiting screen still reaches the game when the admin starts — the exact bug report is fixed.

### Incremental Delivery

1. Setup + Foundational → server-side heartbeat reply ready.
2. + US1 → demo: the reported bug is fixed (MVP).
3. + US2 → demo: a recovering player always lands on the *real* current state, even after further game progress happened while they were cut off.
4. Polish → build/test/e2e gate green, manual regression walkthrough complete.
