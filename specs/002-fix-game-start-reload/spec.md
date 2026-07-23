# Feature Specification: Fix — Players Stuck on Waiting Screen When Game Starts

**Feature Branch**: `002-fix-game-start-reload`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Règle le bug qui fait que lorsque l'admin démarre la partie, le joueur ne voit jamais sa page rechargée"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Player transitions to the game screen after waiting idle (Priority: P1)

A player has joined a session and is sitting on the "waiting for the game to start" screen, phone in hand, app left open in the foreground while the admin waits for everyone else to join (which can take several minutes). When the admin starts the game, the player must automatically land on the game screen with the current phrase — without needing to touch their phone, refresh, or rejoin.

**Why this priority**: This is the core promise of the game: once you've joined, the game starts for you the moment the admin starts it. Today, some players are left stuck on the waiting screen indefinitely with no way to recover on their own, which silently excludes them from the session and stalls the group waiting for them.

**Independent Test**: Have one or more players join a session and leave the app open and idle on the waiting screen for several minutes (simulating the real gap while other participants join). Have the admin start the game. Verify every player reaches the game screen automatically, without any manual action on their device.

**Acceptance Scenarios**:

1. **Given** a player has joined and is idle on the waiting screen with the app open in the foreground, **When** the admin starts the game, **Then** the player automatically sees the game screen with the current phrase, with no action required on their part.
2. **Given** several players joined and have been waiting for different lengths of time (some just joined, some have waited many minutes), **When** the admin starts the game, **Then** all of them reach the game screen, not just the ones who joined most recently.

---

### User Story 2 - Player whose connection silently degraded still catches up (Priority: P2)

A player's connection quietly drops or becomes unreliable while they're waiting (weak mobile signal, network handoff, background OS throttling) even though their app still looks open and connected. When the admin starts the game, this player must still end up on the correct screen — either by recovering in time to receive the start signal, or by resynchronizing to the session's actual current state as soon as their connection is restored.

**Why this priority**: This directly addresses the reported failure mode — a player who "never" sees the transition is almost certainly one whose connection died silently. Without this, User Story 1's fix only covers the easy case and the bug keeps reappearing for players on shakier networks.

**Independent Test**: Simulate a player whose connection becomes unresponsive while the app remains open (not backgrounded), then have the admin start the game, then restore the player's connection. Verify the player ends up on the game screen showing the current phrase, without needing to rejoin or lose their spot in the session.

**Acceptance Scenarios**:

1. **Given** a player's connection has silently become unresponsive while their app stays open in the foreground, **When** the admin starts the game and the player's connection is later restored, **Then** the player automatically lands on the game screen reflecting the actual current state of the session (not a stale "still waiting" view).
2. **Given** a player reconnects after the admin has already moved past the initial start (e.g., a new phrase has since been shared), **When** the player's connection recovers, **Then** the player sees the session's current phrase, not the one that was active when the game first started.

### Edge Cases

- What happens if a player's device is completely offline (e.g., airplane mode, app closed) when the admin starts the game? The player cannot be expected to see the update until their connectivity is restored, and this must not block or fail the game start for everyone else.
- What happens if a player's connection fluctuates repeatedly (flaky signal) during the waiting period rather than dropping once cleanly? The player must still end up on the correct final screen once their connection stabilizes.
- What happens when a large group of players all transition at the same time — is there any noticeable difference in delay between the first and last player to see the game screen?
- What happens if a player reconnects at the exact moment the admin is starting the game? The player must land on the correct screen either way, without ending up stuck between states.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ensure every player who has joined a session eventually reaches the game screen after the admin starts the game, regardless of how long the player was idle on the waiting screen or whether their connection silently degraded while their app appeared open and connected.
- **FR-002**: System MUST detect a player's connection becoming unresponsive even while that player's app remains in the foreground and open (not only when the app is backgrounded, locked, or the device changes network).
- **FR-003**: System MUST NOT require a player to manually refresh, close/reopen, or rejoin the session in order to see the game screen once the admin has started the game.
- **FR-004**: When a player's connection is recovered after being unresponsive, system MUST resynchronize that player to the session's actual current state (waiting, active with the current phrase, or ended) rather than only replaying the original start signal.
- **FR-005**: The admin's ability to start the game MUST NOT be blocked, delayed, or fail because one or more players currently have an unresponsive connection.
- **FR-006**: System MUST preserve existing behavior for players with a healthy, continuously active connection: the transition to the game screen continues to happen automatically and silently, with no visible reload or manual action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of players who joined a session and retain any working connectivity (i.e., not fully offline) eventually reach the game screen after the admin starts the game, without any manual action on their part.
- **SC-002**: Players with a healthy, continuously active connection see the transition to the game screen within 3 seconds of the admin starting the game.
- **SC-003**: Players whose connection had silently degraded while waiting reach the correct current screen within 15 seconds of their connection being restored.
- **SC-004**: The admin can start the game with no perceptible delay or failure, regardless of how many players currently have a degraded connection.
- **SC-005**: Across repeated testing under realistic mobile conditions (idle for 5+ minutes, weak signal, foregrounded the whole time), zero players are left permanently stuck on the waiting screen after the admin starts the game.

## Assumptions

- The existing automatic, no-reload transition from the waiting screen to the game screen is the correct user experience for players with a healthy connection; this fix targets reliability of that transition, not its design.
- "Retains any working connectivity" excludes a player who is fully and permanently offline (e.g., airplane mode with no reconnection, app force-closed) — such a player cannot be expected to see the update until connectivity returns.
- A 15-second bound for recovering a previously-degraded connection is a reasonable target based on typical mobile reconnection expectations; the exact timing can be tuned during implementation.
- This fix extends the connection-recovery behavior already in place for reconnecting after a network loss or app backgrounding, so that it also covers a connection dying silently while the app stays open and in the foreground.
- No change is needed on the admin's side — the admin already reliably sees the transition to the game screen when starting the game.
