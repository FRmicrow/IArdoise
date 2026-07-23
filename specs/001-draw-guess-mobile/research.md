# Phase 0 Research: Mobile Drawing Party Game

**Feature**: `001-draw-guess-mobile` | **Date**: 2026-07-23

## Context

This feature is not greenfield. An existing Fastify + Vite implementation already
lives in `backend/` and `frontend/` (a host-scored, QR-join drawing game — see
`ARCHITECTURE.md`). The technology stack is therefore fixed by the existing
codebase, not chosen fresh. Research below resolves how the new spec's
requirements (FR-001…FR-026) map onto that codebase: what is reusable as-is,
what must change, and what must be removed because it now contradicts the spec.

Each decision was resolved by reading the current implementation directly
(`backend/src/session/*`, `backend/src/ws/*`, `frontend/src/pages/*`,
`frontend/src/canvas/*`), not by external research — there are no
NEEDS CLARIFICATION technology unknowns.

## Decisions

### D1 — Reuse existing real-time infrastructure

**Decision**: Keep `SessionManager` (singleton, in-memory `Map`), `WsRouter`,
`connectionRegistry`, and `broadcast.ts` as the backbone for session/player/prompt
state and fan-out. Extend, don't replace.

**Rationale**: This is exactly the `SessionManager`-as-single-source-of-truth
design mandated by Constitution Principle I. It already satisfies FR-001, 002,
003, 007, 008, 009, 010, 015, 017.

**Alternatives considered**: Rewriting session state management — rejected,
violates Principle V (Minimal-Footprint, YAGNI).

### D2 — Remove nickname deduplication

**Decision**: Delete the `dedupName` call in `SessionManager.addPlayer`
(and the now-unused `nameDedup.ts` / its test). Player names are stored exactly
as submitted (trimmed).

**Rationale**: FR-022 and the 2026-07-23 clarification explicitly require
duplicate nicknames to be allowed and shown as-is. The current "Alice" →
"Alice 2" behavior directly violates this.

**Alternatives considered**: Keep dedup opt-out via a flag — rejected, YAGNI;
the spec never wants dedup in this feature.

### D3 — Remove the scoring subsystem from this feature's surface

**Decision**: Remove `score` from `Player`, delete the `UPDATE_SCORE` WS
handler and `SCORE_UPDATED` event, delete the increment/decrement buttons in
the host game view, delete `scoreboard.ts` / the `#/scoreboard` route. Ending a
game (`END_GAME`) broadcasts `GAME_ENDED` with no scoreboard payload; clients
navigate to a simple closing screen.

**Rationale**: The spec's Assumptions section is explicit: "no admin or peer
spectating, gallery, or scoring feature is included in this iteration."
Leaving the scoring UI in place would ship a contradiction between what the
spec describes (a shared-prompt, freehand drawing toy) and what the app
actually shows the admin (a scored Pictionary judge panel). Per Principle V,
dead/contradictory UI is worse than removing it — this is a root-cause fix,
not scope creep.

**Alternatives considered**: Keep scoring but hide it — rejected, adds
maintenance cost for a feature explicitly out of scope, and the WS
handler would still be reachable/untested against the new spec.

### D4 — Explicit "publish" action for phrases, not live-as-you-type broadcast

**Decision**: Replace the current 300ms-debounced `input` listener (which
broadcasts every keystroke) with an explicit submit action (form + "Valider"
button / Enter key) for both the initial phrase (at session creation) and
subsequent phrases (`SET_PROMPT` during an active game). Add a server-side
guard in the `SET_PROMPT` handler: reject empty/blank `text` with a
`VALIDATION_ERROR` and leave `session.currentPrompt` untouched.

**Rationale**: FR-013 ("admin enters a new phrase **and confirms it**") and
FR-014 (reject empty submissions, keep the previous phrase active) both
describe a discrete confirm action, not live streaming of partial keystrokes.
The current handler has no empty-string guard at all, so an admin clearing the
input field mid-edit currently blanks every player's screen — a direct FR-014
violation.

