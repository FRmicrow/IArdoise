# Phase 1 Data Model: Mobile Drawing Party Game

**Feature**: `001-draw-guess-mobile` | **Date**: 2026-07-23

All state is in-memory only, owned exclusively by `SessionManager`
(`backend/src/session/SessionManager.ts`), per Constitution Principle I and V.
Nothing here is persisted to disk or a database — a server restart clears all
sessions, which is the accepted MVP tradeoff (see `ARCHITECTURE.md` §Future
Improvements).

## Entities

### GameSession

Maps to the spec's **Game Session** entity. Implemented as `Session` in
`backend/src/session/types.ts`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Business key; used in the join URL and QR code. Immutable. |
| `status` | `'lobby' \| 'active' \| 'ended'` | Drives FR-006/008/009 (lobby→active) and FR-019/020/021 (active/ended→ended). One-way transitions only: `lobby → active → ended`. |
| `joinUrl` | `string` | Derived once at creation from `id` + request host. Immutable. |
| `currentPhrase` | `string` | Renamed from `currentPrompt` to match the spec's "Phrase" vocabulary. Empty string only in `lobby` before the admin sets the first phrase. |
| `roundIndex` | `number` | Increments each time a new phrase is published; used to key phrase history entries. |
| `players` | `Map<string, Player>` | Keyed by `Player.id`. |
| `phrases` | `Phrase[]` | Append-only history of published phrases (renamed from `prompts`). |
| `createdAt` | `Date` | Diagnostic only; not exposed to clients. |

**Validation rules**:
- `currentPhrase` MUST NOT be set to an empty/whitespace-only string once the
  session exists — enforced in the `SET_PROMPT` WS handler (FR-014).
- A phrase can only be published while `status === 'active'`
  (initial phrase is set once at creation via the session-create payload,
  before `status` moves to `active`) — enforced server-side (FR-021).
- `status` transitions are one-way and admin-triggered only
  (`START_GAME` → `active`, `END_GAME` → `ended`); there is no automatic
  timer/expiry (per spec Assumptions).

**Removed from the current implementation**: nothing removed at the session
level; `score` and scoring-related aggregate fields never lived on `Session`
itself.

### Player

Maps to the spec's **Player** entity. Implemented as `Player` in
`backend/src/session/types.ts`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Business key for this player within this session. Immutable. Persisted client-side (localStorage) to support reconnection (FR-023). |
| `sessionId` | `string` | FK to `GameSession.id`. Immutable. |
| `name` | `string` | 1–32 chars, trimmed, **not deduplicated** (FR-022) — multiple players in the same session MAY share the identical string. |
| `connectionStatus` | `'connected' \| 'disconnected'` | Flips on WS connect/close; drives the host roster's live view (FR-007) and the "host disconnected" banner. |
| `isHost` | `boolean` | True only when the admin explicitly joins as a player via `HOST_JOIN_AS_PLAYER` (existing optional feature, unaffected by this plan). |
| `wsClientId` | `string \| null` | Transient — current WS connection registry key; `null` while disconnected. |
| `registeredAt` | `Date` | Diagnostic only. |

**Removed fields**: `score` (`number`) is removed — the spec's Assumptions
explicitly exclude scoring from this iteration (see research.md D3).

**Validation rules**:
- `name` MUST be non-empty after trim and ≤32 chars (FR-004, FR-005) —
  unchanged from the current implementation.
- No uniqueness constraint on `(sessionId, name)` — this is a deliberate
  *absence* of a business key, per FR-022 (contrast with the global
  `phase-1-data-safety` guidance on business keys, which does not apply here:
  this is ephemeral in-memory session state, not a canonical persisted
  entity).

### Phrase

Maps to the spec's **Phrase** entity. Implemented as `Prompt` in
`backend/src/session/types.ts` (renamed to `Phrase` for consistency with the
spec and the renamed `currentPhrase`/`phrases` fields above).

| Field | Type | Notes |
|---|---|---|
| `index` | `number` | Matches the `GameSession.roundIndex` value active when this phrase was published. Used for ordering. |
| `text` | `string` | Non-empty (FR-014). |
| `setAt` | `Date` | When the admin published it. |

**Validation rules**:
- `text` MUST be non-empty (FR-014) — enforced before a `Phrase` is ever
  constructed; an admin's empty submission never reaches this entity.

### Admin

Not a persisted or session-scoped entity — per the spec, "modeled as the
owner/controller of a Game Session rather than a persistent account" (see
research.md D10). The only backend representation is the JWT issued by
`POST /api/auth/login`, carrying `{ role: 'host', username }` where
`username` is the single shared `HOST_USERNAME` value, not a per-admin
identity. No new fields or tables are introduced for this entity.

## State transitions

```
GameSession.status:  lobby ──(START_GAME, ≥1 player)──▶ active ──(END_GAME)──▶ ended
                        │                                  │
                        └─(END_GAME, before start)─────────┴──────────────────▶ ended

Player.connectionStatus: connected ⇄ disconnected  (WS open/close; reconnect via
                          AUTH with existing playerId restores 'connected')
```

- `lobby → active` requires `players.size >= 1` (existing guard, unchanged;
  satisfies User Story 2's "admin triggers start" acceptance scenarios).
- `* → ended` is admin-triggered only, from any prior status, and is terminal
  — no session ever leaves `ended` (FR-019, FR-020, FR-021).
- Player joins are only accepted while `status === 'lobby'` (existing guard,
  unchanged — see research.md D5 for how this is now surfaced to the client
  with a distinct message rather than a generic "closed" string).

## Client-side persistence (not part of `SessionManager`)

To satisfy FR-023/FR-024 across a full app relaunch (not just an in-tab WS
reconnect), the frontend persists these keys in `localStorage` (moved from
`sessionStorage` — see research.md D7):

| Key | Set when | Used to |
|---|---|---|
| `playerId` | player successfully joins | re-authenticate the WS connection as that player on any future load |
| `playerSessionId` | player successfully joins | know which session to resume into |
| `hostSessionId` | admin creates a session | know which session the admin controls |
| `token` | admin logs in | re-authenticate host HTTP/WS calls (subject to the existing 1h JWT expiry — an expired token still requires re-login; this is unchanged behavior, not a regression) |

`scoreboard` (previously used to hand off final scores to the scoreboard
page) is removed along with the scoring subsystem (research.md D3).
