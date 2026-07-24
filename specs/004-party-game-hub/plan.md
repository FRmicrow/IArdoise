# Implementation Plan: Hub de mini-jeux, parties configurables et podium

**Branch**: `004-party-game-hub` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-party-game-hub/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Turn the existing single-open-ended-session drawing game into a structured, round-limited, timed
party game launched from a mini-game hub: an admin logs in, picks "L'Ardoise" from a hub of
mini-games (only entry currently playable), configures round duration / round count / indicative
player cap / points toggle, runs the bounded game with a host-visible round counter and countdown,
optionally scores each round in person (no drawing images ever leave the player's device), and
ends on a shared podium/results screen. Technical approach: extend the existing in-memory
`SessionManager` (`Session`/`Player` types) with settings and round-scoring fields, add a small
number of new WebSocket message types validated with `zod`, add three new frontend screens (hub,
config, results) plus targeted additions to the existing lobby/game-host/game-player screens, and
retheme the existing CSS-token-based stylesheet to the prototype's visual identity (self-hosting
its two fonts to preserve PWA offline installability). No persistent storage, no new services, no
change to the drawing canvas itself.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode, both workspaces), Node.js ≥20 (backend
runtime), ES modules throughout.

**Primary Dependencies**: Backend — Fastify 4, `@fastify/websocket`, `ws`, `jose` (JWT), `bcryptjs`,
`qrcode`, `dotenv`; **+ new: `zod`** (schema validation for this feature's new endpoints/messages,
see research.md). Frontend — Vite 5, `vite-plugin-pwa`, `fabric` + `@erase2d/fabric` (existing
canvas drawing, untouched by this feature); no framework (vanilla TS, hash-based router in
`main.ts`).

**Storage**: In-memory only — `SessionManager` singleton (`Map`-based). No database, no file
persistence. Unchanged by this feature (Constitution V).

**Testing**: Vitest for backend unit tests (`backend/tests/unit`) and integration tests
(`backend/tests/integration`); Vitest for frontend unit tests (`frontend/tests`); Playwright for
frontend E2E (`frontend/tests/e2e`, `workers: 1` — the backend allows only one active session per
host, so E2E must run serially).

**Target Platform**: Mobile-first installable PWA (manifest + service worker, offline-capable),
served by the same Fastify server that exposes the HTTP/WS API; primary usage is same-room, same
Wi-Fi party play.

**Project Type**: Web application — npm workspaces monorepo (`backend/`, `frontend/`).

**Performance Goals**: No new performance targets introduced. Existing constitution targets
(canvas 60fps via `requestAnimationFrame`, draw events throttled ~100ms) are inherited unchanged
since this feature never touches `DrawingCanvas.ts`.

**Constraints**: Must preserve existing PWA offline installability (drives the font self-hosting
decision in research.md); must preserve the existing single-active-session-per-host constraint
(unaffected — settings simply extend the same `createSession` call); no persistent storage may be
introduced for settings, scores, or catalog data (Constitution V).

**Scale/Scope**: Small, local, same-room party sessions (indicative cap up to 16 players, no hard
enforcement). Scope of change: 1 extended HTTP endpoint, ~5 new/modified WebSocket message types,
3 new frontend screens (hub, config, results), 3 modified frontend screens (lobby-host, game-host,
game-player), a full CSS token/theme replacement, 2 self-hosted font files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Real-Time State Consistency | PASS | Every new mutation (`ADVANCE_ROUND` guard, `AWARD_ROUND_POINTS`, `MARK_DRAWING_DONE`, settings at creation) goes through `SessionManager` and broadcasts as part of the same handler call, before the WS handler returns — same pattern as every existing handler in `backend/src/ws/handlers/`. |
| II. Test-First for Game Logic and Flows | PASS (enforced at `/speckit-tasks`/implementation time) | New `SessionManager` behavior (settings defaults, round-limit guard, score storage/idempotency, resume payload) requires Vitest unit tests before being "done"; new WS/HTTP contracts require backend integration tests; the golden path (login → hub → config → lobby → rounds → scoring → podium) requires an updated/new Playwright E2E scenario. |
| III. Type-Safe, Validated Boundaries | PASS, with an explicit addition | Existing handlers validate manually (`typeof` checks); this feature adopts `zod` for all of its new HTTP/WS payloads (research.md) to satisfy "validate against a schema" literally for new boundary surface, without touching already-tested existing handlers. |
| IV. Secure by Default | PASS | No new secrets. `AWARD_ROUND_POINTS`/`ADVANCE_ROUND` follow the existing host-only `authContext.role === 'host'` check pattern. No drawing/image data ever exists server-side to leak into logs (research.md — no transmission). Structured `app.log` logging only, no `console.*` introduced. |
| V. Minimal-Footprint, YAGNI | PASS | No persistent store added. Game catalog is static frontend data (research.md), not a speculative backend entity, since only one game is real today. Reuses auth, lobby, QR, and canvas exactly as-is. |
| Frontend & UX Standards | PASS, with an explicit addition | Retheme is expressed entirely via CSS custom-property tokens in `style.css` (no hardcoded hex/px in `.ts` files, matching current pattern); canvas fps/throttle unaffected (untouched code); PWA offline installability preserved by self-hosting the two prototype fonts instead of a Google Fonts CDN `<link>` (research.md). |
| Development Workflow & Quality Gates | Applies unchanged | `npm run build` (both workspaces), `npm test` (backend Vitest), `npm run test:e2e` (touches user-facing flows) must all pass before this feature is "done"; `.env.example`/`README.md` updated only if new env vars are introduced (none are — settings are request-scoped, not configuration). |

