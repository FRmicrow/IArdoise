# Feature Specification: PWA Drawing Game

**Feature Branch**: `001-pwa-drawing-game`

**Created**: 2025-07-18

**Status**: Draft

**Input**: User description: "Je veux créer une PWA simple. Le concept : Un host est connecté (avec une authent) et partage un QR code à d'autres participants. Ce QR code ouvre une page web sur le mobile du joueur et cette page web comporte : Un champ texte ou le joueur écrit son nom puis il arrive sur une page simple avec : Un texte défini par l'host. Une zone libre de dessin ou le joueur peut dessiner comme il veut sur fond noir. L'host lui peut participer comme joueur. Il a un écran "host" dans lequel il peut écrire la question/phrase qui sera partagée à tous les joueurs (le texte défini) et il peut attribuer les points aux joueurs avec des + et - devant les noms des joueurs enregistrés via le QR code. Une fois tout le monde enregistré (donc l'host voit les noms des personnes ayant scanné + écrit un nom) l'host peut "commencer la partie" et la plus aucune inscription n'est possible. L'host gère le passage à la question suivante et défini quand la partie est terminée."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Host creates a game session (Priority: P1)

The host logs in, creates a new game session and receives a QR code to share with players. The host sees the lobby filling up in real-time as participants join by scanning the code and entering their name.

**Why this priority**: Without a joinable session there is no game. This is the entry point for every other feature.

**Independent Test**: A host can log in, generate a QR code, and see player names appear in a lobby list — fully testable without points or drawing logic.

**Acceptance Scenarios**:

1. **Given** the host is not logged in, **When** they open the app, **Then** they are presented with a login screen and cannot access the host dashboard until authenticated.
2. **Given** the host is logged in, **When** they create a new game session, **Then** a unique QR code is displayed that encodes a joinable URL specific to that session.
3. **Given** a player scans the QR code and submits a name, **When** the host views the lobby, **Then** the player's name appears in the list within 3 seconds without requiring a page refresh.
4. **Given** a player attempts to join after the host has started the game, **When** they scan the QR code, **Then** they see a message indicating registration is closed.

---

### User Story 2 — Player joins and draws (Priority: P2)

A player scans the QR code, enters their name, and lands on the game screen. They see the host's current question/prompt and can draw freely on a full-screen black canvas using touch or pointer input.

**Why this priority**: Drawing is the core player interaction; the game has no purpose without it.

**Independent Test**: With a session already created, a player can join, see a prompt text and draw on a canvas — fully demonstrable before any scoring exists.

**Acceptance Scenarios**:

1. **Given** the player opens the QR code URL, **When** they enter a name and submit, **Then** they are redirected to the game screen showing the current prompt and a black drawing canvas.
2. **Given** the player is on the game screen, **When** they draw with their finger or stylus, **Then** the strokes appear smoothly on the canvas in a contrasting colour on the black background.
3. **Given** the host has not yet started the game, **When** the player arrives on the game screen, **Then** they see a waiting indicator until the game starts.
4. **Given** the host advances to the next question, **When** the player's screen updates, **Then** the canvas is cleared and the new prompt is displayed.

---

### User Story 3 — Host manages the game (Priority: P3)

The host controls game flow from a dedicated host screen: writing the prompt visible to all players, starting the game, advancing to the next question, awarding or deducting points per player, and ending the game.

**Why this priority**: Scoring and game-flow control add structure but the draw-and-guess loop can be demonstrated without them.

**Independent Test**: With players joined, the host can write a prompt that players see, start the game, increment/decrement a player's score, advance questions, and end the session — all independently verifiable.

**Acceptance Scenarios**:

1. **Given** the host is in the lobby, **When** they type in the prompt field, **Then** all currently connected players see the updated text on their game screen within 3 seconds.
2. **Given** all desired players have joined, **When** the host clicks "Start game", **Then** new registrations are locked and all player screens transition to the active game view.
3. **Given** the game is active, **When** the host taps **+** or **−** next to a player's name, **Then** that player's score is incremented or decremented by 1 point and the scoreboard updates immediately.
4. **Given** the host wants a new round, **When** they click "Next question", **Then** all player canvases are cleared and the host can enter a new prompt.
5. **Given** the host clicks "End game", **When** the action is confirmed, **Then** all player screens display a final scoreboard ranked by points.

---

### User Story 4 — Host participates as a player (Priority: P4)

The host can join the current session as a player, giving them access to the drawing canvas in addition to the host controls.

