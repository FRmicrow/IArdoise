# Implementation Plan: PWA Drawing Game

**Branch**: `001-pwa-drawing-game` | **Date**: 2025-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-pwa-drawing-game/spec.md`

---

## Summary

A real-time multiplayer PWA where an authenticated host creates a game session, shares a QR code, and manages rounds — each consisting of a text prompt that players respond to by drawing on a black canvas. The host manually awards points per player. The stack is a Node.js/TypeScript backend with WebSocket-based real-time sync, a Vite + vanilla TypeScript SPA (PWA) frontend served as a single deployable unit, and an in-memory session store (no database required for v1 given the ≤20-player, ephemeral-drawing scope).

---

## Technical Context

**Language/Version**: TypeScript 5.x (both frontend and backend)

**Primary Dependencies**:
- **Backend**: Node.js 20 LTS, Fastify 4 (HTTP + WebSocket), `ws` (WebSocket server), `qrcode` (QR generation), `bcryptjs` (password hashing), `jose` (JWT signing)
- **Frontend**: Vite 5, vanilla TypeScript (no framework — keeps bundle minimal on mobile), `qrcode` render in `<canvas>`, HTML5 Canvas API for drawing

**Storage**: In-memory (plain TypeScript Maps/objects on the server process); no external database for v1. Host credentials stored in a `.env`-sourced config file at startup.

**Testing**: Vitest (unit + integration), Playwright (E2E smoke tests for the PWA flows)

**Target Platform**: Any modern mobile browser (iOS Safari 15+, Android Chrome 100+); host dashboard on desktop Chrome/Firefox/Safari

**Project Type**: Full-stack web application (single repo, monorepo-lite with `backend/` and `frontend/` workspaces)

**Performance Goals**: ≥30 fps drawing on mid-range mobile; prompt/score broadcast latency ≤3 s under 20 concurrent WebSocket connections

**Constraints**: No database dependency (v1); offline drawing canvas (strokes buffered locally, sync on reconnect); installable as PWA (service worker + web manifest)

**Scale/Scope**: 1 active session per host, ≤20 simultaneous players; single host account (credentials in env)

---

## Constitution Check

*The project constitution is a blank template — no project-specific principles are defined. The following general software quality gates apply:*

| Gate | Status | Notes |
|------|--------|-------|
| Feature spec complete and validated | ✅ PASS | All 14 FR covered, checklist clean |
| No unnecessary external dependencies | ✅ PASS | In-memory store avoids DB overhead for v1 scope |
| Real-time mechanism justified | ✅ PASS | WebSocket chosen over polling; 20-player target easily served by `ws` |
| PWA requirements addressable | ✅ PASS | Vite PWA plugin handles manifest + service worker |
| Single deployment unit | ✅ PASS | Backend serves frontend static assets; one `npm start` |
| Drawing ephemerality respected | ✅ PASS | Canvas state never sent to server; cleared on next-question event |

No violations. Phase 0 research may proceed.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-pwa-drawing-game/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── websocket-events.md
│   └── http-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── auth/            # login endpoint, JWT issuance, middleware
│   ├── session/         # SessionManager (in-memory), Player, Prompt models
│   ├── ws/              # WebSocket handler, event router, broadcast helpers
│   ├── qr/              # QR code generation utility
│   └── index.ts         # Fastify app entry point
├── tests/
│   ├── unit/            # SessionManager, auth, QR
│   └── integration/     # HTTP + WS integration tests
└── package.json

frontend/
├── src/
│   ├── pages/           # login.ts, lobby-host.ts, game-host.ts, game-player.ts, join.ts, scoreboard.ts
│   ├── canvas/          # DrawingCanvas class (HTML5 Canvas, pointer events)
│   ├── ws/              # WebSocketClient (reconnect logic, event bus)
│   ├── components/      # Reusable UI fragments (scoreboard-row, player-list-item)
│   └── main.ts          # SPA router (hash-based)
├── public/
│   ├── manifest.json    # PWA manifest
│   └── icons/           # App icons (192, 512 px)
├── tests/
│   └── e2e/             # Playwright smoke tests
└── package.json

package.json             # Root workspace (npm workspaces)
.env.example             # HOST_USERNAME, HOST_PASSWORD_HASH, JWT_SECRET, PORT
```

**Structure Decision**: Web application (Option 2) with `backend/` and `frontend/` as npm workspaces under a root `package.json`. Backend serves the Vite-built `frontend/dist/` as static files in production, so a single `node backend/dist/index.js` starts the whole app. The monorepo-lite approach avoids polyrepo overhead while keeping concerns separated.

---

## Complexity Tracking

No constitution violations to justify.
