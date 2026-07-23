---

description: "Task list for Mobile Drawing Party Game (001-draw-guess-mobile)"
---

# Tasks: Mobile Drawing Party Game

**Input**: Design documents from `/specs/001-draw-guess-mobile/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: NOT optional for this feature. Constitution Principle II mandates a
Vitest test for every changed `SessionManager`/HTTP/WS behavior and a
Playwright E2E scenario for every changed user-facing flow, green before a
change is "done." `plan.md`'s Constitution Check committed to enforcing this
at the task level below.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P4)
to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no same-phase dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task names an exact file path

## Path Conventions

Existing web-application monorepo — `backend/src/`, `backend/tests/`,
`frontend/src/`, `frontend/tests/` (see `plan.md` → Project Structure for the
full touched-file map).

---

## Phase 1: Setup

**Purpose**: Establish a known-clean starting point. This is an established
codebase (see `research.md`), so there is no scaffolding to create.

- [X] T001 Run `npm install && npm run build --workspaces` at the repo root and confirm both workspaces build cleanly before any change (baseline per `quickstart.md` prerequisites)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rename/trim the shared `Session`/`Player`/`Phrase` vocabulary and
drop scoring/dedup at the source, so every later phase builds on the final
shape instead of patching it twice. Also stands up the CSS design-token file
and the relaunch-resume routing shell that every page depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Rename `currentPrompt`→`currentPhrase`, `prompts`→`phrases`, `Prompt` interface→`Phrase`, and remove `Player.score` in backend/src/session/types.ts
- [X] T003 [P] Update `SessionManager.createSession` to accept an optional `initialPhrase` param (sets `currentPhrase`); update `addPlayer` to store names as submitted (no dedup) and drop `score`; delete the now-unused backend/src/session/nameDedup.ts in backend/src/session/SessionManager.ts (depends on T002)
- [X] T004 Vitest unit test: `addPlayer` stores two identical names as-is (no " 2" suffix) and the returned `Player` has no `score` field, in backend/tests/unit/SessionManager.test.ts (depends on T003)
- [X] T005 [P] Update `SESSION_STATE` payload field names (`currentPhrase`; player entries drop `score`) in backend/src/ws/handlers/authHandler.ts (depends on T002)
- [X] T006 [P] Update `GAME_STARTED`/`PLAYER_JOINED` payload field names (`currentPhrase`; no `score`); delete the `UPDATE_SCORE` handler in backend/src/ws/handlers/gameHandler.ts (depends on T002)
- [X] T007 [P] Update internal field references (`currentPhrase`/`phrases`) in the `SET_PROMPT` handler in backend/src/ws/handlers/promptHandler.ts (depends on T002)
- [X] T008 Vitest integration test: `SESSION_STATE` and `GAME_STARTED` payloads expose `currentPhrase` (not `currentPrompt`) and player entries carry no `score`, in backend/tests/integration/api.test.ts (depends on T005, T006, T007)
- [X] T009 [P] Update `EventMap` types in `WebSocketClient`: rename `currentPrompt`→`currentPhrase` in `SessionStatePayload`/`GAME_STARTED`, drop `score` from player/`PLAYER_JOINED` types, remove `SCORE_UPDATED` in frontend/src/ws/WebSocketClient.ts (depends on T002)
- [X] T010 [P] Create frontend/src/style.css with CSS custom-property design tokens (colors, spacing) per research.md D8
- [X] T011 Update frontend/index.html: `lang="fr"`, French `<title>`, link `style.css`, remove the inline `<style>` block (depends on T010)
- [X] T012 Implement resume-from-localStorage bootstrap routing in frontend/src/main.ts: when there is no story-specific hash on load, check `localStorage` for `playerId`/`playerSessionId` or `hostSessionId`/`token` and route directly to the matching screen instead of defaulting to `#/login`/`#/join` (depends on T009)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Admin creates a game and players join via QR code (Priority: P1) 🎯 MVP

**Goal**: Admin creates a session (with an initial phrase) and gets a QR code
+ join link; any number of players can scan/open it, enter a nickname
(duplicates allowed as-is), and land on a waiting screen with no premature
access to the game screen. Unknown/ended session links show a distinct
message.

**Independent Test**: Admin creates a game on one device; one or more players
join from separate devices using the generated link/QR, entering a nickname
each (including a repeated one) — each lands on a waiting screen without the
game needing to start.

