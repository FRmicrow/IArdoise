# WebSocket Event Contract: Mobile Drawing Party Game

**Feature**: `001-draw-guess-mobile` | **Date**: 2026-07-23

Single endpoint `GET /ws` (upgraded by `@fastify/websocket`). Every message is
`{ type: string, payload: unknown }` JSON, routed through `WsRouter`. Every
handler validates its payload before touching `SessionManager` state or
broadcasting (Constitution Principle III). Host-only actions re-verify
`authContext.role === 'host'` (Constitution Principle IV) — unchanged pattern
from the current implementation.

## Client → Server

| Type | Payload | Who | Status |
|---|---|---|---|
| `AUTH` | `{ role: 'host', token, sessionId }` or `{ role: 'player', playerId, sessionId }` | both | unchanged |
| `SET_PROMPT` | `{ sessionId, text }` | host | **CHANGED**: server now rejects blank/whitespace-only `text` with `VALIDATION_ERROR` and leaves `currentPhrase` untouched (FR-014); also rejects if `session.status !== 'active'` for round changes (FR-021) — the one exception is the very first phrase, which is now set via `POST /api/sessions` at creation (see http-api.md), not over WS |
| `START_GAME` | `{ sessionId }` | host | unchanged |
| `NEXT_QUESTION` | `{ sessionId }` | host | unchanged (advances `roundIndex`; the next phrase still arrives via `SET_PROMPT`) |
| `END_GAME` | `{ sessionId }` | host | unchanged trigger; **payload of the resulting broadcast changes**, see below |
| `HOST_JOIN_AS_PLAYER` | `{ sessionId, name }` | host | unchanged |
| `UPDATE_SCORE` | — | — | **REMOVED** (scoring out of scope — see research.md D3) |

## Server → Client

| Type | Payload | When | Status |
|---|---|---|---|
| `AUTH_OK` | `{ role }` | after successful AUTH | unchanged |
| `AUTH_ERROR` | `{ message }` | failed AUTH | unchanged |
| `SESSION_STATE` | `{ sessionId, status, currentPhrase, roundIndex, players: [{ playerId, name, connectionStatus }] }` | snapshot after AUTH | **CHANGED**: field renamed `currentPrompt` → `currentPhrase`; player entries drop `score` |
| `PLAYER_JOINED` | `{ playerId, name }` | new player joins | **CHANGED**: drops `score: 0` |
| `PLAYER_DISCONNECTED` | `{ playerId }` | player WS closes | unchanged |
| `PLAYER_RECONNECTED` | `{ playerId }` | player WS re-authenticates after a drop | unchanged |
| `GAME_STARTED` | `{ sessionId, currentPhrase }` | `START_GAME` succeeds | field renamed from `currentPrompt` |
| `PROMPT_UPDATED` | `{ text, roundIndex }` | `SET_PROMPT` succeeds | unchanged shape; only fires on non-empty, validated text now |
| `QUESTION_ADVANCED` | `{ roundIndex }` | `NEXT_QUESTION` succeeds | unchanged |
| `GAME_ENDED` | `{}` | `END_GAME` succeeds | **CHANGED**: no longer carries `scoreboard` — clients navigate to a static closing screen, no data needed |
| `HOST_DISCONNECTED` | `{}` | host WS closes | unchanged |
| `SCORE_UPDATED` | — | — | **REMOVED** |
| `ERROR` | `{ code, message }` | any handler rejects a message | unchanged; `code` values used by this feature: `UNAUTHORIZED`, `VALIDATION_ERROR`, `SESSION_NOT_FOUND`, `INVALID_STATE` |

## Notes

- Drawing strokes are **never** sent over this channel in either direction —
  canvases are local-only and private per player/host (FR-018). This is
  already true today (no `DRAW` event exists) and this feature does not add
  one.
- `PROMPT_UPDATED`'s payload keeps the field name `text` (not renamed to
  `phrase`) to avoid an unnecessary breaking rename of an already-working,
  narrowly-scoped event; only the broader `currentPrompt` → `currentPhrase`
  rename (which appears in multiple payloads and matches the spec's entity
  name) is made.
