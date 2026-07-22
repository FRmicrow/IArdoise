# Contract: WebSocket Events

**Branch**: `001-pwa-drawing-game` | **Date**: 2025-07-18

All real-time communication uses a single WebSocket endpoint. Messages are JSON-encoded.

**Endpoint**: `ws://<host>/ws` (or `wss://` in production)

**Message envelope**:
```json
{
  "type": "EVENT_TYPE",
  "payload": { ... }
}
```

---

## Connection & Authentication

### Client → Server: `AUTH`

Sent immediately after the WebSocket connection is established. Both host and player clients must authenticate before any other messages are accepted.

**Host authentication** (uses JWT from login):
```json
{
  "type": "AUTH",
  "payload": {
    "role": "host",
    "token": "<JWT>",
    "sessionId": "<sessionId>"
  }
}
```

**Player authentication** (uses playerId from HTTP registration):
```json
{
  "type": "AUTH",
  "payload": {
    "role": "player",
    "playerId": "<playerId>",
    "sessionId": "<sessionId>"
  }
}
```

**Server → Client: `AUTH_OK`**:
```json
{
  "type": "AUTH_OK",
  "payload": {
    "role": "host" | "player"
  }
}
```

**Server → Client: `AUTH_ERROR`**:
```json
{
  "type": "AUTH_ERROR",
  "payload": {
    "message": "string"
  }
}
```
*The server closes the WebSocket connection after sending `AUTH_ERROR`.*

---

## Lobby Events

### Server → All clients: `PLAYER_JOINED`

Broadcast when a new player registers (HTTP) and connects (WebSocket).

```json
{
  "type": "PLAYER_JOINED",
  "payload": {
    "playerId": "string",
    "name": "string",
    "score": 0
  }
}
```

### Server → All clients: `PLAYER_DISCONNECTED`

Broadcast when a connected player loses their WebSocket connection.

```json
{
  "type": "PLAYER_DISCONNECTED",
  "payload": {
    "playerId": "string"
  }
}
```

### Server → All clients: `PLAYER_RECONNECTED`

Broadcast when a disconnected player re-establishes their WebSocket connection.

```json
{
  "type": "PLAYER_RECONNECTED",
  "payload": {
    "playerId": "string"
  }
}
```

---

## Game Flow Events

### Client (host) → Server: `START_GAME`

Host starts the game — locks registration.

```json
{
  "type": "START_GAME",
  "payload": {
    "sessionId": "string"
  }
}
```

**Server → All clients: `GAME_STARTED`**:
```json
{
  "type": "GAME_STARTED",
  "payload": {
    "sessionId": "string",
    "currentPrompt": "string"
  }
}
```

---

### Client (host) → Server: `SET_PROMPT`

Host updates the current question/prompt text. Can be sent in `LOBBY` or `ACTIVE` state.

```json
{
  "type": "SET_PROMPT",
  "payload": {
    "sessionId": "string",
    "text": "string"
  }
}
```

**Server → All player clients: `PROMPT_UPDATED`**:
```json
{
  "type": "PROMPT_UPDATED",
  "payload": {
    "text": "string",
    "roundIndex": 0
  }
}
```

---

### Client (host) → Server: `NEXT_QUESTION`

Host advances to the next round — clears all canvases and resets the prompt.

```json
{
  "type": "NEXT_QUESTION",
  "payload": {
    "sessionId": "string"
  }
}
```

**Server → All clients: `QUESTION_ADVANCED`**:
```json
{
  "type": "QUESTION_ADVANCED",
  "payload": {
    "roundIndex": 1
  }
}
```
*On receiving this event, player clients MUST clear their drawing canvas.*

---

### Client (host) → Server: `UPDATE_SCORE`

Host increments or decrements a player's score.

```json
{
  "type": "UPDATE_SCORE",
  "payload": {
    "sessionId": "string",
    "playerId": "string",
    "delta": 1 | -1
  }
}
```

**Server → All clients: `SCORE_UPDATED`**:
```json
{
  "type": "SCORE_UPDATED",
  "payload": {
    "playerId": "string",
    "newScore": 3
  }
}
```

---

### Client (host) → Server: `END_GAME`

Host ends the game and triggers the final scoreboard.

```json
{
  "type": "END_GAME",
  "payload": {
    "sessionId": "string"
  }
}
```

**Server → All clients: `GAME_ENDED`**:
```json
{
  "type": "GAME_ENDED",
  "payload": {
    "scoreboard": [
      { "playerId": "string", "name": "string", "score": 10 },
      { "playerId": "string", "name": "string", "score": 7 }
    ]
  }
}
```
*`scoreboard` is sorted descending by `score`.*

---

## State Snapshot

### Server → Client (on AUTH_OK): `SESSION_STATE`

Sent to a newly authenticated client to bring them up to date.

```json
{
  "type": "SESSION_STATE",
  "payload": {
    "sessionId": "string",
    "status": "lobby" | "active" | "ended",
    "currentPrompt": "string",
    "roundIndex": 0,
    "players": [
      {
        "playerId": "string",
        "name": "string",
        "score": 0,
        "connectionStatus": "connected" | "disconnected"
      }
    ]
  }
}
```

---

## Host-Specific: Join as Player

### Client (host) → Server: `HOST_JOIN_AS_PLAYER`

Host opts in to participate as a named player.

```json
{
  "type": "HOST_JOIN_AS_PLAYER",
  "payload": {
    "sessionId": "string",
    "name": "string"
  }
}
```

**Server responds** with `PLAYER_JOINED` broadcast (same as any player joining).

---

## Error Handling

### Server → Client: `ERROR`

Sent when the server rejects a client message (wrong state, unauthorised, validation failure).

```json
{
  "type": "ERROR",
  "payload": {
    "code": "INVALID_STATE" | "UNAUTHORIZED" | "VALIDATION_ERROR" | "SESSION_NOT_FOUND",
    "message": "string"
  }
}
```

---

## Event Summary Table

| Direction | Event Type | When |
|-----------|-----------|------|
| C→S | `AUTH` | Immediately after WS open |
| S→C | `AUTH_OK` | Auth accepted |
| S→C | `AUTH_ERROR` | Auth rejected |
| S→C | `SESSION_STATE` | After `AUTH_OK` |
| S→All | `PLAYER_JOINED` | Player registers + connects |
| S→All | `PLAYER_DISCONNECTED` | Player WS closes |
| S→All | `PLAYER_RECONNECTED` | Player WS reconnects |
| C→S | `SET_PROMPT` | Host types prompt |
| S→Players | `PROMPT_UPDATED` | After `SET_PROMPT` |
| C→S | `START_GAME` | Host starts game |
| S→All | `GAME_STARTED` | After `START_GAME` |
| C→S | `NEXT_QUESTION` | Host advances round |
| S→All | `QUESTION_ADVANCED` | After `NEXT_QUESTION` |
| C→S | `UPDATE_SCORE` | Host taps +/− |
| S→All | `SCORE_UPDATED` | After `UPDATE_SCORE` |
| C→S | `END_GAME` | Host ends session |
| S→All | `GAME_ENDED` | After `END_GAME` |
| C→S | `HOST_JOIN_AS_PLAYER` | Host joins as player |
| S→C | `ERROR` | Any rejected message |