### Tests for User Story 1

- [X] T013 [P] [US1] Vitest integration tests: `POST /api/sessions` accepts optional `initialPhrase` and stores it as `currentPhrase`; `GET /api/sessions/:sessionId/status` returns `{status:'lobby'}` for an existing session and 404 for an unknown one, in backend/tests/integration/api.test.ts
- [X] T014 [P] [US1] Playwright E2E: player opens a join link and sees the French nickname form, submits, and lands on the waiting message with no drawing canvas visible; a player opens a link for an unknown session id and sees "Partie introuvable"; two players join with the identical nickname and both succeed, in frontend/tests/e2e/game-flow.spec.ts

### Implementation for User Story 1

- [X] T015 [US1] Add `initialPhrase` (optional, trimmed) handling to `POST /api/sessions` and add the new unauthenticated `GET /api/sessions/:sessionId/status` route (`{status}` or 404) in backend/src/session/sessionRoutes.ts (depends on T003, T013)
- [X] T016 [P] [US1] Rewrite frontend/src/pages/login.ts: French copy, CSS tokens (depends on T010)
- [X] T017 [P] [US1] Rewrite frontend/src/pages/join.ts: fetch session status before rendering the form, show one of "Partie introuvable" / "La partie a déjà commencé" / "Cette partie est terminée" / the nickname form, persist `playerId`/`playerSessionId` to `localStorage` on success, CSS tokens (depends on T015, T012, T014)
- [X] T018 [P] [US1] Rewrite the session-creation section of frontend/src/pages/lobby-host.ts: "Nouvelle partie" button, initial-phrase field, join URL + QR display, French copy, CSS tokens, `localStorage` for `hostSessionId`/`token` (depends on T015, T012)
- [X] T019 [P] [US1] Restructure frontend/src/pages/game-player.ts to render only the waiting message (no canvas mounted) while session status is `lobby`, in French (depends on T012)

**Checkpoint**: US1 independently testable — admin can create a session and
share a QR/link; any number of players (including duplicate nicknames) can
join and land on a waiting screen; unknown session links show a distinct
message.

---

## Phase 4: User Story 2 - Admin monitors joined players and starts the game (Priority: P2)

**Goal**: Admin's lobby screen shows a live, auto-updating roster of joined
players (including duplicate names, no dedup suffix) and can start the game
once ≥1 player has joined.

**Independent Test**: Join several players (US1) and verify the admin's
screen reflects each arrival without a manual refresh; confirm the admin can
then trigger "start game."

### Tests for User Story 2

- [X] T020 [P] [US2] Vitest unit test: a freshly created session reports zero players (empty roster, not an error/blank state) in backend/tests/unit/SessionManager.test.ts
- [X] T021 [P] [US2] Vitest integration test: `START_GAME` over WS requires ≥1 player and broadcasts `GAME_STARTED` (with `currentPhrase`) to all connected clients, in backend/tests/integration/api.test.ts
- [X] T022 [P] [US2] Playwright E2E: two players join (one using a duplicate nickname), the admin's roster shows both live without a refresh and with no dedup suffix, admin starts the game, both players' screens leave the waiting message, in frontend/tests/e2e/game-flow.spec.ts

### Implementation for User Story 2

- [X] T023 [US2] Add live roster rendering (`SESSION_STATE`, `PLAYER_JOINED`, `PLAYER_DISCONNECTED`, `PLAYER_RECONNECTED` — no dedup suffixing) and the "Commencer la partie" button (disabled until ≥1 player) to frontend/src/pages/lobby-host.ts, French copy, CSS tokens (depends on T018, T009, T021)

**Checkpoint**: US1 + US2 both independently functional — admin sees the
roster update live and can start the game.

---

## Phase 5: User Story 3 - Players see the admin's phrase and draw freely (Priority: P2)

**Goal**: Once the admin starts the game, every player's screen shows the
current phrase as a persistent label plus a private, responsive, smooth
freehand drawing area filling the remaining space in both orientations.

**Independent Test**: Start a game (US2) with ≥1 joined player and confirm
that player's screen shows the current phrase and that touch/pointer input on
the remaining area produces visible strokes immediately.

### Tests for User Story 3

- [X] T024 [P] [US3] Playwright E2E: after the admin starts the game, a player's screen shows the phrase label and an interactive drawing area filling all remaining space; pointer/touch strokes render immediately, in frontend/tests/e2e/game-flow.spec.ts

