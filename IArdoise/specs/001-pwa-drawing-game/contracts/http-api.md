# Contract: HTTP API

**Branch**: `001-pwa-drawing-game` | **Date**: 2025-07-18

All HTTP endpoints are served by the Fastify backend. The frontend SPA is served as static files from the same origin; no CORS configuration is needed for same-origin requests.

**Base URL**: `/api` (relative to the deployment origin)
**Content-Type**: `application/json` for all request/response bodies
**Authentication**: Bearer JWT in `Authorization: Bearer <token>` header (except `POST /auth/login`)

---

## Authentication

### `POST /api/auth/login`

Authenticates the host and returns a JWT.

**Request body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response `200 OK`**:
```json
{
  "token": "string (JWT, 1 h expiry)"
}
```

**Response `401 Unauthorized`**:
```json
{
  "error": "Invalid credentials"
}
```

---

## Session Management (host only — requires Bearer JWT)

### `POST /api/sessions`

Creates a new game session for the authenticated host.

**Request body**: _(empty)_

**Response `201 Created`**:
```json
{
  "sessionId": "string (UUID v4)",
  "joinUrl": "string (full URL for QR code)"
}
```

**Response `409 Conflict`** — host already has an active session:
```json
{
  "error": "Host already has an active session"
}
```

---

### `GET /api/sessions/:sessionId/qr`

Returns the QR code for the session join URL as a PNG data URL.

**Response `200 OK`**:
```json
{
  "dataUrl": "string (data:image/png;base64,...)"
}
```

**Response `404 Not Found`** — session does not exist:
```json
{
  "error": "Session not found"
}
```

---

## Join (unauthenticated — player endpoint)

### `POST /api/sessions/:sessionId/players`

Registers a new player in the session's lobby.

**Request body**:
```json
{
  "name": "string (1–32 chars)"
}
```

**Response `201 Created`**:
```json
{
  "playerId": "string (UUID v4)",
  "name": "string (possibly suffixed if duplicate)"
}
```

**Response `409 Conflict`** — session is active or ended:
```json
{
  "error": "Registration is closed"
}
```

**Response `404 Not Found`** — session does not exist:
```json
{
  "error": "Session not found"
}
```

**Response `400 Bad Request`** — name validation failed:
```json
{
  "error": "Name must be between 1 and 32 characters"
}
```

---

## Notes

- All protected endpoints respond `401 Unauthorized` with `{ "error": "Unauthorized" }` when no valid Bearer token is present.
- The WebSocket connection for real-time events is documented separately in [`websocket-events.md`](./websocket-events.md).
- Player-facing game state (prompt, round transitions, scoreboard) is delivered exclusively over WebSocket — no polling endpoints.
