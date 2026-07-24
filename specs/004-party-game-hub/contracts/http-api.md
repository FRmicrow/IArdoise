# HTTP API Contract Changes

Base: `backend/src/session/sessionRoutes.ts` (prefix `/api/sessions`) and
`backend/src/session/playerRoutes.ts` (prefix `/api/sessions`). Only the modified endpoint is
documented in full below; every other existing endpoint (`GET /:sessionId/qr`,
`GET /:sessionId/status`, `POST /:sessionId/players`) is unchanged by this feature.

## POST /api/sessions (modified)

**Auth**: `Bearer <hostToken>` (unchanged — `authMiddleware`).

**Request body** (extends the existing `{ initialPhrase? }`):

```typescript
{
  initialPhrase?: string;       // unchanged, optional, trimmed
  roundDurationSec?: number;    // one of 30 | 60 | 90 | 120 — default 60
  maxRounds?: number;           // one of 3 | 5 | 10 — default 3
  maxPlayers?: number;          // one of 4 | 8 | 12 | 16 — default 8 (indicative only)
  pointsEnabled?: boolean;      // default true
}
```

Validated with a `zod` schema (research.md decision) before reaching `SessionManager`:
- Unknown/out-of-enum values for `roundDurationSec`, `maxRounds`, `maxPlayers` → `400`
  `{ error: "..." }` (same error shape as the existing `409`/`400` responses in this file).
- Missing fields fall back to the defaults above (FR-004) — this is the only endpoint that needs
  to apply defaults, since the config screen always sends the user's effective selection but a
  direct/legacy caller may omit fields.

**Response 201** (extends existing `{ sessionId, joinUrl }`):

```typescript
{
  sessionId: string;
  joinUrl: string;
}
```

No response shape change — the created settings are not echoed back in the HTTP response; the
host's frontend already has the values it just submitted, and the WebSocket `SESSION_STATE`
snapshot (see contracts/websocket-events.md) is the single source of truth once connected
(Constitution I).

**Response 409** (unchanged): `{ error: "Host already has an active session" }`.

**Response 400** (new case added): `{ error: "<validation message>" }` when settings fail
`zod` validation.
