# WebSocket Event Contract Changes

Base: `backend/src/ws/handlers/*.ts`, routed through `WsRouter`/`authContext`
(`backend/src/ws/handlers/authHandler.ts`). Only new or modified message types are documented in
full; unchanged types (`AUTH`, `AUTH_OK`, `AUTH_ERROR`, `PLAYER_JOINED`, `PLAYER_DISCONNECTED`,
`PLAYER_RECONNECTED`, `HOST_DISCONNECTED`, `START_GAME`, `GAME_STARTED`, `SET_PROMPT`,
`PROMPT_UPDATED`, `PING`/`PONG`, generic `ERROR`) keep their existing shape and behavior.

All new client→server messages are validated with a `zod` schema before touching
`SessionManager` state (research.md decision), following the existing handler pattern: role check
via `authContext` first, then payload validation, then session/state checks, then mutation +
broadcast (Constitution I — broadcast happens as part of the same operation, before the handler
returns).

## Client → Server (new)

### `MARK_DRAWING_DONE` (player only)

```typescript
{ sessionId: string }   // playerId is taken from authContext, never from payload
```

- Rejects with `UNAUTHORIZED` if the caller's `authContext.role !== 'player'`.
- Rejects with `SESSION_NOT_FOUND` / `INVALID_STATE` following the same pattern as existing
  handlers (session must exist and be `active`).
- Sets `player.finishedCurrentRound = true` for the caller.
- Broadcasts `PLAYER_FINISHED` (below) to the session.

### `ADVANCE_ROUND` (host only) — replaces the previous ad-hoc use of `NEXT_QUESTION` for round
counting; `NEXT_QUESTION`'s existing phrase-publishing behavior is preserved but now also carries
the round-limit guard.

```typescript
{ sessionId: string }
```

- Rejects with `UNAUTHORIZED` if caller isn't the host.
- Rejects with `INVALID_STATE` if `session.roundIndex + 1 >= session.settings.maxRounds`
  (FR-009 — server-side enforcement, see research.md).
- On success: pushes the current phrase to `phrases` (existing behavior), increments
  `roundIndex`, resets every player's `finishedCurrentRound = false`, clears `currentPhrase`.
- Broadcasts `QUESTION_ADVANCED` (existing type, payload extended — see below).

> Implementation note for `/speckit-tasks`: whether this is a genuinely new message type or the
> existing `NEXT_QUESTION` handler extended in place is an implementation choice, not a contract
> requirement — either satisfies FR-008/FR-009 as long as the guard and resets above are applied
> atomically with the broadcast.

### `AWARD_ROUND_POINTS` (host only)

```typescript
{
  sessionId: string;
  roundIndex: number;                    // which round these points are for
  points: Record<string, number>;        // playerId -> non-negative integer points
}
```

- Rejects with `UNAUTHORIZED` if caller isn't the host.
- Rejects with `VALIDATION_ERROR` if `points` is empty, contains a `playerId` not in
  `session.players`, or a non-integer/negative value.
- Rejects with `INVALID_STATE` if `pointsEnabled` is `false` for this session.
- Overwrites (not merges) `session.roundScores.set(roundIndex, new Map(Object.entries(points)))`
  — re-sending the same round's scores is idempotent (data-model.md).
- Scoring is explicitly **not** required before `ADVANCE_ROUND`/`END_GAME` (FR-011, non-blocking
  — no guard here).
- Broadcasts `SCORES_UPDATED` (below).

## Server → Client (new)

### `PLAYER_FINISHED`

```typescript
{ playerId: string }
```

Broadcast to the whole session (host sees per-player status per FR-013; other players may ignore
it).

### `SCORES_UPDATED`

```typescript
{
  roundIndex: number;
  totals: Record<string, number>;   // playerId -> cumulative points across all scored rounds so far
}
```

Broadcast after a successful `AWARD_ROUND_POINTS`. Primarily consumed by the host UI; also lets a
reconnecting host's next `SESSION_STATE` (below) stay consistent without a separate fetch.

## Server → Client (modified payloads)

### `SESSION_STATE` (extended)

```typescript
{
  sessionId: string;
  status: 'lobby' | 'active' | 'ended';
  currentPhrase: string;
  roundIndex: number;
  players: Array<{
    playerId: string;
    name: string;
    connectionStatus: 'connected' | 'disconnected';
    finishedCurrentRound: boolean;        // NEW
  }>;
  settings: {                              // NEW
    roundDurationSec: number;
    maxRounds: number;
    maxPlayers: number;
    pointsEnabled: boolean;
  };
  cumulativeScores: Record<string, number>; // NEW — playerId -> total points so far (FR-019 resume)
}
```

Sent on every `AUTH` (unchanged trigger); the additions are what makes a page-reload mid-game
(FR-019) resumable without any new endpoint.

### `QUESTION_ADVANCED` (extended)

```typescript
{
  roundIndex: number;
  maxRounds: number;   // NEW — lets the client render "Manche N/M" without cross-referencing settings
}
```

### `GAME_ENDED` (extended)

```typescript
{
  pointsEnabled: boolean;                 // NEW
  results: Array<{                        // NEW — empty/ignored when pointsEnabled is false
    playerId: string;
    name: string;
    totalPoints: number;
    rank: number;                         // 1-based; ties broken by join order
  }>;
}
```

Computed server-side at `END_GAME` time from `roundScores` (data-model.md's derived
`PlayerResult`), so every client (host + all players) renders the same podium/list from one
broadcast (Constitution I) without a follow-up fetch.
