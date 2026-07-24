# Data Model: Hub de mini-jeux, parties configurables et podium

All entities below live in the existing in-memory `SessionManager` singleton
(`backend/src/session/SessionManager.ts`) — no persistent store is introduced (Constitution V).
Types shown as additive diffs against `backend/src/session/types.ts`.

## Session (extended)

```typescript
export interface SessionSettings {
  roundDurationSec: number;   // one of 30, 60, 90, 120 — default 60 (FR-004)
  maxRounds: number;          // one of 3, 5, 10 — default 3 (FR-004)
  maxPlayers: number;         // one of 4, 8, 12, 16 — default 8, indicative only (FR-004, FR-005)
  pointsEnabled: boolean;     // default true (FR-004)
}

export interface Session {
  id: string;
  status: SessionStatus;               // 'lobby' | 'active' | 'ended' — unchanged
  joinUrl: string;
  currentPhrase: string;
  roundIndex: number;                  // unchanged meaning: 0-based, current round in progress
  players: Map<string, Player>;
  phrases: Phrase[];                   // unchanged — free-text prompt history
  createdAt: Date;

  // NEW
  settings: SessionSettings;
  roundScores: Map<number, Map<string, number>>; // roundIndex -> (playerId -> points)
}
```

**Validation rules** (enforced via `zod` at the HTTP/WS boundary per research.md):
- `roundDurationSec` ∈ {30, 60, 90, 120}; `maxRounds` ∈ {3, 5, 10}; `maxPlayers` ∈ {4, 8, 12, 16}.
  Any other value is rejected at session creation (400) rather than silently clamped.
- `roundIndex` MUST NOT advance past `settings.maxRounds - 1` while `status === 'active'`
  (FR-009); the round-advance handler returns `INVALID_STATE` if it would.
- `maxPlayers` is never enforced against `players.size` (FR-005 — indicative only, clarified).

**State transitions** (extends existing `lobby → active → ended`):
- `lobby → active`: unchanged (`START_GAME`, requires ≥1 player).
- Within `active`, `roundIndex` increments by 1 per round-advance action, bounded by
  `maxRounds - 1`.
- `active → ended`: unchanged (`END_GAME`), now additionally computes final totals from
  `roundScores` for the `GAME_ENDED` broadcast payload (FR-015).

## Player (extended)

```typescript
export interface Player {
  id: string;
  sessionId: string;
  name: string;
  connectionStatus: ConnectionStatus;   // unchanged
  isHost: boolean;
  wsClientId: string | null;
  registeredAt: Date;

  // NEW
  finishedCurrentRound: boolean;        // true once the player signals "J'ai fini" (FR-012)
}
```

**Validation rules**:
- `finishedCurrentRound` resets to `false` for every player whenever the round advances
  (`roundIndex` changes) or the game starts — mirrors the existing `currentPhrase` reset in
  `NEXT_QUESTION`/`SET_PROMPT` handling.
- Only the player's own connection may set their own `finishedCurrentRound = true` (the
  finish-signal handler derives `playerId` from `authContext`, never from the payload —
  consistent with how every other player-scoped handler in this codebase resolves identity).

## Round score entry (conceptual — not a separate stored type)

Represented as `Session.roundScores.get(roundIndex)`, a `Map<playerId, number>`.

- **Fields**: `playerId` (must reference an existing `session.players` entry), `points`
  (non-negative integer; free-form per clarification — no rank-derived table, FR-011).
- **Presence is optional per round**: a round with no entry in `roundScores` is treated as
  contributing 0 points to every player for that round (FR-011 non-blocking, Edge Cases).
- **Idempotent by design**: awarding points for a round the host already scored overwrites that
  round's map rather than accumulating duplicate entries — re-sending the same `AWARD_ROUND_POINTS`
  payload twice (e.g. a retried request) must not double-count.

## Derived: Player total score

Not stored — computed on demand (each `GAME_ENDED` broadcast, and on host `SESSION_STATE`
resume) by summing `roundScores.get(i)?.get(playerId) ?? 0` across `i` from `0` to `roundIndex`.

```typescript
interface PlayerResult {
  playerId: string;
  name: string;
  totalPoints: number;   // only meaningful when settings.pointsEnabled
  rank: number;          // 1-based, ties broken by join order (registeredAt)
}
```

Used to build the `GAME_ENDED` payload's ranked list and podium (top 3), per FR-015.

## Game catalog entry (frontend-only, not backend state)

```typescript
interface GameCatalogEntry {
  key: 'ardoise';           // stable identifier, extensible for future games
  name: string;
  description: string;
  playable: boolean;        // true only for 'ardoise' today
}
```

Hardcoded array in the frontend (`frontend/src/data/gameCatalog.ts` or inline in `hub.ts`) — see
research.md's "Game catalog is static frontend data" decision. Never sent to or validated by the
backend.

## Entity relationship summary

```
Session 1───* Player
Session 1───* Phrase              (unchanged, free-text prompt history)
Session 1───1 SessionSettings     (embedded, not a separate map)
Session 1───* roundScores[roundIndex] 1───* (playerId → points)
```

No new relationships to existing entities (`Session`/`Player`) beyond the additive fields above;
no new top-level collections in `SessionManager`.
