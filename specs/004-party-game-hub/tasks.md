---

description: "Task list for Hub de mini-jeux, parties configurables et podium"

---

# Tasks: Hub de mini-jeux, parties configurables et podium

**Input**: Design documents from `/specs/004-party-game-hub/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included and REQUIRED, not optional — Constitution Principle II ("Test-First for Game
Logic and Flows") mandates a Vitest unit test for new/changed `SessionManager` behavior, a
backend integration test for new/changed HTTP or WebSocket contracts, and a Playwright E2E
scenario for any change to the user-facing flow, before a change is considered done.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md's P1/P2/P3) so
each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no ordering dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

## Path Conventions

Existing web-application layout (`plan.md` § Project Structure): `backend/src/`, `backend/tests/`,
`frontend/src/`, `frontend/tests/`.

---

## Phase 1: Setup

**Purpose**: Add the one new dependency and the visual assets every later screen will need.

- [X] T001 Add `zod` to `backend/package.json` dependencies and run `npm install` (root workspace)
- [X] T002 [P] Add self-hosted `Bricolage Grotesque` and `Caveat` `.woff2` files under
      `frontend/src/fonts/` (per research.md — self-hosted, not a Google Fonts `<link>`, to
      preserve PWA offline installability)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, schemas, WS client types, and visual tokens that every user story
depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Extend `backend/src/session/types.ts`: add `SessionSettings` interface, add
      `settings: SessionSettings` and `roundScores: Map<number, Map<string, number>>` to
      `Session`, add `finishedCurrentRound: boolean` to `Player` (per data-model.md)
- [X] T004 [P] Create `backend/src/schemas/sessionSettings.ts` — `zod` schema for
      `{ roundDurationSec, maxRounds, maxPlayers, pointsEnabled }` with the enum constraints and
      defaults from data-model.md / contracts/http-api.md
- [X] T005 Extend `backend/src/session/SessionManager.createSession()` in
      `backend/src/session/SessionManager.ts` to accept an optional `settings` argument, apply
      defaults (60s / 3 manches / 8 joueurs / points activés) for any omitted field, and
      initialize `roundScores` as an empty `Map` (depends on T003)
- [X] T006 [P] Extend `frontend/src/ws/WebSocketClient.ts` `EventMap`: add `finishedCurrentRound`
      to `SESSION_STATE.players[]`, add `settings` and `cumulativeScores` to `SESSION_STATE`, add
      `maxRounds` to `QUESTION_ADVANCED`, add `pointsEnabled` and `results` to `GAME_ENDED`, add
      new `PLAYER_FINISHED` and `SCORES_UPDATED` event types (per contracts/websocket-events.md)
- [X] T007 [P] Declare `@font-face` rules for the fonts added in T002 in `frontend/src/style.css`
      (depends on T002)
- [X] T008 Retheme the `:root` custom-property tokens in `frontend/src/style.css` to the
      prototype's palette and typography (background/surface/accent/accent-secondary colors,
      `--font-display`/`--font-hand` referencing the fonts from T007, spacing/radius values as
      needed) — no hardcoded hex/px introduced in any `.ts` file, per Constitution "Frontend & UX
      Standards" (depends on T007)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Parties configurables en manches limitées et chronométrées (Priority: P1) 🎯 MVP

**Goal**: An admin can configure round duration / round count / indicative player cap, run the
game through a bounded, host-visible, timed sequence of rounds, and cannot advance past the
configured round count (server- and client-enforced).

**Independent Test**: Create a session with custom settings (e.g. 30s / 3 manches), have a player
join, start the game, send a question, advance through all 3 rounds — the round counter and
countdown update correctly at every step and advancing is refused past round 3.

### Tests for User Story 1

> Write these tests FIRST, ensure they FAIL before implementation (Constitution Principle II).

- [X] T009 [US1] Add unit tests to `backend/tests/unit/SessionManager.test.ts`: `createSession`
      applies default settings when none are given, stores custom settings when given, and the
      round-advance path rejects advancing past `settings.maxRounds`
- [X] T010 [P] [US1] Add integration tests to `backend/tests/integration/api.test.ts`:
      `POST /api/sessions` persists custom settings and rejects out-of-enum values (400); the
      round-advance WS message is refused with `INVALID_STATE` at the last configured round
- [X] T011 [P] [US1] Add a Playwright scenario to `frontend/tests/e2e/game-flow.spec.ts`: host
      creates a session with non-default settings, starts it, advances through every configured
      round (counter and countdown visible and correct), and the UI no longer offers to advance
      further at the last round

### Implementation for User Story 1

- [X] T012 [US1] Extend `backend/src/session/sessionRoutes.ts` `POST /` handler to validate the
      request body with the T004 schema and pass the resulting settings to `createSession`
      (depends on T004, T005)
- [X] T013 [P] [US1] Extend the round-advance WebSocket handling in
      `backend/src/ws/handlers/gameHandler.ts` (or a renamed/new handler per the
      contracts/websocket-events.md implementation note): enforce the `maxRounds` guard, reset
      every player's `finishedCurrentRound` to `false` on advance, include `maxRounds` in the
      `QUESTION_ADVANCED` broadcast (depends on T003)
- [X] T014 [US1] Extend `sendSessionState` in `backend/src/ws/handlers/authHandler.ts` to include
      `settings` in the `SESSION_STATE` payload (depends on T003)
- [X] T015 [US1] Create `frontend/src/pages/config.ts`: duration (30/60/90/120s), round count
      (3/5/10), indicative player cap (4/8/12/16) chips and the "Compter les points" toggle;
      submits `POST /api/sessions` with the chosen settings and navigates to the lobby on success;
      styled with the Foundational tokens (depends on T012, T008)
- [X] T016 [US1] Register the `#/host/config` route in `frontend/src/main.ts` and set it as the
      post-login destination in `frontend/src/pages/login.ts` (temporary entry point, superseded
      by the hub in US3) (depends on T015)