**Alternatives considered**: Keep debounce but add empty-guard — rejected,
still leaks partial phrases to players while the admin is mid-sentence, which
reads as broken to end users.

### D5 — Distinguish "not found" vs "already started" vs "ended" on join

**Decision**: Add `GET /api/sessions/:sessionId/status` (no auth — players are
anonymous), returning `{ status: 'lobby' | 'active' | 'ended' }` or 404. The
join page calls this before rendering the nickname form and shows one of three
distinct messages: "Partie introuvable" (404), "La partie a déjà commencé"
(active), or "Cette partie est terminée" (ended). Only the `lobby` status
renders the nickname form. The existing `POST /:sessionId/players` 409 guard
(`status !== 'lobby'`) is unchanged — it already blocks late joins server-side.

**Rationale**: FR-026 mandates a message distinct from "ended" for a
never-existed session. The spec's Edge Cases section separately raises "what
happens on late join?" without resolving it into an FR; reusing the same
status check to give it a clear, non-misleading message (rather than the
current generic "Registration closed" for both active and ended) is a natural,
low-risk extension of the same mechanism — it does not change any accepted
behavior (late joins were already rejected), only the message shown.

**Alternatives considered**: Only fix the 404-vs-ended distinction and leave
"active" bucketed under the ended message — rejected, would be misleading
("this game doesn't exist" when it does, just started).

### D6 — Fix reconnection-on-relaunch, not just reconnection-in-tab

**Decision**: On app bootstrap (`main.ts`), when there is no route-specific
hash (fresh load / relaunch from home screen), check `localStorage` for an
existing player or host session identifier *before* falling back to
`#/login`/join, and resume directly to the correct screen (waiting, game, or
host lobby/game).

**Rationale**: FR-023/FR-024 require resuming without re-entering a nickname
"upon reconnecting from the same device/browser." The current routing only
resumes automatically because the WebSocket reconnects while the tab stays
open and `window.location.hash` is already `#/player/game`. An installed PWA
relaunched from the home screen starts a **new** top-level browsing context at
the manifest `start_url` with no hash — today that falls through to
`routes['#/login']`, silently losing the player's/host's session. This is the
single biggest gap against FR-023/024 as written.

### D7 — Switch identity persistence from `sessionStorage` to `localStorage`

**Decision**: Store `playerId`, `playerSessionId`, `hostSessionId`, and the
host `token` in `localStorage` instead of `sessionStorage`.

**Rationale**: `sessionStorage` is scoped to a single browsing-context
instance and does not survive a fully closed-and-reopened PWA (a new
browsing context is created on relaunch) — it only survives backgrounding a
still-open tab. FR-023's explicit scenario ("app backgrounded, device locked,
brief network loss... resume... without re-entering their nickname") plus the
Assumption "tied to the same device/browser" both point at `localStorage`
persistence. No backend change is needed — identifiers are already opaque
UUIDs.

### D8 — Introduce CSS design tokens; stop inlining hex/px styles

**Decision**: Add `frontend/src/style.css` with CSS custom properties
(`--color-bg`, `--color-surface`, `--color-text`, `--color-accent`,
`--space-*`, etc.), imported once from `main.ts`. Rewrite the page templates
touched by this feature (join, lobby, host game, player game, closing screen)
to use classes referencing those tokens instead of inline
`style="padding: 24px; background: #000..."` strings. The one hardcoded stroke
colour (`#ffffff`) and canvas background (`#000000`) in `DrawingCanvas.ts`
become references to the same token values (read once at construction, since
canvas fill/stroke APIs need resolved colour strings, not CSS variables).

**Rationale**: The Frontend & UX Standards section is unambiguous: "Styling
MUST use CSS custom-property (design token) values rather than hardcoded
hex/rgb/px literals scattered across components." Today there is no CSS file
at all in `frontend/src` — every colour and spacing value is a literal inline
string. Every page this feature touches must be rewritten for French copy
anyway (D-FR-025 below), so doing the token migration in the same pass avoids
a second sweep later, in keeping with Principle V (minimal footprint: only
touch what this feature already touches).

