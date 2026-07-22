# Quickstart Validation Guide: PWA Drawing Game

**Branch**: `001-pwa-drawing-game` | **Date**: 2025-07-18

This guide describes how to validate that the feature works end-to-end once the implementation is complete. It covers prerequisites, startup, and the key validation scenarios corresponding to each user story.

---

## Prerequisites

- Node.js 20 LTS installed
- `npm install` run from the repository root (installs all workspace dependencies)
- A `.env` file at the repository root based on `.env.example`:
  ```
  HOST_USERNAME=admin
  HOST_PASSWORD_HASH=<bcrypt hash of your chosen password>
  JWT_SECRET=<at least 32 random characters>
  PORT=3000
  ```
- Two devices (or two browser windows) available for host + player simulation

---

## Build & Start

```bash
# Build the frontend and start the backend (serves frontend at /):
npm run build        # builds frontend/dist/
npm start            # starts backend; serves frontend static files

# Dev mode (auto-reload):
npm run dev
```

The app will be available at `http://localhost:3000` (or `PORT` from `.env`).

---

## Validation Scenarios

### Scenario 1 — Host login and session creation (FR-001, FR-002)

1. Open `http://localhost:3000` in a browser.
2. You should be redirected to the login page.
3. Enter the host credentials (from `.env`).
4. **Expected**: Redirected to the host dashboard.
5. Click "New Game".
6. **Expected**: A QR code is displayed. The join URL encoded in the QR code should be `http://localhost:3000/join/<session-id>`.

---

### Scenario 2 — Player joins via QR code (FR-003, FR-004, FR-013)

1. On a second device or browser window (incognito), open the join URL shown under the QR code.
2. **Expected**: A name entry form is displayed.
3. Enter a name (e.g., "Alice") and submit.
4. **Expected**: Player is redirected to the game screen showing a waiting message.
5. On the host window, check the lobby list.
6. **Expected**: "Alice" appears in the player list within 3 seconds (no page refresh needed).

---

### Scenario 3 — Host sets prompt and starts game (FR-005, FR-007)

1. In the host window, type a question in the prompt field (e.g., "Draw a cat").
2. **Expected**: The player's game screen shows "Draw a cat" within 3 seconds.
3. Click "Start Game" on the host screen.
4. **Expected**: The player screen transitions to the active game view (canvas visible, prompt visible).
5. Attempt to open the join URL in a third browser window and submit a name.
6. **Expected**: A "Registration is closed" message is shown — no new player is added. (FR-014)

---

### Scenario 4 — Player draws on canvas (FR-006)

1. On the player screen (active game), draw with mouse (desktop) or finger (mobile).
2. **Expected**: Strokes appear smoothly on the black canvas in a contrasting colour.
3. Move the device to portrait and landscape orientation.
4. **Expected**: Canvas resizes to fill the screen; existing strokes are re-rendered correctly.

---

### Scenario 5 — Host scores and advances (FR-008, FR-009)

1. On the host game screen, tap **+** next to "Alice".
2. **Expected**: Alice's score increments to 1 immediately.
3. Tap **−** once.
4. **Expected**: Score returns to 0.
5. Click "Next Question".
6. **Expected**: The player's canvas clears and the host can type a new prompt.

---

### Scenario 6 — End game and scoreboard (FR-010)

1. Click "End Game" on the host screen and confirm.
2. **Expected**: All player screens display a ranked scoreboard showing player names and final scores.

---

### Scenario 7 — Duplicate player names (FR-012)

1. Open two separate browser windows using the join URL while still in the lobby.
2. Enter "Bob" in both windows (submit them in quick succession).
3. **Expected**: One player is registered as "Bob" and the other as "Bob 2".

---

### Scenario 8 — Host participates as player (FR-011)

1. In the host window, click "Join as Player".
2. Enter a name (e.g., "Host Player").
3. **Expected**: "Host Player" appears in the player list; the host can access both the host control panel and their own drawing canvas.

---

## Running Automated Tests

```bash
# Unit + integration tests (backend):
npm run test --workspace=backend

# E2E tests (Playwright — requires app running):
npm run dev &          # start dev server in background
npm run test:e2e --workspace=frontend
```

**Expected**: All tests pass with no failures.

---

## Key Validation References

- **Data model**: [`data-model.md`](./data-model.md) — entity shapes and validation rules
- **HTTP API**: [`contracts/http-api.md`](./contracts/http-api.md) — endpoint shapes and error codes
- **WebSocket events**: [`contracts/websocket-events.md`](./contracts/websocket-events.md) — full event catalogue
- **Success criteria**: [`spec.md#success-criteria`](./spec.md) — SC-001 through SC-007