**Why this priority**: Nice-to-have social feature; does not block core functionality.

**Independent Test**: The host can open the player view for themselves alongside the host panel and draw on the canvas.

**Acceptance Scenarios**:

1. **Given** the host is on the host screen, **When** they choose "Join as player", **Then** a player name entry (pre-populated with a default or editable) is created for them and they appear in the lobby list.
2. **Given** the host has joined as a player, **When** the game starts, **Then** they can switch between the host control panel and their own drawing canvas.

---

### Edge Cases

- What happens when two players try to register with the same name? → The system appends a numeric suffix (e.g. "Alice" → "Alice 2") and notifies the player.
- What happens when a player's connection drops mid-game? → The player's name remains on the host's list with a visual indicator; they can reconnect and resume drawing.
- What happens if the host closes the browser or loses connectivity? → The game session enters a paused state; players see a "Host disconnected" message and the session resumes when the host reconnects.
- What happens when the host clicks "Start game" with zero players? → The button is disabled or a confirmation warning is shown.
- What happens on a device with no touch screen (host on desktop)? → The drawing canvas supports mouse input as well.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a host to authenticate before accessing host features.
- **FR-002**: System MUST generate a unique, session-scoped QR code that encodes a joinable URL.
- **FR-003**: System MUST allow a player to enter a name when following the QR code link.
- **FR-004**: System MUST display the player's name in the host lobby list in real-time after registration.
- **FR-005**: System MUST allow the host to write a prompt that is broadcast and displayed on all connected player screens.
- **FR-006**: System MUST provide a black free-draw canvas on the player game screen, supporting touch and mouse input.
- **FR-007**: System MUST lock new player registrations once the host starts the game.
- **FR-008**: System MUST allow the host to advance to the next question, which clears all player canvases and allows a new prompt.
- **FR-009**: System MUST allow the host to increment or decrement a score for each registered player.
- **FR-010**: System MUST allow the host to end the game, triggering a final scoreboard visible to all participants.
- **FR-011**: System MUST allow the host to optionally join the session as a named player.
- **FR-012**: System MUST handle duplicate player names by appending a numeric suffix automatically.
- **FR-013**: System MUST function as a Progressive Web App — installable and operable on mobile browsers without requiring a native app download.
- **FR-014**: System MUST display a "registration closed" message to players who attempt to join after the game has started.

### Key Entities

- **Session**: Represents a single game session; has a unique identifier, a status (lobby / active / ended), a current prompt, and the join URL.
- **Player**: A participant in a session; has a name, a score (integer), a connection status, and a reference to their session.
- **Host**: Authenticated user who owns and manages one or more sessions; can also register as a Player within their own session.
- **Prompt**: The text written by the host for a given round; has an order index within the session.
- **Drawing**: The canvas state belonging to a player for a given prompt/round; stored ephemerally (displayed but not required to persist between rounds).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can scan the QR code and complete name registration in under 30 seconds.
- **SC-002**: The host's prompt text appears on all connected player screens within 3 seconds of submission.
- **SC-003**: Score updates are reflected on the host's screen within 1 second of tapping + or −.
- **SC-004**: The app is fully usable on a mobile browser without installation prompts blocking the core flow.
- **SC-005**: The drawing canvas supports continuous stroke input at ≥30 frames per second on a mid-range mobile device, ensuring smooth drawing without lag.
- **SC-006**: A game session from lobby creation to end-game scoreboard can be completed by a non-technical host with no prior instructions in under 5 minutes.
- **SC-007**: The system supports at least 20 simultaneous players per session without degradation of the real-time sync.

---

## Assumptions

- The app is intended for small, co-located or remote social groups (2–20 players); large-scale deployment is out of scope for v1.
- Host authentication uses a simple username/password mechanism; third-party OAuth or SSO is out of scope for v1.
- Player drawings are ephemeral — they are cleared each round and not persisted server-side; there is no drawing review or gallery feature in v1.
- Only one active session per host account at a time is required for v1.
- The game is text-prompt + free-draw only; no image prompts, audio, or voting mechanisms are required for v1.
- Players access the game exclusively through a web browser via the QR code link; no native app packaging is required.
- Real-time synchronisation (prompt broadcast, player list, score updates) uses a standard WebSocket or server-sent event mechanism; exact technology is left to the implementation team.
- No explicit in-game chat or player-to-player communication features are required in v1.
- The scoring system uses integer points (no decimal or weighted scoring); there is no automatic point calculation — scoring is entirely manual by the host.
