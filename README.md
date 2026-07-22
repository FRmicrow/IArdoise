# IArdoise — Drawing Game PWA

> 🎨 A real-time multiplayer drawing game. An authenticated host creates a session, shares a QR code, and players join on mobile devices to draw prompts and compete for points.

**IArdoise** (French for "chalkboard") is a progressive web app (PWA) where:
- A **host** authenticates, creates drawing sessions, manages rounds, and awards points
- **Players** join via QR code, see prompts, draw on a shared black canvas, and track scores in real-time over WebSocket

---

## ⚡ Quick Start

### Prerequisites
- **Node.js 20 LTS** — [nodejs.org](https://nodejs.org)
- **npm 9+** (comes with Node.js)

### Install & Run

```bash
# Navigate to the app directory
cd IArdoise

# Install dependencies (all workspaces)
npm install

# Create environment file
cp .env.example .env

# Generate bcrypt hash for HOST_PASSWORD (choose your password)
node -e "require('bcryptjs').hash('your-password', 10).then(console.log)"

# Edit .env with:
# - HOST_USERNAME=admin
# - HOST_PASSWORD_HASH=<hash from above>
# - JWT_SECRET=<32+ random chars>
# - PORT=3000

# Start development (backend + frontend with HMR)
npm run dev
```

Visit:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

---

## 📦 Project Structure

```
IArdoise/
├── backend/           # Fastify API server + WebSocket
│   ├── src/
│   │   ├── api/       # Endpoints (auth, sessions, scores)
│   │   ├── ws/        # WebSocket handlers (drawing, rounds)
│   │   └── types/     # TypeScript types
│   └── package.json
├── frontend/          # Vite + TypeScript SPA (PWA)
│   ├── src/
│   │   ├── pages/     # Login, host dashboard, player canvas
│   │   ├── components/# Reusable UI components
│   │   └── lib/       # Utilities (WebSocket, drawing)
│   └── package.json
├── .specify/          # Project specification & tasks (Speckit)
├── specs/             # Feature specs, validation scenarios
├── .env.example       # Environment template
└── package.json       # npm workspaces root
```

---

## 🚀 Development

### Scripts

```bash
npm run dev        # Start backend + frontend (HMR enabled)
npm run build      # Build frontend; prepare backend for production
npm start          # Run production build (serve frontend from backend)
npm test           # Run backend unit + integration tests
npm run test:e2e   # Run Playwright E2E tests (requires app running)
```

### Environment Variables

Copy `.env.example` to `.env`:

```dotenv
HOST_USERNAME=admin                    # Login username
HOST_PASSWORD_HASH=<bcryptjs hash>     # Password hash (see setup above)
JWT_SECRET=<32+ random characters>     # Secret for JWT signing
PORT=3000                              # Backend port
```

Generate `JWT_SECRET`:
```bash
openssl rand -hex 32
```

---

## 🏗️ Architecture

See [**ARCHITECTURE.md**](ARCHITECTURE.md) for:
- **Frontend Architecture** — TypeScript SPA, PWA manifest, offline support
- **Backend Architecture** — Fastify, WebSocket real-time sync, session management
- **Data Flow** — Auth → Session creation → Drawing → Scoring
- **Database** — Session state (in-memory), persistent logs

---

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deploy to production (Docker, Node.js, environment setup)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Technical design, API routes, WebSocket events
- **[specs/001-pwa-drawing-game/](IArdoise/specs/001-pwa-drawing-game/)** — Feature specification & validation scenarios

---

## ✅ Testing

### Backend (Unit + Integration)
```bash
npm run test --workspace=backend
```
Covers:
- SessionManager (create, join, draw, advance rounds)
- dedupName utility (collision avoidance)
- JWT auth (token validation, expiration)
- HTTP API (login, session endpoints)

### Frontend (E2E)
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test:e2e --workspace=frontend
```
Covers:
- Login flow
- QR code generation & scanning
- Drawing canvas interaction
- WebSocket real-time updates
- Score display

---

## 🎮 User Stories

### Host
1. **Login** — Authenticate with username/password (JWT token)
2. **Create Session** — Set prompt, player count, round duration
3. **Share QR Code** — Players scan to join
4. **Monitor Drawing** — See all players' canvases in real-time
5. **Award Points** — Rank drawings (1st, 2nd, 3rd)
6. **Advance Rounds** — Move to next prompt when ready
7. **End Game** — Display final scores, leaderboard

### Player
1. **Join Session** — Scan QR code or enter session ID
2. **See Prompt** — View current drawing prompt
3. **Draw** — Sketch on black canvas (touch + mouse)
4. **Submit Drawing** — Ready for host to review
5. **View Scores** — See points awarded after host ranks

---

## 🔐 Security

- **Host Authentication** — Username/password with bcryptjs hashing
- **JWT Tokens** — Signed tokens for session authorization
- **WebSocket Auth** — Tokens validated on connection
- **CORS** — Configured for local dev + production origins

---

## 📱 PWA Features

- **Manifest** — App icon, colors, start URL
- **Service Worker** — Offline fallback, asset caching
- **Installable** — "Add to home screen" on mobile
- **Works Offline** — Cached assets available when disconnected

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Vite 5, TypeScript, Canvas API | SPA, real-time drawing |
| **Backend** | Fastify 4, Node.js 20 | API, WebSocket server |
| **Real-time** | WebSocket | Live drawing sync, score updates |
| **Auth** | JWT + bcryptjs | Host authentication |
| **Testing** | Vitest, Playwright | Unit + E2E tests |
| **Build** | npm workspaces | Monorepo management |

---

## 📝 License

Private project. All rights reserved.

---

## ❓ FAQ

**Q: Can I host this on the internet?**  
A: Yes! See [DEPLOYMENT.md](DEPLOYMENT.md) for Docker, Railway, Render, or Node.js hosting options.

**Q: What if the host loses connection?**  
A: Players remain connected; drawings are preserved. Host can reconnect and resume.

**Q: How many players can play at once?**  
A: Limited by backend capacity. Default: 50 concurrent connections per session (tunable).

**Q: Is there a database?**  
A: No persistent database. Session state is in-memory. For production, add PostgreSQL (see ARCHITECTURE.md).

---

## 📞 Support

For questions or issues:
1. Check [specs/001-pwa-drawing-game/quickstart.md](IArdoise/specs/001-pwa-drawing-game/quickstart.md) for validation scenarios
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
3. Check backend/frontend `README.md` files for workspace-specific docs