- [X] T017 [P] [US1] Extend `frontend/src/pages/lobby-host.ts` to show the indicative
      "X/maxPlayers joueurs" label from `SESSION_STATE.settings.maxPlayers` (depends on T006,
      T014)
- [X] T018 [P] [US1] Extend `frontend/src/pages/game-host.ts`: render "Manche N/M" from
      `roundIndex`/`maxRounds`, start/reset a host-local countdown (`settings.roundDurationSec`)
      on `GAME_STARTED`/`QUESTION_ADVANCED` that never auto-advances, and disable/relabel the
      "manche suivante" action once the last configured round is reached (depends on T006, T013)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable (MVP).

---

## Phase 4: User Story 2 - L'admin note les manches et tout le monde consulte le classement final (Priority: P2)

**Goal**: Players can signal they're done drawing; the host sees live per-player status, scores
each round in person with free-form points (never blocking), and everyone lands on a matching
podium/results screen at game end.

**Independent Test**: With "Compter les points" enabled, play several rounds, have each player
click "J'ai fini", score at least one round from the host, deliberately skip scoring another,
end the game, and confirm host and players see an identical, correctly-totaled podium/list.

### Tests for User Story 2

> Write these tests FIRST, ensure they FAIL before implementation (Constitution Principle II).

- [X] T019 [US2] Add unit tests to `backend/tests/unit/SessionManager.test.ts`: awarding round
      points is idempotent (re-awarding the same round overwrites rather than accumulates), an
      unscored round contributes 0 to every player's total, and computed results are correctly
      ranked with ties broken by join order
- [X] T020 [P] [US2] Add integration tests to `backend/tests/integration/api.test.ts`:
      `MARK_DRAWING_DONE` sets/broadcasts finished status and is rejected for non-players;
      `AWARD_ROUND_POINTS` is host-only, validates `points`, and is never blocked by an unscored
      earlier round; `END_GAME` broadcasts `GAME_ENDED` with `pointsEnabled` and ranked `results`
      matching the awarded points; results omit point totals when `pointsEnabled` is false
