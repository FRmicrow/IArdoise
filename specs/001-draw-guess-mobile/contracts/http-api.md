# HTTP API Contract: Mobile Drawing Party Game

**Feature**: `001-draw-guess-mobile` | **Date**: 2026-07-23

Base URL: same origin as the SPA (Fastify serves both API and static frontend).
All bodies are JSON. All new/changed endpoints validate input with a schema
before touching `SessionManager` state, per Constitution Principle III.

Endpoints unchanged from the existing implementation are listed for
completeness; only **NEW** and **CHANGED** are net-new work for this feature.

## Auth

### `POST /api/auth/login` — unchanged

```
Request:  { username: string, password: string }
Response: 200 { token: string }
          401 { error: string }
```

## Sessions (host-authenticated unless noted)

### `POST /api/sessions` — CHANGED

Adds an optional initial phrase, so the admin can define it while generating
the QR code (spec Assumption: "The admin defines an initial phrase as part of
setting up the game session").

```
Auth:     Bearer token
Request:  { initialPhrase?: string }   // trimmed; if omitted, currentPhrase starts empty
Response: 201 { sessionId: string, joinUrl: string }
          409 { error: string }        // host already has an active session
```

### `GET /api/sessions/:sessionId/qr` — unchanged

```
Auth:     Bearer token
Response: 200 { dataUrl: string }
          404 { error: string }
```

### `GET /api/sessions/:sessionId/status` — **NEW**

No auth — called by the anonymous join page before rendering the nickname
form, to satisfy FR-026 (distinct "not found" vs "ended" messaging) and the
open "late join" edge case (see research.md D5).

```
Response: 200 { status: 'lobby' | 'active' | 'ended' }
          404 { error: 'Session not found' }
```

## Players (anonymous)

### `POST /api/sessions/:sessionId/players` — CHANGED (validation only; shape unchanged)

```
Request:  { name: string }             // 1-32 chars after trim; NOT deduplicated (FR-022)
Response: 201 { playerId: string, name: string }
          404 { error: 'Session not found' }
          409 { error: 'Registration is closed' }   // status !== 'lobby'
          400 { error: 'Name must be between 1 and 32 characters' }
```

Behavior change: the `name` returned is now always exactly the submitted
(trimmed) name — no " 2", " 3" suffixing.

## Health

### `GET /health` — unchanged

```
Response: 200 { status: 'ok' }
```

## Removed

None of the HTTP surface is removed. (The `UPDATE_SCORE`/`SCORE_UPDATED`
removal is WebSocket-only — see `websocket-events.md`.)
