# Feature Specification: Mobile Drawing Party Game

**Feature Branch**: `001-draw-guess-mobile`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "L'application doit est vouée à tourner sur mobile -

1 - un admin setup une partie et génère un QR code pour les joueurs
2 - les joueurs scan le QR code et arrivent sur une page "join game" ou ils mettent un pseudo et valident => Un message apparait "en attente du début de la partie"
3 - l'admin voit en direct tous les joueus venant de rejoindre
4 - une fois tout le monde dans la partie l'admin peut "commencer la partie"
5 - tous les joueurs arrivent sur la page de la partie.
 - - Un label avec la phrase écrite par l'admin
- - Le reste de l'espace disponible sur l'écran est une zone de dessin (s'i lfaut installer un plugin pour pouvoir dessiner de manière sympa, propose une idée)

Ensuite c'est l'admin qui dirige la partie en pouvant écrire une nouvelle phrase et valider pour qu'elle soit partagée aux joueurs"

## Clarifications

### Session 2026-07-23

- Q: How should the system handle two players joining the same session with identical nicknames? → A: Allow duplicates freely — no uniqueness enforcement; admin may see identical names in the roster.
- Q: What happens when a player's device loses connectivity (or the app backgrounds/locks) and then reconnects? → A: Full reconnect — the player automatically resumes their current state (waiting or game screen) on the same device/browser, without re-entering their nickname.
- Q: What happens when the admin's own device loses connectivity mid-game? → A: Session persists without the admin — the current phrase stays active for players, and the admin can reconnect from the same device/browser to seamlessly resume control.
- Q: What language should the user interface be in? → A: French only — all UI text is in French; no language toggle or English variant is required.
- Q: What should a player see when scanning a code/link for a session that never existed (typo, stale/fake QR), as opposed to one that has ended? → A: A distinct "game not found" message, separate from the "this game has ended" message.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates a game and players join via QR code (Priority: P1)

An admin sets up a new game session and receives a QR code (and equivalent link) to share with participants. Players scan the code on their own mobile phones, land on a join page, enter a nickname, and confirm. After confirming, they see a clear "waiting for the game to start" message.

**Why this priority**: This is the entry point of the whole experience. Without a working setup + join flow, no other part of the game can be reached or tested. It is the minimum slice that proves the core onboarding mechanic works end-to-end.

**Independent Test**: Can be fully tested by having an admin create a game on one device and one or more players scan the generated QR code from separate mobile devices, enter a nickname, and confirm — each player should land on a waiting screen without needing the game to actually start.

**Acceptance Scenarios**:

1. **Given** an admin has set up a new game, **When** the admin requests to generate access for players, **Then** a QR code and a corresponding join link are displayed.
2. **Given** a player scans the QR code, **When** the join page loads, **Then** the player is prompted to enter a nickname before doing anything else.
3. **Given** a player has entered a nickname and confirms, **When** the join is accepted, **Then** the player sees a "waiting for the game to start" message and cannot yet access the game screen.
4. **Given** a player submits the join form with an empty nickname, **When** they try to confirm, **Then** the system rejects the submission and asks for a valid nickname.

---

### User Story 2 - Admin monitors joined players and starts the game (Priority: P2)

While players are joining, the admin sees a live, continuously updating roster of everyone who has joined the session. Once satisfied that enough players are present, the admin triggers the start of the game.

**Why this priority**: This gives the admin control over session pacing and confidence that participants are actually connected before committing to start — it is the bridge between onboarding (Story 1) and actual gameplay (Story 3).

**Independent Test**: Can be tested by joining several players (Story 1) and verifying the admin's screen reflects each new arrival without a manual refresh, then confirming that triggering "start game" is only meaningfully testable once at least the roster view works.

**Acceptance Scenarios**:

1. **Given** the admin is on the game setup/lobby screen, **When** a new player successfully joins, **Then** that player's nickname appears in the admin's live roster without the admin needing to refresh the page.
2. **Given** one or more players have joined, **When** the admin triggers "start the game," **Then** the game transitions out of the waiting state for all joined players.
3. **Given** no players have joined yet, **When** the admin views the lobby, **Then** the roster clearly shows zero players (not an error or blank state).

---

### User Story 3 - Players see the admin's phrase and draw freely (Priority: P2)

Once the admin starts the game, every joined player is moved to the main game screen. That screen displays the phrase the admin has set, and the rest of the available screen space is a freehand drawing area where the player can draw with their finger/stylus.

**Why this priority**: This is the core gameplay experience — the reason the app exists. It depends on Stories 1 and 2 to have players and a started session, but delivers the actual product value once reached.

**Independent Test**: Can be tested by starting a game (Story 2) with at least one joined player and confirming that player's screen shows the current phrase as a label and that touch/mouse input on the remaining screen area produces visible drawing strokes.

**Acceptance Scenarios**:

1. **Given** the admin has started the game, **When** a player's screen loads the game view, **Then** a label showing the admin's current phrase is visible at all times.
2. **Given** a player is on the game screen, **When** they draw with a finger or pointer on the non-label area, **Then** their strokes render smoothly and immediately in that area.
3. **Given** a player's device is a typical modern smartphone, **When** they use the drawing area, **Then** the drawing area occupies all remaining screen space not used by the phrase label, in both portrait and landscape orientation.

---

### User Story 4 - Admin publishes a new phrase during the game (Priority: P3)

While the game is running, the admin writes a new phrase and confirms it. That phrase is immediately shared with all players, replacing the previous one on their game screens.

**Why this priority**: This turns a single static round into a repeatable, host-driven session, which is the mechanism that gives the game session ongoing value across multiple rounds. It builds directly on Story 3's game screen.

**Independent Test**: Can be tested by starting a game (Story 3) and having the admin submit a new phrase, then confirming that all connected players' phrase labels update to the new text without any action on the players' part.

**Acceptance Scenarios**:

1. **Given** a game is in progress, **When** the admin enters a new phrase and confirms it, **Then** every connected player's phrase label updates to the new text.
2. **Given** the admin tries to confirm an empty phrase, **When** they submit, **Then** the system rejects the submission and keeps the previously published phrase active.
3. **Given** the admin has just published a new phrase, **When** a player's screen updates, **Then** the update happens without the player needing to refresh or take any action.

---

### User Story 5 - Admin ends the game (Priority: P4)

At any point while the session is active, the admin can explicitly end the game. When they do, every connected player is taken off the game screen and shown a closing/summary screen, and the session stops accepting new phrases or new players.

**Why this priority**: This gives the session a clean, deliberate conclusion instead of just fading out, which matters for a polished experience but is not required for the core drawing loop to deliver value.

**Independent Test**: Can be tested by starting a game (Story 3/4) and having the admin trigger "end game," then confirming all connected players are moved to a closing screen and that the session no longer accepts phrase updates or new joins.

**Acceptance Scenarios**:

1. **Given** a game session is in progress, **When** the admin triggers the "end game" action, **Then** every connected player is moved from the game screen to a closing/summary screen.
2. **Given** a game session has ended, **When** the admin attempts to publish another phrase, **Then** the system rejects it because the session is no longer active.
3. **Given** a game session has ended, **When** a new player scans the original QR code or join link, **Then** the system informs them the session has ended rather than letting them join.

### Edge Cases

- What happens when a player tries to join after the admin has already started the game? (Late join)
- How does the game screen behave when a player rotates their device or the on-screen keyboard appears/disappears?
- What happens if the admin ends the game session directly from the lobby, before ever starting it (players still on the "waiting" screen)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an admin to create a new game session.
- **FR-002**: System MUST generate, for each game session, a unique QR code and an equivalent shareable join link that players can use to reach the join page for that specific session.
- **FR-003**: System MUST let a player join a game session by scanning its QR code or opening its join link.
- **FR-004**: System MUST require a player to enter a non-empty nickname and confirm it before being considered joined to a session.
- **FR-005**: System MUST reject join attempts with a blank/empty nickname and prompt the player to correct it.
- **FR-006**: System MUST show a joined player a "waiting for the game to start" message once they have joined, and keep them there until the admin starts the game.
- **FR-007**: System MUST show the admin a live roster of all players who have joined their session, updating automatically as players join without requiring a manual page refresh.
- **FR-008**: System MUST allow the admin to explicitly trigger the start of the game session.
- **FR-009**: System MUST move every joined player from the waiting state to the game screen automatically when the admin starts the game.
- **FR-010**: System MUST display the current admin-defined phrase as a persistent, clearly visible label on every player's game screen.
- **FR-011**: System MUST provide each player a freehand drawing area covering all screen space not occupied by the phrase label.
- **FR-012**: System MUST support freehand drawing input via touch (finger) and pointer input, rendering strokes immediately as the player draws.
- **FR-013**: System MUST allow the admin, at any point while the game is in progress, to enter a new phrase and publish it to all connected players.
- **FR-014**: System MUST reject an empty/blank phrase submission from the admin and keep the currently published phrase active.
- **FR-015**: System MUST propagate a newly published phrase to all connected players automatically, without requiring players to refresh or take any action.
- **FR-016**: System MUST function on mobile-device screen sizes and orientations (portrait and landscape) for both the admin's and players' experiences.
- **FR-017**: System MUST isolate each game session so that players and phrases from one session never appear in another session's admin roster or player screens.
- **FR-018**: System MUST keep every player's drawing canvas private: no other player and no admin can view, at any time, a canvas that is not their own.
- **FR-019**: System MUST allow the admin to explicitly end the game session via a dedicated "end game" action, independent of publishing a new phrase.
- **FR-020**: System MUST show all connected players a closing/summary screen immediately when the admin ends the game session.
- **FR-021**: Once a game session has ended, system MUST prevent the admin from publishing further phrases and MUST prevent new players from joining that session.
- **FR-022**: System MUST permit multiple players within the same session to use identical nicknames; nicknames are not required to be unique and duplicate names MAY appear as-is in the admin's roster.
- **FR-023**: System MUST allow a player whose connection drops (e.g., app backgrounded, device locked, brief network loss) to automatically resume their current session state (waiting or game screen) upon reconnecting from the same device/browser, without re-entering their nickname.
- **FR-024**: System MUST keep a game session and its currently active phrase available to connected players if the admin disconnects, and MUST allow the admin to reconnect from the same device/browser to seamlessly resume control of that same session.
- **FR-025**: System MUST present all user-facing text (labels, buttons, messages) in French.
- **FR-026**: System MUST show a player a distinct "this game could not be found" message when they attempt to join using a code/link that does not correspond to any existing game session, separate from the message shown for a session that has already ended.

### Key Entities

- **Game Session**: A single instance of the party game run by one admin. Key attributes: unique session code, current status (waiting for players / in progress / ended), the currently active phrase, creation time.
- **Player**: A participant who has joined a specific game session. Key attributes: nickname (not required to be unique within the session), the session they belong to, join time, connection status.
- **Phrase**: A prompt written by the admin and shown to all players. Key attributes: text content, the session it belongs to, the time it was published, its order relative to other phrases in the same session.
- **Admin**: The person who creates and drives a game session — sets up the session, monitors joining players, starts the session, and publishes phrases. Modeled as the owner/controller of a Game Session rather than a persistent account.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can go from scanning the QR code to reaching the "waiting for the game to start" screen in under 15 seconds on a typical mobile connection.
- **SC-002**: A newly joined player appears in the admin's live roster within 2 seconds of joining, with no manual refresh needed.
- **SC-003**: When the admin starts the game, at least 95% of connected players reach the game screen within 3 seconds.
- **SC-004**: When the admin publishes a new phrase, at least 95% of connected players see the updated phrase within 2 seconds.
- **SC-005**: A single game session supports at least 20 simultaneous players drawing at the same time without noticeable input lag on any individual player's screen.
- **SC-006**: 90% of first-time players can join a session and reach the drawing screen without external instructions or help.
- **SC-007**: When the admin ends the game session, at least 95% of connected players see the closing screen within 3 seconds.

## Assumptions

- The admin defines an initial phrase as part of setting up the game session (before or while generating the QR code); this phrase is the first one players see once the game starts.
- Both admin and players are anonymous for the purposes of this feature — no account creation, login, or persistent identity is required; a nickname is sufficient to identify a player within a single session.
- Nicknames are not required to be unique within a session; duplicate nicknames are allowed and no disambiguation is performed by the system.
- There is no time limit imposed on how long a phrase stays active; the admin manually decides when to publish the next phrase (no automatic timer/round mechanic was described).
- Drawings are private per player — no admin or peer spectating, gallery, or scoring feature is included in this iteration; drawings are not required to be saved, exported, or retained after a game session ends.
- A game session is expected to comfortably support a casual in-person group (up to ~20 players); very large audiences are out of scope for this feature.
- The QR code and join link are only valid for their originating game session; starting a new session produces a new code/link.
- Mobile support is the primary target for both admin and player experiences; larger-screen usage (e.g., admin on a laptop/tablet to project the QR code) should still work but is not the primary design target.
- Ending a game session is a manual, explicit admin action; there is no automatic session expiry or timeout in this iteration.
- Reconnection is tied to the same device/browser (e.g., via a locally persisted session identifier); a player switching to a different device is treated as a new join, not a resume.
- No internationalization/localization framework is required; the product ships with a single, French-language interface.