### Implementation for User Story 3

- [X] T025 [P] [US3] Batch `pointermove` handling via `requestAnimationFrame` instead of drawing synchronously per event; source stroke/background colours from the CSS tokens instead of hardcoded `#ffffff`/`#000000` in frontend/src/canvas/DrawingCanvas.ts (depends on T010)
- [X] T026 [P] [US3] Extend frontend/src/pages/game-player.ts: when `GAME_STARTED` fires (or `SESSION_STATE` reports `status: 'active'`), mount the phrase label + `DrawingCanvas` filling the remaining viewport in both orientations, French copy, CSS tokens (depends on T019, T025)
- [X] T027 [P] [US3] Update frontend/src/pages/game-host.ts: drop the score increment/decrement controls from the player list (names/connection status only), keep the existing optional "Rejoindre en tant que joueur" tab using the updated `DrawingCanvas`, French copy, CSS tokens (depends on T025)

**Checkpoint**: US1 + US2 + US3 independently functional — a started game
shows players the current phrase and a private, smooth drawing surface.

---

## Phase 6: User Story 4 - Admin publishes a new phrase during the game (Priority: P3)

**Goal**: While a game is active, the admin can explicitly publish a new
phrase (not live-as-you-type) that instantly replaces the previous one on
every player's screen; empty submissions are rejected and the previous phrase
stays active.

**Independent Test**: Start a game (US3) and have the admin submit a new
phrase; confirm every connected player's label updates without any player
action, and that submitting a blank phrase is rejected and leaves the
previous phrase in place.

### Tests for User Story 4

- [X] T028 [P] [US4] Vitest integration test: `SET_PROMPT` with blank/whitespace-only `text` is rejected with `VALIDATION_ERROR` and leaves `currentPhrase` unchanged; `SET_PROMPT` while `status !== 'active'` is rejected, in backend/tests/integration/api.test.ts
- [X] T029 [P] [US4] Playwright E2E: admin publishes a new phrase via the explicit submit action and it appears on the player's screen with no player action; admin submits an empty phrase and the previous phrase remains active, in frontend/tests/e2e/game-flow.spec.ts

### Implementation for User Story 4

- [X] T030 [US4] Add blank-text rejection and a `status === 'active'` guard to the `SET_PROMPT` handler in backend/src/ws/handlers/promptHandler.ts (depends on T007, T028)
- [X] T031 [US4] Replace the debounced live-typing `input` listener with an explicit "Valider" submit action (form submit / Enter) for phrase publishing in frontend/src/pages/game-host.ts, French copy (depends on T027, T030)

**Checkpoint**: US1–US4 independently functional — admin can publish new
phrases mid-game via an explicit, validated action.

---

## Phase 7: User Story 5 - Admin ends the game (Priority: P4)

**Goal**: Admin can explicitly end the session at any time; every connected
player moves to a closing screen, and the session stops accepting new phrases
or new players.

**Independent Test**: Start a game (US3/US4) and trigger "end game"; confirm
all connected players move to a closing screen and that the session no longer
accepts phrase updates or new joins.

### Tests for User Story 5

- [X] T032 [P] [US5] Vitest integration test: `END_GAME` sets `status` to `ended`, broadcasts `GAME_ENDED` with no scoreboard payload, a subsequent `SET_PROMPT` is rejected, and `POST /:sessionId/players` returns 409 after end, in backend/tests/integration/api.test.ts
- [X] T033 [P] [US5] Playwright E2E: admin ends an in-progress game, all connected players move to the closing screen, and a fresh join attempt at the same URL shows "Cette partie est terminée", in frontend/tests/e2e/game-flow.spec.ts

### Implementation for User Story 5

- [X] T034 [US5] Update the `END_GAME` handler to broadcast `GAME_ENDED` with an empty payload (no scoreboard) in backend/src/ws/handlers/gameHandler.ts (depends on T006, T032)
- [X] T035 [US5] Delete frontend/src/pages/scoreboard.ts; create frontend/src/pages/closing.ts (French "Partie terminée" closing screen, no scores); update the route registration and wire `GAME_ENDED` navigation from lobby-host.ts, game-host.ts, and game-player.ts to it in frontend/src/main.ts (depends on T034, T023, T031, T026)

