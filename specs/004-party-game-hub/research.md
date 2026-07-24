# Research: Hub de mini-jeux, parties configurables et podium

Source of truth for all findings below: direct inspection of the current `backend/src` and
`frontend/src` trees (branch `004-party-game-hub`, based on `003-mobile-canvas-tools`), not
`ARCHITECTURE.md`. `ARCHITECTURE.md` describes an earlier/aspirational design (per-pixel
`canvasData` WebSocket transmission, host digital scoring dashboard, `Session.scores` map) that
does **not** match the real implementation — the actual `Session`/`Player` types
(`backend/src/session/types.ts`) have no drawing-transmission or scoring fields at all, and
`DrawingCanvas`/`game-player.ts` never send canvas pixels anywhere. This mismatch is a
documentation gap outside this feature's scope; the plan below is grounded in the real code.

## Decision: In-person scoring, no image transmission infrastructure

**Decision**: No canvas image, snapshot, or stream is ever sent from player to server or to the
host. The host awards points by physically looking at players' screens (confirmed clarification
answer, session 2026-07-24).

**Rationale**: Confirmed by code audit — no drawing-transmission path exists today
(`frontend/src/canvas/DrawingCanvas.ts` is purely local; `game-player.ts` never emits draw data
over the `WebSocketClient`). Building image capture + upload + temporary storage would be new,
unrequested infrastructure, conflicting with Constitution V (Minimal-Footprint, YAGNI) and with
the prototype's own framing ("Toi tu animes, eux ils scannent" — a same-room party game).

**Alternatives considered**: transmitting a captured canvas snapshot per player (rejected — new
upload/storage infra, no requirement for it); live-streaming strokes to the host (rejected — even
larger scope, no requirement).

## Decision: Round timer is host-local and purely visual

**Decision**: The per-round countdown (FR-007) is computed and rendered entirely client-side on
the host's own device, reset to `settings.roundDurationSec` whenever a `GAME_STARTED` or
`QUESTION_ADVANCED` event is received. No timer state is stored on `Session` or broadcast.

**Rationale**: The clarified behavior is that the timer never triggers a state transition — it is
informational only, and only the host needs to see it (spec explicitly scopes it to "visible par
l'admin"). A server-side timer would add scheduling state and reconnect-resume complexity for
zero functional benefit (Constitution V).

**Alternatives considered**: server-authoritative timer broadcast to all clients (rejected — no
player-facing requirement, unnecessary complexity); persisting timer start time on `Session` for
resume (rejected — a resumed host can simply restart its local countdown from
`settings.roundDurationSec`; the spec's resume requirement, FR-019, only requires round number,
phrase, and points already noted to survive, not exact remaining seconds).

## Decision: Adopt `zod` for all new HTTP/WS payload schemas

**Decision**: Add `zod` as a new backend dependency. Every new or modified HTTP request body and
every new or modified WebSocket message payload introduced by this feature MUST be validated with
a `zod` schema before touching `SessionManager` state, per Constitution III (Type-Safe, Validated
Boundaries).

**Rationale**: The existing codebase validates manually (`typeof x !== 'string'` checks scattered
across handlers) rather than "against a schema" as the constitution literally requires. This
feature touches enough new untrusted-input surface (game settings, score payloads, finish
signals) that introducing a real schema library pays for itself immediately, and it does not
require touching already-working, already-tested existing handlers (Constitution V — smallest
change that satisfies the spec; existing manual checks are left alone).

**Alternatives considered**: keep manual `typeof` validation for consistency with existing code
(rejected — does not satisfy Constitution III's "against a schema" requirement for new
boundaries); `io-ts` or `ajv` (rejected — heavier / less idiomatic in a small TypeScript-first
codebase than `zod`).

## Decision: Self-host the two prototype fonts instead of a Google Fonts `<link>`

**Decision**: Download `Bricolage Grotesque` and `Caveat` (the two fonts used throughout the
prototype) as static `woff2` files served from the frontend build, declared via local `@font-face`
rules in `style.css`, instead of the prototype's `<link href="https://fonts.googleapis.com/...">`.

**Rationale**: Constitution "Frontend & UX Standards" requires the PWA's cached static assets to
remain usable offline. A cross-origin Google Fonts `<link>` is not covered by the existing
`vite-plugin-pwa` precache manifest and would silently fail (fallback to system font) for an
installed, offline PWA session — a regression the prototype (a non-PWA design mockup) never had to
consider.

**Alternatives considered**: keep the Google Fonts CDN link and accept an offline font fallback
(rejected — regresses an existing, constitution-mandated guarantee); use a system-font stack that
visually approximates the prototype (rejected — the prototype's identity depends on the display
font (`Caveat`) for its hand-written accents; a system substitute would materially miss FR-018's
"conforme au prototype de référence").

## Decision: Game catalog (hub) is static frontend data, not a backend entity

**Decision**: The list of mini-games shown on the hub screen (US3, FR-001/FR-002) is a hardcoded
array in the frontend (name, description, `playable: boolean`), not a new database/session
concept. Only one entry (`"L'Ardoise"`) is `playable: true`.

**Rationale**: Constitution V — no persistent storage or new abstraction the current feature does
not need. There is exactly one real, playable game; the spec's Assumptions section explicitly
scopes the other catalog entries as non-functional placeholders. Backing this with a server-side
"games" concept would be speculative for a single-entry list.

**Alternatives considered**: a backend `/api/games` endpoint (rejected — no data varies by
request, no auth/session concern, purely presentational; would be premature structure).

## Decision: Round-limit enforcement lives in both frontend and backend

**Decision**: The frontend hides/relabels the "manche suivante" action once
`roundIndex + 1 >= settings.maxRounds` (FR-009's UX). The backend `NEXT_QUESTION`-equivalent
handler additionally rejects the request server-side (`INVALID_STATE` error, same pattern as
existing `START_GAME`/`END_GAME` guards) when advancing would exceed `settings.maxRounds`.

**Rationale**: Constitution III treats host input as untrusted external input like any other
WebSocket client, not an internal call — the same reasoning that already governs every existing
handler in `backend/src/ws/handlers/`. Relying on the frontend alone to hide a button is not a
boundary guarantee.

**Alternatives considered**: frontend-only enforcement (rejected — violates the untrusted-boundary
principle actually applied elsewhere in this codebase).

## Decision: Scoring and settings extend `Session`/`Player` in place; `Phrase` is left untouched

**Decision**: Add `settings: SessionSettings` to `Session`, add `roundScores: Map<number,
Map<string, number>>` to `Session` (keyed by `roundIndex`), and add `finishedCurrentRound: boolean`
to `Player`. The existing `Phrase[]` history array is untouched.

**Rationale**: Minimal, additive change (Constitution V) that doesn't disturb the already-tested
`Phrase` push logic in `gameHandler.ts`/`promptHandler.ts`. Keeping scores indexed by `roundIndex`
rather than nested inside `Phrase` avoids coupling the free-text prompt history to the numeric
scoring model, which the clarified answer establishes as independent of any particular question
text.

**Alternatives considered**: embed scores directly on each `Phrase` entry (rejected — couples two
independently-evolving concerns and complicates the "score a round with no confirmed phrase yet"
edge case).

## Resolved Technical Context (no NEEDS CLARIFICATION remain)

All Technical Context fields below are resolved directly from the existing, working
`package.json` files and configs — no unknowns requiring further research.