No violations requiring justification — **Complexity Tracking is empty** for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/004-party-game-hub/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md         # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── http-api.md
│   └── websocket-events.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── session/
│   │   ├── types.ts            # extend: Session.settings, Session.roundScores, Player.finishedCurrentRound
│   │   ├── SessionManager.ts   # extend: createSession(settings), round-advance guard, score storage
│   │   ├── sessionRoutes.ts    # extend: POST / body + zod schema for settings
│   │   └── playerRoutes.ts     # unchanged
│   ├── schemas/                # NEW — zod schemas for this feature's HTTP/WS payloads
│   ├── ws/
│   │   └── handlers/
│   │       ├── gameHandler.ts       # extend: round-limit guard on advance, GAME_ENDED results payload
│   │       ├── promptHandler.ts     # unchanged (or merged with advance guard per contracts note)
│   │       └── scoringHandler.ts    # NEW — AWARD_ROUND_POINTS, MARK_DRAWING_DONE
│   └── auth/, qr/                   # unchanged
└── tests/
    ├── unit/
    │   └── SessionManager.test.ts   # extend with settings/round-limit/score tests
    └── integration/
        └── api.test.ts              # extend with new POST /api/sessions body + new WS flows

frontend/
├── src/
│   ├── pages/
│   │   ├── hub.ts              # NEW — Story 3
│   │   ├── config.ts           # NEW — Story 1 settings screen
│   │   ├── results.ts          # NEW — Story 2 podium/results (replaces closing.ts)
│   │   ├── lobby-host.ts       # modify: pass settings through, indicative player count label
│   │   ├── game-host.ts        # modify: round counter, local countdown, per-player status, scoring UI
│   │   ├── game-player.ts      # modify: "J'ai fini" action + wait sub-state
│   │   ├── login.ts, join.ts   # unchanged logic, retheme only
│   │   └── closing.ts          # removed — superseded by results.ts
│   ├── data/
│   │   └── gameCatalog.ts      # NEW — static hub entries (research.md)
│   ├── ws/WebSocketClient.ts   # extend: new EventMap entries (PLAYER_FINISHED, SCORES_UPDATED, extended payloads)
│   ├── canvas/                 # unchanged — DrawingCanvas, toolbar, toolState
│   ├── style.css               # retheme: new token values, new component classes for hub/config/results
│   ├── fonts/                  # NEW — self-hosted Bricolage Grotesque + Caveat woff2 files
│   └── main.ts                 # extend: new routes (#/host/hub, #/host/config, #/results)
└── tests/
    ├── canvas/toolState.test.ts # unchanged
    └── e2e/game-flow.spec.ts    # extend: golden path through hub → config → rounds → scoring → results
```

**Structure Decision**: Existing web-application layout (Option 2: `backend/` + `frontend/` npm
workspaces) is kept as-is. This feature is purely additive/extending within that structure — no
new top-level directory, no new service, no new workspace.

## Complexity Tracking

*No entries — Constitution Check reported no unjustified violations.*
