# Data Model: PWA Drawing Game

**Branch**: `001-pwa-drawing-game` | **Date**: 2025-07-18

All entities are maintained in-memory on the backend process (TypeScript `Map` structures). No database schema is required for v1. This document describes the shape and lifecycle of each entity, the relationships between them, and the state transitions that govern game flow.

---

## Entities

### 1. `Host`

Represents the single authenticated operator of the application. Credentials are loaded from environment variables at server startup.

| Field | Type | Description |
|-------|------|-------------|
| `username` | `string` | The host login name (from `HOST_USERNAME` env var) |
| `passwordHash` | `string` | bcrypt hash of the host password (from `HOST_PASSWORD_HASH` env var) |
| `currentSessionId` | `string \| null` | ID of the host's currently active session (at most one at a time) |

**Constraints**:
- A host can own at most one active session at any time (v1 scope).
- Authentication yields a short-lived JWT (1 h); no refresh token in v1.

---

### 2. `Session`

The top-level container for a single game. Created by the host; has a lifecycle state machine.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique session identifier (UUID v4) |
| `status` | `SessionStatus` | `"lobby"` → `"active"` → `"ended"` |
| `joinUrl` | `string` | Full URL players use to join (`https://<host>/join/<id>`) |
| `currentPrompt` | `string` | The text currently displayed on all player screens (empty string initially) |
| `roundIndex` | `number` | Zero-based counter of questions asked (increments on "Next question") |
| `players` | `Map<string, Player>` | Keyed by player ID |
| `createdAt` | `Date` | Timestamp of session creation |

**State Machine**:
```
LOBBY ──(host: start_game)──▶ ACTIVE ──(host: end_game)──▶ ENDED
```
- In `LOBBY`: players may register; host may set/update the prompt.
- In `ACTIVE`: registration is locked; host may advance questions, score players, end game.
- In `ENDED`: read-only; final scoreboard is broadcast to all clients.

**Constraints**:
- Only the authenticated host may transition session state.
- `start_game` requires at least 1 registered player (frontend enforces; backend validates).

---

### 3. `Player`

A named participant registered within a session. The host can also appear as a Player if they choose "Join as player".

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID v4, assigned at registration |
| `sessionId` | `string` | Reference to parent `Session.id` |
| `name` | `string` | Display name (1–32 characters, trimmed) |
| `score` | `number` | Integer, starts at 0; incremented/decremented by host |
| `connectionStatus` | `ConnectionStatus` | `"connected"` \| `"disconnected"` |
| `isHost` | `boolean` | `true` if this player entry belongs to the host |
| `wsClientId` | `string \| null` | Identifier of the active WebSocket connection (null when disconnected) |
| `registeredAt` | `Date` | Timestamp of name submission |

**Constraints**:
- Names are de-duplicated within a session: if `"Alice"` exists, the next "Alice" becomes `"Alice 2"`, then `"Alice 3"`, etc.
- Name max length: 32 characters.
- Registration is rejected (FR-014) once `session.status` is `"active"` or `"ended"`.
- A disconnected player's record is retained; their `connectionStatus` updates to `"disconnected"` and the host sees a visual indicator.
- Score floor: none (negative scores are allowed for wrong-answer penalties).

---

### 4. `Prompt`

Represents a single round's question or instruction text.

| Field | Type | Description |
|-------|------|-------------|
| `index` | `number` | Round number (0-based, matches `Session.roundIndex`) |
| `text` | `string` | The question or phrase set by the host |
| `setAt` | `Date` | Timestamp when the host last updated this prompt |

**Notes**:
- The current prompt is stored directly on the `Session` as `currentPrompt` (string) for fast broadcast access.
- A prompt history array is maintained on the session as `prompts: Prompt[]` for audit/debug purposes (not exposed to players in v1).
- Advancing to "Next question" increments `roundIndex`, pushes the current prompt to history, and resets `currentPrompt` to `""`.

---

### 5. `Drawing` (ephemeral, client-side only)

Drawing state is intentionally **not** stored on the server.

| Attribute | Description |
|-----------|-------------|
| Location | Browser memory only (`DrawingCanvas` class in the frontend) |
| Representation | Array of stroke objects `{ points: [{ x, y }], colour, width }` |
| Lifecycle | Created on first stroke; cleared on `next_question` WebSocket event |
| Persistence | None — never transmitted to the server in v1 |

---

## Relationships

```
Host ──(owns 0..1)──▶ Session
Session ──(contains 1..N)──▶ Player
Session ──(records 0..N)──▶ Prompt (history)
Player ──(holds, locally)──▶ Drawing (ephemeral, client-only)
```

---

## Validation Rules (server-enforced)

| Rule | Entity | Condition |
|------|--------|-----------|
| Name required | Player | `name.trim().length >= 1` |
| Name max length | Player | `name.trim().length <= 32` |
| Registration open | Player | `session.status === "lobby"` |
| Start game requires players | Session | `session.players.size >= 1` |
| Score change only when active | Player | `session.status === "active"` |
| Single active session per host | Host | `host.currentSessionId === null` before creating a new session |

---

## TypeScript Type Definitions (reference)

```typescript
type SessionStatus = "lobby" | "active" | "ended";
type ConnectionStatus = "connected" | "disconnected";

interface Session {
  id: string;
  status: SessionStatus;
  joinUrl: string;
  currentPrompt: string;
  roundIndex: number;
  players: Map<string, Player>;
  prompts: Prompt[];
  createdAt: Date;
}

interface Player {
  id: string;
  sessionId: string;
  name: string;
  score: number;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  wsClientId: string | null;
  registeredAt: Date;
}

interface Prompt {
  index: number;
  text: string;
  setAt: Date;
}
```