**Checkpoint**: All five user stories independently functional — the full
spec is implemented end-to-end.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T036 [P] Sweep every page/component touched by this feature for any remaining hardcoded hex/rgb/px literal not covered by the CSS tokens (Constitution: Frontend & UX Standards)
- [X] T037 [P] Manually verify PWA install and offline static-asset caching still work after the `index.html`/`style.css` changes
- [X] T038 Run `npm run build --workspaces`, `npm test --workspace=backend`, `npm run test:e2e --workspace=frontend`; fix any failures (Constitution: Development Workflow gate) (depends on T001–T037)
- [ ] T039 Execute the manual golden-path checklist in specs/001-draw-guess-mobile/quickstart.md on a real or emulated mobile device, in both portrait and landscape (FR-016) (depends on T038)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–7)**: All depend on Foundational completion.
  - US1 (P1) has no dependency on other stories.
  - US2 (P2) builds on US1's `lobby-host.ts` creation section (T018) and the join flow it enables.
  - US3 (P2) builds on US1's `game-player.ts` waiting-state shell (T019).
  - US4 (P3) builds on US3's `game-host.ts` (T027).
  - US5 (P4) builds on US1/US2/US3/US4's navigation targets (T023, T026, T031) to know where to redirect on `GAME_ENDED`.
  - This dependency chain matches the spec's own stated priority order (each story's "Why this priority" explicitly builds on the previous one) — it is not an artificial constraint.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- Foundational: `{T003, T005, T006, T007, T009}` can run in parallel once T002 is done (5 distinct files); `T010` has no dependency at all and can start immediately alongside T002.
- US1: `{T016, T017, T018, T019}` can run in parallel once their respective backend/foundational prerequisites land (4 distinct frontend files).
- US2/US4/US5 test tasks (`T020`–`T022`, `T028`/`T029`, `T032`/`T033`) can each run in parallel within their phase (distinct files).
- US3: `{T026, T027}` can run in parallel once `T025` is done.
- Polish: `T036` and `T037` can run in parallel.

---

## Parallel Example: Foundational Phase

```bash
# After T002 (types.ts rename) completes, launch together:
Task: "Update SessionManager.ts — drop dedup + score, accept initialPhrase (backend/src/session/SessionManager.ts)"
Task: "Update authHandler.ts SESSION_STATE payload field names (backend/src/ws/handlers/authHandler.ts)"
Task: "Update gameHandler.ts payload field names, delete UPDATE_SCORE (backend/src/ws/handlers/gameHandler.ts)"
Task: "Update promptHandler.ts field references (backend/src/ws/handlers/promptHandler.ts)"
Task: "Update WebSocketClient.ts EventMap types (frontend/src/ws/WebSocketClient.ts)"
```

## Parallel Example: User Story 1

```bash
# Once T015 (sessionRoutes.ts) and T012 (bootstrap routing) are done, launch together:
Task: "Rewrite login.ts — French, tokens (frontend/src/pages/login.ts)"
Task: "Rewrite join.ts — status precheck, 3-way message, French, tokens, localStorage (frontend/src/pages/join.ts)"
Task: "Rewrite lobby-host.ts creation section — French, tokens, localStorage (frontend/src/pages/lobby-host.ts)"
Task: "Restructure game-player.ts — waiting-only state (frontend/src/pages/game-player.ts)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run T013/T014 green, walk the US1 portion of `quickstart.md` manually.
5. Demo: admin creates a session, players join and see a waiting screen.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → demo: QR/link join + waiting screen (MVP).
3. + US2 → demo: live roster + start.
4. + US3 → demo: full drawing gameplay.
5. + US4 → demo: mid-game phrase changes.
6. + US5 → demo: full session lifecycle, ends cleanly.
7. Polish → build/test/e2e gate green, manual mobile walkthrough complete.

Each increment adds value without breaking the previous one, matching the
spec's own priority ordering (P1 → P2 → P2 → P3 → P4).

---

## Notes

- [P] tasks touch different files and have no same-phase dependency on an incomplete task.
- Every `SessionManager`/HTTP/WS behavior change has a Vitest test in the same or an earlier task; every user-facing flow change has a Playwright scenario — per Constitution Principle II, both must be green before the corresponding story is "done."
- Commit after each task or logical group (per repo convention — see recent commit history for message style).
- Stop at any checkpoint to validate a story independently before continuing.
- No task in this list adds a new npm dependency (see research.md summary table).