- [X] T021 [P] [US2] Add a Playwright scenario to `frontend/tests/e2e/game-flow.spec.ts`: a
      player clicks "J'ai fini" and the host sees their status change; the host scores rounds
      (including skipping one), ends the game, and both host and player land on a results screen
      showing a matching top-3 podium and full ranked list

### Implementation for User Story 2

- [X] T022 [US2] Add `setFinishedCurrentRound`, `awardRoundPoints`, and `computeResults` methods
      to `backend/src/session/SessionManager.ts` per data-model.md's idempotency and derived-total
      rules (depends on T003, T005)
- [X] T023 [P] [US2] Create `backend/src/schemas/roundScoring.ts` — `zod` schemas for
      `MARK_DRAWING_DONE` and `AWARD_ROUND_POINTS` payloads (per contracts/websocket-events.md)
- [X] T024 [US2] Create `backend/src/ws/handlers/scoringHandler.ts` implementing
      `MARK_DRAWING_DONE` (host-only guard N/A — player-only; broadcasts `PLAYER_FINISHED`) and
      `AWARD_ROUND_POINTS` (host-only; broadcasts `SCORES_UPDATED`); register it in
      `backend/src/index.ts` (depends on T022, T023)
- [X] T025 [US2] Extend the `END_GAME` handler in `backend/src/ws/handlers/gameHandler.ts` to call
      `computeResults` and include `pointsEnabled` + ranked `results` in the `GAME_ENDED`
      broadcast (depends on T022)
- [X] T026 [US2] Extend `sendSessionState` in `backend/src/ws/handlers/authHandler.ts` to include
      each player's `finishedCurrentRound` and the session's `cumulativeScores` in `SESSION_STATE`
      (depends on T022; extends the same function as T014)
- [X] T027 [P] [US2] Extend `frontend/src/pages/game-player.ts`: add a "J'ai fini" action that
      sends `MARK_DRAWING_DONE` and shows a waiting sub-state until the next question or game end
      (depends on T006, T024)
- [X] T028 [US2] Extend `frontend/src/pages/game-host.ts`: show each player's live status
      ("dessine…" / "a terminé") from `PLAYER_FINISHED`/`SESSION_STATE`, and add a free-form
      points-entry control per player that sends `AWARD_ROUND_POINTS` (never blocking round
      advance/end) (depends on T006, T024, T026, T018)
- [X] T029 [US2] Create `frontend/src/pages/results.ts`: podium (top 3) + full ranked list when
      `pointsEnabled`, plain participant list otherwise; "on rejoue" (re-`POST /api/sessions` with
      the same settings) and "retour au hub" (targets `#/host/config` for now, updated in US3)
      actions; styled with the Foundational tokens; this replaces `frontend/src/pages/closing.ts`
      (depends on T025, T008)
- [X] T030 [US2] Register the `#/results` route in `frontend/src/main.ts`, point the
      `GAME_ENDED` handlers in `game-host.ts` and `game-player.ts` at it instead of `#/closing`,
      and delete `frontend/src/pages/closing.ts` (depends on T029)

**Checkpoint**: User Stories 1 AND 2 both work independently and together.

---

## Phase 5: User Story 3 - L'admin choisit son jeu depuis un hub après connexion (Priority: P3)

**Goal**: Post-login, the admin sees a hub of mini-games; only "L'Ardoise" is selectable and leads
to the configuration screen, other entries are visually present but inert.

**Independent Test**: Log in, confirm the hub shows "L'Ardoise" as playable and at least one other
entry as "bientôt disponible", confirm clicking the disabled entry does nothing, confirm clicking
"L'Ardoise" reaches the configuration screen.

### Tests for User Story 3

> Write this test FIRST, ensure it FAILS before implementation (Constitution Principle II).

- [X] T031 [P] [US3] Add a Playwright scenario to `frontend/tests/e2e/game-flow.spec.ts`: after
      login, the hub renders "L'Ardoise" as playable and another entry as disabled; clicking the
      disabled entry causes no navigation; clicking "L'Ardoise" reaches `#/host/config`

### Implementation for User Story 3

- [X] T032 [P] [US3] Create `frontend/src/data/gameCatalog.ts` — the static
      `GameCatalogEntry[]` array (only `key: 'ardoise'` has `playable: true`), per data-model.md
