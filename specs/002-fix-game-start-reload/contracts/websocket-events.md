# WebSocket Event Contract Delta: Fix — Players Stuck on Waiting Screen When Game Starts

**Feature**: `002-fix-game-start-reload` | **Date**: 2026-07-23

Baseline contract: `specs/001-draw-guess-mobile/contracts/websocket-events.md`
(unchanged except for the two additions below). Same endpoint (`GET /ws`),
same `{ type: string, payload: unknown }` JSON envelope, same `WsRouter`
dispatch.

## Client → Server (new)

| Type | Payload | Who | Status |
|---|---|---|---|
| `PING` | `{}` (no payload) | host or player | **NEW** — sent by the client on a fixed interval (~20s) while a connection is open, purely to detect a socket that reports `OPEN` but is actually unreachable (research.md D1). Not tied to any user action; carries no session-mutating intent. |

## Server → Client (new)

| Type | Payload | When | Status |
|---|---|---|---|
| `PONG` | `{}` (no payload) | immediately upon receiving `PING` | **NEW** — pure echo reply. The handler does not read or write `SessionManager` state (research.md D1/data-model.md). If the client doesn't receive this within its own short timeout, it treats the connection as dead and reconnects using the existing force-close-and-reconnect path. |

## Everything else: unchanged

`AUTH`, `SESSION_STATE`, `START_GAME`, `GAME_STARTED`, `PLAYER_JOINED`,
`PLAYER_DISCONNECTED`, `PLAYER_RECONNECTED`, `SET_PROMPT`, `PROMPT_UPDATED`,
`NEXT_QUESTION`, `QUESTION_ADVANCED`, `END_GAME`, `GAME_ENDED`,
`HOST_DISCONNECTED`, `ERROR` — all unchanged from the `001-draw-guess-mobile`
baseline. In particular:

- `GAME_STARTED`'s payload and trigger (`START_GAME` succeeds) are unchanged
  — this feature does not touch the broadcast/send path (research.md D3), only
  how reliably a player's socket is still alive to receive it.
- `SESSION_STATE`'s payload and trigger (sent on every successful `AUTH`) are
  unchanged — a heartbeat-triggered reconnect goes through the exact same
  `AUTH` → `SESSION_STATE` path as any other reconnect, so a recovering
  player gets the session's real current state (waiting, active + current
  phrase, or ended), not a stale replay of the original start signal
  (FR-004).

## Notes on the new messages

- `PING`/`PONG` are intentionally symmetric-shaped, minimal, and
  unauthenticated-safe: the handler does not check `authContext` before
  replying, since a liveness echo has no session-mutating capability and
  gating it behind auth state would only reintroduce the same class of "does
  this socket still work" uncertainty it exists to answer.
- These are heartbeat-only messages, not user-facing — no page, banner, or
  copy change results from them (FR-006: the transition stays automatic and
  silent for players with a healthy connection).
- This is a different mechanism from the server's existing native
  ping/pong control-frame heartbeat added in `4bc36d4`
  (`backend/src/index.ts`), which stays as-is and continues to reap
  genuinely dead sockets server-side. `PING`/`PONG` here are ordinary
  application-level JSON messages because browsers do not expose native
  WebSocket control frames to JavaScript (research.md D1) — the client needs
  its own observable probe.
