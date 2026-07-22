# Drawing Game PWA

A real-time multiplayer drawing game. An authenticated host creates a session and shares a QR code; players join on their mobile devices, see the current prompt, and draw on a black canvas. The host awards points and can advance rounds.

---

## Prerequisites

- **Node.js 20 LTS** — [nodejs.org](https://nodejs.org)
- **npm 9+** (bundled with Node.js)

---

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Generate a bcrypt password hash (choose any password you like):

```bash
node -e "require('bcryptjs').hash('your-password', 10).then(console.log)"
```

Edit `.env`:

```dotenv
HOST_USERNAME=admin
HOST_PASSWORD_HASH=<bcrypt hash from command above>
JWT_SECRET=<at least 32 random characters, e.g. openssl rand -hex 32>
PORT=3000
```

---

## Install

```bash
npm install
```

This installs dependencies for the root, `backend/`, and `frontend/` workspaces in one step.

---

## Development

```bash
npm run dev
```

Starts:
- **Vite dev server** on `http://localhost:5173` (frontend with HMR)
- **Fastify backend** on `http://localhost:3000` (API + WebSocket)

> During dev, open `http://localhost:5173` — the Vite proxy forwards `/api` and `/ws` to the backend.

---

## Production Build

```bash
npm run build    # compiles frontend into frontend/dist/
npm start        # starts backend; serves frontend/dist/ at /
```

The app is then available at `http://localhost:3000` (or `PORT` from `.env`).

---

## Running Tests

### Unit + integration tests (backend)

```bash
npm run test --workspace=backend
```

Covers `SessionManager`, `dedupName`, JWT auth, and HTTP API integration tests.

### E2E tests (Playwright)

> Requires the app to be running first.

```bash
# Terminal 1 — start the app
npm run dev

# Terminal 2 — run E2E tests
npm run test:e2e --workspace=frontend
```

---

## Validation

See [`specs/001-pwa-drawing-game/quickstart.md`](specs/001-pwa-drawing-game/quickstart.md) for the 8 manual validation scenarios covering all user stories.

---

## Project Structure

```
backend/       Node.js 20 + Fastify 4 API server
frontend/      Vite 5 + vanilla TypeScript SPA (PWA)
package.json   npm workspaces root
.env.example   Environment variable template
```

For architecture details see [`specs/001-pwa-drawing-game/plan.md`](specs/001-pwa-drawing-game/plan.md).