- [X] T033 [US3] Create `frontend/src/pages/hub.ts` rendering the catalog with playable/disabled
      states, styled with the Foundational tokens (depends on T032, T008)
- [X] T034 [US3] Register the `#/host/hub` route in `frontend/src/main.ts` and change the
      post-login destination in `frontend/src/pages/login.ts` from `#/host/config` (T016) to
      `#/host/hub` (depends on T033)
- [X] T035 [US3] Update the "retour au hub" action in `frontend/src/pages/results.ts` to target
      `#/host/hub` instead of the interim `#/host/config` (depends on T033, T029)

**Checkpoint**: All three user stories are independently functional and wired together end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency and quality gates across the whole feature (Constitution
"Development Workflow & Quality Gates").

- [X] T036 [P] Retheme `frontend/src/pages/join.ts` to the Foundational tokens for full visual
      consistency (SC-005) — the only remaining screen not touched by US1-3
- [X] T037 Run `npm run build` in both workspaces and fix any type errors surfaced by the new
      fields/schemas
- [X] T038 Run `npm test` (backend Vitest) and confirm all new and existing tests are green
- [X] T039 Run `npm run test:e2e` (frontend Playwright) and confirm the full golden path (login →
      hub → config → lobby → rounds → scoring → results) is green
- [X] T040 Execute `specs/004-party-game-hub/quickstart.md` manually end to end and confirm every
      step, including the offline/PWA font-caching regression check

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T002 → T007) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion — no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational completion; extends the same
  `authHandler.ts`/`game-host.ts` files US1 touches, so is implemented after US1 in practice, but
  its own acceptance scenarios don't require US1's round-limit guard to exist
- **User Story 3 (Phase 5)**: Depends on Foundational completion; its only integration points
  with US1/US2 are two one-line link-target updates (T016's temporary destination, T029's
  temporary button target)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before their corresponding implementation task
- Backend types/schemas before backend services before backend WS handlers before frontend pages
- Frontend pages before route registration that makes them reachable

### Parallel Opportunities

- T002 (Setup) has no dependency and can start immediately
- T004, T006, T007 (Foundational) touch different files and can run in parallel once T003/T002
  are done, respectively
- Within US1: T010, T011 (different test files) in parallel; T013, T017, T018 (different files,
  contract already fixed by contracts/websocket-events.md) in parallel
- Within US2: T020, T021 (different test files) in parallel; T023 in parallel with T022; T027 in
  parallel with T028's start (both depend on T024/T026 but touch different files)
- Within US3: T031, T032 in parallel

---

## Parallel Example: User Story 1

```bash
# Tests (different files):
Task: "Integration tests for POST /api/sessions settings + round-advance guard in backend/tests/integration/api.test.ts"
Task: "Playwright scenario for full-round-sequence in frontend/tests/e2e/game-flow.spec.ts"

# Implementation (different files, contract-driven):
Task: "Round-advance guard + QUESTION_ADVANCED payload in backend/src/ws/handlers/gameHandler.ts"
Task: "Indicative player-count label in frontend/src/pages/lobby-host.ts"
Task: "Round counter + host-local countdown in frontend/src/pages/game-host.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run the Story 1 section of `quickstart.md` independently
5. Demo: configurable, bounded, timed rounds — no scoring, no hub yet (login lands directly on
   the config screen)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → MVP demo
3. Add User Story 2 → validate independently → in-person scoring + podium demo
4. Add User Story 3 → validate independently → hub becomes the real entry point
5. Polish → full quickstart.md pass, build/test/e2e all green

---

## Notes

- [P] tasks touch different files and have no ordering dependency on another incomplete task in
  the same phase
- [Story] label maps every implementation/test task to its user story for traceability
- Commit after each task or logical group (per repository convention — new commits, not amends)
- Stop at any checkpoint to validate a story independently before continuing
- `ARCHITECTURE.md` describes an outdated/aspirational design (image transmission, digital
  scoring dashboard) — do not follow it; follow contracts/data-model.md instead (see research.md)
