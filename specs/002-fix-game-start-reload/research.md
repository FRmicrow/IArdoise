# Phase 0 Research: Fix — Players Stuck on Waiting Screen When Game Starts

**Feature**: `002-fix-game-start-reload` | **Date**: 2026-07-23

## Context

This is a bug fix on the existing `001-draw-guess-mobile` implementation, not
greenfield work. Two very recent commits on this same branch history already
targeted this exact symptom:

- `4bc36d4` "Fix: WebSocket heartbeat and stale session cleanup" — added a
  **server-side** native ping/pong heartbeat (`backend/src/index.ts:71-89`):
  every 25s the server pings each socket; if no pong arrives within the next
  cycle (~50s total), it calls `socket.terminate()`. The commit's own inline
  comment states the exact bug: *"A player sitting on the waiting screen
  looks connected but is unreachable, so a later broadcast (e.g.
  GAME_STARTED) never arrives."*
- `e889e04` "Fix: WebSocket reconnect never fires after silent mobile
  disconnects" — made the **client-side** `visibilitychange` handler
  (`frontend/src/ws/WebSocketClient.ts:102-110`) unconditionally force-close
  and reconnect, instead of checking `readyState` (which is unreliable for a
  socket that's dead but not yet closed).

Both were correct, necessary fixes, but they leave one gap, confirmed by
reading the current code (not assumed): **there is no client-side trigger at
all for a socket that dies while the tab stays in the foreground the whole
time.** `visibilitychange` only fires on a foreground/background transition;
a player who joins and simply waits, phone screen on, never triggers it. The
research question for this feature is how to close that specific gap with
the smallest possible change, consistent with Constitution Principle V.

## Decisions

### D1 — Add a client-driven, application-level heartbeat (PING/PONG) independent of tab visibility

**Decision**: The client (`WebSocketClient.ts`) starts a `setInterval` after
every successful `connect()` that sends a lightweight `PING` message roughly
every 20s. It expects a `PONG` reply within a short timeout (e.g. 8s). If the
timeout elapses without a reply, the client treats the socket as dead and
runs the exact same force-close-and-reconnect path already used by the
`visibilitychange` handler. The server adds a matching handler
(`heartbeatHandler.ts`) that replies `PONG` immediately on `PING`, with no
`SessionManager` access — a pure liveness echo.

**Rationale**: Browsers do not expose the native WebSocket ping/pong control
frames to JavaScript at all (RFC 6455 handles them at the user-agent/
transport layer, invisible to app code) — this is *why* the server's own
`4bc36d4` heartbeat can't help the client directly; the client has no API to
observe it. An application-level probe, riding on the same JSON message
channel already used for every other WS interaction, is the only way for the
client to independently detect "I sent something and got nothing back,"
regardless of whether the tab is foregrounded, backgrounded, or the network
silently black-holed the connection. This directly targets FR-001/002/003 and
is a root-cause fix (the client literally has no other way to know), not a
symptomatic patch — it also generalizes: it protects every future broadcast
the player might silently miss, not just `GAME_STARTED`.

**Alternatives considered**:
- *Periodic unconditional reconnect, regardless of apparent health* — rejected:
  causes visible `PLAYER_DISCONNECTED`/`PLAYER_RECONNECTED` churn on the
  host's roster for perfectly healthy connections, and doesn't actually
  target the failure condition (it's a timer, not a liveness check).
- *Rely only on `navigator.onLine` / `online` events* — rejected: these
  reflect the device's network interface state, not the health of this
  specific WebSocket path; a NAT/idle timeout on one TCP connection leaves
  `navigator.onLine === true` throughout, so this would never fire.
- *Shorten the server's existing native heartbeat interval* — rejected: the
  server already correctly reaps dead sockets server-side within ~50s
  (`4bc36d4`); the actual gap is that the *client* never finds out, because a
  forced `socket.terminate()` on a genuinely dead network path can't deliver
  a close frame to the client either. Tuning the server-side timer doesn't
  touch the client-side blind spot at all.
- *Re-send `AUTH` periodically as a de-facto probe* — rejected: overloads an
  unrelated message's semantics for a liveness check, and re-running full
  auth/session-lookup logic every ~20s per idle player is unnecessary work
  for what should be a cheap no-op probe.

### D2 — Reuse the existing reconnect and resync path as-is; do not add a new recovery mechanism

**Decision**: When the heartbeat timeout fires, the client calls the same
`close()` + `connect()` sequence already used today, which re-sends `AUTH`
and receives a fresh `SESSION_STATE` snapshot (`authHandler.ts`, already
unchanged/working). `game-player.ts`'s existing `SESSION_STATE` handling
(`payload.status === 'active'` → `showActive`) already does the right thing
once triggered — confirmed by reading the current handler, not assumed.

**Rationale**: Constitution Principle V — the reconnect-and-resync mechanism
is not broken; only the *trigger* for it is incomplete. Rebuilding or
parallel-pathing that logic would add risk and surface area for zero
additional correctness. This directly satisfies FR-004 (resync to actual
current state, not just a replay of the original start signal) for free.

**Alternatives considered**: Having the server replay/queue missed broadcasts
per player — rejected: much larger change (message queue, delivery
tracking, ack protocol) for a problem the existing resync-on-reconnect
pattern already solves once reconnection actually happens; would also
duplicate state the client already gets correctly via `SESSION_STATE`.

### D3 — No change to `broadcastToSession` or `START_GAME` handling

**Decision**: `backend/src/ws/broadcast.ts` and
`backend/src/ws/handlers/gameHandler.ts` are left untouched. The admin's
`START_GAME` action continues to iterate all players and best-effort
`ws.send()` to each; it does not wait for, block on, or retry individual
player deliveries.

**Rationale**: FR-005 requires the admin's start action to never be blocked
or delayed by a player with a degraded connection — the current
fire-and-forget fan-out already satisfies this by construction. The fix
belongs entirely on the "does the player's socket still work" side (D1/D2),
not on the broadcast/send side.

**Alternatives considered**: Adding delivery acks and per-player retry on
`START_GAME` — rejected: unnecessary once D1 ensures a stale socket gets
replaced (and resynced via D2) within a bounded time; would also risk
delaying `START_GAME` for the admin, directly contradicting FR-005.

## Summary of required changes by area

| Area | File | Change |
|---|---|---|
| Backend WS handler | `backend/src/ws/handlers/heartbeatHandler.ts` | **NEW** — registers `PING` → replies `PONG`, no state access |
| Backend WS handler | `backend/src/ws/handlers/*` (registration) | wire the new handler alongside the existing ones (mirrors `registerConnectionHandler` pattern) |
| Frontend WS client | `frontend/src/ws/WebSocketClient.ts` | **CHANGED** — start a `PING` interval + reply timeout after `connect()`; on timeout, reuse the existing force-close-and-reconnect path; clear the interval/timeout in `close()` |
| Frontend WS client | `frontend/src/ws/WebSocketClient.ts` (`EventMap`) | add `PONG: Record<string, never>` |
| Backend tests | `backend/tests/integration/heartbeat.test.ts` | **NEW** — `PING` → `PONG` round trip |
| Frontend E2E | `frontend/tests/e2e/game-flow.spec.ts` | **CHANGED** — add a regression scenario for a silently-dead player socket that never fires `close`, asserting the player still reaches the game screen after the admin starts |

No changes to `SessionManager`, `broadcast.ts`, `gameHandler.ts`,
`connectionHandler.ts`, `authHandler.ts`, or any page other than the
WebSocket client wrapper itself.