**Alternatives considered**: Defer token migration to a separate cleanup —
rejected; every touched page already needs a full rewrite for French text and
the removed scoring UI, so deferring only means editing the same lines twice.
Pages **not** touched by this feature (none remain, in practice — see Project
Structure) are out of scope.

### D9 — Batch pointer input via `requestAnimationFrame`

**Decision**: In `DrawingCanvas`, buffer incoming `pointermove` points and
flush/draw them on the next animation frame via `requestAnimationFrame`,
instead of calling `context.stroke()` synchronously inside every
`pointermove` listener invocation.

**Rationale**: The Frontend & UX Standards section requires canvas drawing to
"target 60fps rendering via `requestAnimationFrame`." The current
implementation draws synchronously per DOM event, which is fine on modern
hardware but is exactly the pattern the constitution calls out to avoid, and
SC-005 requires no noticeable input lag with up to 20 players drawing
concurrently on varied (often low-end) mobile hardware.

**Note**: This is purely a local rendering change. Drawings are never
transmitted (FR-018 — canvases stay private), so there is no WebSocket
draw-event throttling to add; the existing architecture note about ~100ms
draw-event throttling does not apply to this feature.

### D10 — Keep shared host-password login; it does not violate the "anonymous admin" assumption

**Decision**: Keep the existing `POST /api/auth/login` flow
(`HOST_USERNAME`/`HOST_PASSWORD_HASH` env vars, bcrypt, JWT via `jose`)
unchanged (copy translated to French only).

**Rationale**: Constitution Principle IV (Secure by Default, NON-NEGOTIABLE)
requires every host-only action to verify an authenticated host via JWT. The
spec's Assumption ("no account creation, login, or persistent identity is
required... Admin... modeled as the owner/controller of a Game Session rather
than a persistent account") is about *not having a personal admin profile*,
not about having zero authentication gate. A single shared credential that
grants "host" capability for whichever session is created next is not account
creation — no admin identity is stored, tracked, or distinguished from any
other admin. The two requirements are compatible as already implemented; no
change needed beyond translating the login page copy to French (FR-025).

## Summary of required changes by area

| Area | Change | Driving requirement(s) |
|---|---|---|
| `SessionManager` / `types.ts` | drop `score`; drop `dedupName` call | FR-022, spec Assumptions |
| `nameDedup.ts` + its test | delete | FR-022 |
| `promptHandler.ts` (`SET_PROMPT`) | reject empty text; require `status === 'active'` (or session exists, for the initial phrase set at creation) | FR-013, FR-014, FR-021 |
| `gameHandler.ts` (`UPDATE_SCORE`) | delete handler | spec Assumptions (no scoring) |
| `gameHandler.ts` (`END_GAME`) | drop scoreboard payload | spec Assumptions (no scoring) |
| `sessionRoutes.ts` | add `GET /:sessionId/status` | FR-026 |
| `playerRoutes.ts` | keep 409-on-non-lobby; response body unchanged (message now decided client-side from the new status endpoint) | FR-026, Edge Case (late join) |
| `join.ts` | fetch status before rendering form; 3-way message; French copy; localStorage | FR-025, FR-026, FR-023 |
| `lobby-host.ts` | explicit phrase publish; remove any scoring; French copy; CSS tokens; localStorage | FR-013, FR-014, FR-025, D8, D7 |
| `game-host.ts` | remove score increment/decrement UI and "My Canvas" scoring tie-in adjustments; explicit publish; French copy; CSS tokens | spec Assumptions, FR-013, FR-025, D8 |
| `game-player.ts` | hide/disable drawing until `GAME_STARTED`; French copy; CSS tokens | FR-006, FR-025, D8 |
| `scoreboard.ts` | replace with a minimal closing/summary screen (no scores) | FR-020, spec Assumptions |
| `DrawingCanvas.ts` | rAF batching; colours from tokens | D9, D8 |
| `main.ts` | bootstrap resume-from-localStorage routing | FR-023, FR-024 |
| `style.css` (new) | design tokens | D8 |
| `index.html` | link `style.css`; `lang="fr"`; translated `<title>` | FR-025 |

No new npm dependency is required for any of the above.
