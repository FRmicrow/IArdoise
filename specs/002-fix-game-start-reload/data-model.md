# Phase 1 Data Model: Fix — Players Stuck on Waiting Screen When Game Starts

**Feature**: `002-fix-game-start-reload` | **Date**: 2026-07-23

## No changes to persisted entities

This feature does not add, remove, or modify any entity owned by
`SessionManager` (`GameSession`, `Player`, `Phrase` — see
`specs/001-draw-guess-mobile/data-model.md` for the current model, unchanged
by this feature). `Player.connectionStatus` (`'connected' | 'disconnected'`)
keeps its existing two values and existing transitions; this fix does not
introduce a third "degraded"/"unknown" state server-side, per research.md D3
(the server's disconnect detection and broadcast fan-out are unchanged).

## Transient, non-persisted liveness state (client-side only)

The only new state introduced by this feature lives entirely inside
`WebSocketClient` in the browser tab, is never sent to the server as session
data, and does not survive a page reload:

| Field | Type | Notes |
|---|---|---|
| heartbeat interval handle | timer | Started on successful `connect()`, cleared on `close()`. Sends `PING` roughly every 20s. |
| pending-pong timeout handle | timer | Started when a `PING` is sent, cleared when the matching `PONG` arrives. If it fires first, the socket is treated as dead and the existing force-close-and-reconnect path (already used by the `visibilitychange` handler) runs. |

This is deliberately not modeled as a `SessionManager`/`Player` field —
liveness of one specific WebSocket connection is not session state; it is
transport-layer bookkeeping local to a single client, matching Constitution
Principle V (no new persisted abstraction for a problem that doesn't need
one).

## Server-side

No new or changed data. The new `PING` handler
(`backend/src/ws/handlers/heartbeatHandler.ts`, see research.md D1) reads no
state and writes no state — it is a pure echo (`PING` in → `PONG` out) and
does not touch `SessionManager`, `connectionRegistry`, or any broadcast path.
