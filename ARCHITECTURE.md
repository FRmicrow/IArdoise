# Architecture — IArdoise Drawing Game PWA

Comprehensive technical documentation of IArdoise's system design, data flow, API, and WebSocket events.

---

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Player)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Frontend SPA (Vite + TypeScript)                           │ │
│  │                                                             │ │
│  │  - Canvas API (drawing surface)                            │ │
│  │  - PWA manifest (installable)                              │ │
│  │  - Service Worker (offline support)                        │ │
│  │  - WebSocket client (real-time sync)                       │ │
│  │  - JWT token storage (auth)                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ↕ WSS / HTTPS                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Fastify Backend Server                       │
│                       (Node.js 20)                              │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ HTTP API Layer   │  │ WebSocket Layer  │  │ Session Mgmt │  │
│  │                  │  │                  │  │              │  │
│  │ POST /auth/login │  │ connect          │  │ sessions[]   │  │
│  │ GET /api/session │  │ message (draw)   │  │ connections  │  │
│  │ PATCH /api/round │  │ next-round       │  │ state        │  │
│  │ POST /api/score  │  │ disconnect       │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│           ↕                    ↕                      ↕          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │          In-Memory State                                   │ │
│  │  - SessionManager (sessions, players, drawings, scores)    │ │
│  │  - JWT validation (auth tokens)                            │ │
│  │  - Dedup logic (name collision avoidance)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Future: Add PostgreSQL for persistence]                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
backend/
├── src/
│   ├── index.ts              # Fastify server setup, listen
│   ├── auth.ts               # JWT signing, password validation
│   ├── session.ts            # SessionManager class
│   ├── websocket.ts          # WebSocket event handlers
│   ├── routes/
│   │   ├── auth.ts           # POST /auth/login
│   │   ├── session.ts        # GET/PATCH /api/session/*
│   │   └── score.ts          # POST /api/score
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces (Session, Player, Drawing)
│   └── utils/
│       └── dedup.ts          # dedupName utility (collision detection)
├── __tests__/
│   ├── session.test.ts       # SessionManager unit tests
│   ├── auth.test.ts          # JWT auth tests
│   ├── api.test.ts           # HTTP API integration tests
│   └── websocket.test.ts     # WebSocket event handler tests
├── dist/                     # Compiled JavaScript (build output)
└── package.json

frontend/
├── src/
│   ├── main.ts               # App entry point
│   ├── index.html            # PWA manifest, meta tags
│   ├── style.css             # Global styles, CSS tokens
│   ├── manifest.json         # PWA manifest (icon, colors, start_url)
│   ├── pages/
│   │   ├── login.ts          # Host login form
│   │   ├── host-dashboard.ts # Host session view (all players)
│   │   └── player-canvas.ts  # Player drawing interface
│   ├── components/
│   │   ├── canvas.ts         # Canvas drawing component
│   │   ├── qr-code.ts        # QR code display (host)
│   │   └── score-board.ts    # Score display (player)
│   ├── lib/
│   │   ├── ws-client.ts      # WebSocket wrapper
│   │   ├── drawing.ts        # Canvas drawing API
│   │   ├── auth.ts           # JWT token management
│   │   └── qr.ts             # QR code generation
│   └── service-worker.ts     # PWA offline support
├── dist/                     # Built frontend (Vite output)
├── package.json
└── vite.config.ts
```

---

## 🔐 Authentication Flow

### 1. Host Login (JWT-based)

```
┌──────────────────────────────┐
│  Host Browser                │
│  1. Click "Login"            │
│  2. Enter username/password  │
└──────────────┬───────────────┘
               │ POST /auth/login
               ├─────────────────────────┐
               │  { username, password } │
               └─────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│  Backend (auth.ts)                           │
│  1. Hash password with bcryptjs              │
│  2. Compare with HOST_PASSWORD_HASH from env │
│  3. If match: sign JWT token                 │
│  4. JWT_SECRET from env + exp: 24h           │
└──────────────┬───────────────────────────────┘
               │ 200 OK
               ├──────────────────────────┐
               │  { token: "eyJhbGc..." } │
               └──────────────────────────┘
               ↓
┌──────────────────────────────┐
│  Host Browser                │
│  1. Store token in localStorage
│  2. Add to Authorization header
│  3. Can now create sessions
└──────────────────────────────┘
```

### 2. Token Validation

Every API request includes:
```http
Authorization: Bearer eyJhbGc...
```

Backend decodes JWT:
- Verifies signature (using JWT_SECRET)
- Checks expiration (24 hours)
- Extracts claims (minimal: username)
- Rejects if invalid or expired

---

## 🎮 Session & Drawing Flow

### Phase 1: Session Creation (Host)

```
Host: POST /api/session
      {
        "prompt": "Draw a cat",
        "maxPlayers": 4,
        "roundDuration": 60  # seconds
      }

Backend:
  1. Generate sessionId (UUID)
  2. Create Session object:
     {
       sessionId: "550e8400-...",
       prompt: "Draw a cat",
       maxPlayers: 4,
       players: [],        # Filled on join
       drawings: [],       # Filled on draw
       scores: {},         # Set by host on award
       status: "active",
       createdAt: now
     }
  3. Store in SessionManager.sessions[sessionId]
  4. Return: { sessionId, qrCode: "data:image/png;..." }

Host: Display QR code to players → Players scan
```

### Phase 2: Player Joins (Via QR Code or Session ID)

```
Player: POST /api/session/{sessionId}/join
        {
          "name": "Alice"  # Host checks for collisions
        }

Backend:
  1. Look up session by sessionId
  2. Check name collision (using dedupName utility)
  3. If collision, return deduplicated name (e.g., "Alice #2")
  4. Create Player object:
     {
       playerId: UUID,
       sessionId,
       name: "Alice",
       joinedAt: now,
       drawing: null,      # Null until drawn
       score: 0
     }
  5. Add to session.players[]
  6. Broadcast via WebSocket: "player-joined" → all connected clients
  7. Return: { playerId, sessionId, token: "player-auth-token" }

Player:
  1. Store token locally
  2. Connect to WebSocket with token
```

### Phase 3: Drawing (WebSocket)

```
Player Canvas:
  1. Draw on Canvas API (mouse/touch)
  2. Every 100ms: emit "draw" message via WebSocket

WebSocket Message (Binary):
  {
    type: "draw",
    playerId: "...",
    canvasData: ImageData  # Uint8ClampedArray of pixels
  }

Backend (ws.ts):
  1. Receive draw message
  2. Validate playerId & token
  3. Store in session.drawings[playerId]
  4. Broadcast to all other players: "player-drew"

Other Players:
  1. Receive "player-drew" event
  2. Render drawing on shared canvas view
  3. See real-time visual sync
```

### Phase 4: Host Awards Points (Scoring)

```
Host Dashboard:
  1. View all players' final drawings
  2. Rank: 1st place (10 pts), 2nd (5 pts), 3rd (2 pts)
  3. Click "Award Points" button

Frontend:
  PATCH /api/session/{sessionId}/score
  {
    "playerId": "...",
    "points": 10
  }

Backend:
  1. Validate session & player
  2. Update session.scores[playerId] += points
  3. Broadcast to all: "score-updated" → show on leaderboard

Host:
  4. Click "Next Round" button
  PATCH /api/session/{sessionId}/round
  { "nextPrompt": "Draw a pizza" }

Backend:
  1. Clear drawings: session.drawings = {}
  2. Update prompt
  3. Broadcast "round-started" → players see new prompt
  4. Ready for Phase 3 again
```

### Phase 5: End Game

```
Host: POST /api/session/{sessionId}/end

Backend:
  1. Set session.status = "ended"
  2. Broadcast "game-ended" + final scores
  3. Optionally persist to database

Players:
  1. Display final leaderboard
  2. Show "Game Over"
```

---

## 🔌 WebSocket Events Reference

### Server → Client Events

| Event | Payload | When |
|-------|---------|------|
| `player-joined` | `{ playerId, name }` | New player joins session |
| `player-drew` | `{ playerId, canvasData }` | Player submits drawing |
| `score-updated` | `{ playerId, score, rank }` | Host awards points |
| `round-started` | `{ prompt, roundDuration }` | New round begins |
| `player-left` | `{ playerId, name }` | Player disconnects |
| `game-ended` | `{ finalScores, leaderboard }` | Host ends session |

### Client → Server Events

| Event | Payload | Who |
|-------|---------|-----|
| `draw` | `{ playerId, canvasData }` | Player (canvas update) |
| `ready` | `{ playerId }` | Player (drawing submitted) |
| `chat` (future) | `{ playerId, message }` | Player/Host (social) |

---

## 📊 Data Models

### Session
```typescript
interface Session {
  sessionId: string;              // UUID
  hostId: string;                 // Host username (from JWT)
  prompt: string;                 // "Draw a cat"
  maxPlayers: number;             // 4, 8, etc.
  roundDuration: number;          // Seconds
  players: Player[];              // Active players
  drawings: Map<string, Drawing>; // { playerId → canvasData }
  scores: Map<string, number>;    // { playerId → total_points }
  status: "active" | "ended";
  createdAt: Date;
  updatedAt: Date;
}

interface Player {
  playerId: string;               // UUID
  sessionId: string;
  name: string;                   // Deduplicated
  joinedAt: Date;
  isHost: boolean;
  drawing: ImageData | null;      // Canvas pixel data
  score: number;                  // Total points so far
}

interface Drawing {
  playerId: string;
  imageData: ImageData;           // Uint8ClampedArray
  submittedAt: Date;
}
```

### JWT Token Payload
```typescript
interface JWTPayload {
  username: string;               // "admin"
  exp: number;                    // Expiration timestamp (24h)
  iat: number;                    // Issued at
}
```

---

## 🛣️ HTTP Routes

### Authentication

```
POST /auth/login
  Request:  { username, password }
  Response: { token }
  Error:    401 Unauthorized
```

### Sessions

```
POST /api/session
  Auth:     Bearer token
  Request:  { prompt, maxPlayers, roundDuration }
  Response: { sessionId, qrCode }
  
GET /api/session/{sessionId}
  Response: { session object }
  
PATCH /api/session/{sessionId}/round
  Auth:     Bearer token (host only)
  Request:  { nextPrompt }
  Response: { updated session }
  
PATCH /api/session/{sessionId}/score
  Auth:     Bearer token (host only)
  Request:  { playerId, points }
  Response: { scores }
  
POST /api/session/{sessionId}/end
  Auth:     Bearer token (host only)
  Response: { finalScores, leaderboard }
```

### Players

```
POST /api/session/{sessionId}/join
  Request:  { name }
  Response: { playerId, playerToken }
  
GET /api/session/{sessionId}/players
  Response: { players: [] }
```

### Health

```
GET /api/health
  Response: 200 OK
```

---

## 🔄 State Management

### Backend (SessionManager)

In-memory storage (no persistence yet):

```typescript
class SessionManager {
  private sessions: Map<string, Session>;
  private players: Map<string, Player>;
  
  createSession(host, prompt, maxPlayers) { ... }
  joinSession(sessionId, name) { ... }
  updateScore(sessionId, playerId, points) { ... }
  advanceRound(sessionId, nextPrompt) { ... }
  endSession(sessionId) { ... }
}
```

**Limitation**: Data lost on server restart. **Fix**: Add PostgreSQL for persistence.

### Frontend (Zustand/Context)

Store player state locally:
- Current session ID
- Player ID & name
- Auth token
- Drawing canvas state
- Score

```typescript
// Example (Zustand)
const useGameStore = create((set) => ({
  sessionId: null,
  playerId: null,
  token: null,
  drawing: null,
  score: 0,
  setSession: (s) => set(s),
  ...
}));
```

---

## 🎨 Frontend Architecture

### SPA Pages

1. **Login Page** (`pages/login.ts`)
   - Form: username + password
   - POST to `/auth/login`
   - Store JWT token
   - Redirect to host dashboard

2. **Host Dashboard** (`pages/host-dashboard.ts`)
   - Requires valid JWT
   - Create new session or join existing
   - View all players' drawings in real-time
   - Award points (1st, 2nd, 3rd place)
   - Advance rounds or end game

3. **Player Canvas** (`pages/player-canvas.ts`)
   - Display current prompt
   - Canvas element (600x400px)
   - Draw with mouse or touch
   - Submit button (ready)
   - View leaderboard (score updates)

### Canvas Component (`components/canvas.ts`)

```typescript
class DrawingCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  constructor(canvasElement) { ... }
  
  // Drawing tools
  draw(x, y, isDrawing) { ... }
  clear() { ... }
  undo() { ... }
  
  // Export
  exportAsImageData(): ImageData { ... }
  exportAsDataURL(): string { ... }
}
```

### WebSocket Client (`lib/ws-client.ts`)

```typescript
class GameWebSocket {
  private ws: WebSocket;
  
  connect(token, handlers) {
    this.ws = new WebSocket(`wss://host/ws?token=${token}`);
    this.ws.onmessage = (e) => handlers[e.data.type]?.(e.data);
  }
  
  sendDraw(canvasData) { ... }
  sendReady() { ... }
  disconnect() { ... }
}
```

### PWA Features

- **Manifest** (`manifest.json`): Icon, app name, colors, start_url
- **Service Worker** (`service-worker.ts`): Cache assets, offline fallback
- **Installable**: "Add to home screen" on mobile (Chrome, Safari iOS)
- **Offline Mode**: Cached pages load even without internet

---

## 🔒 Security

### Authentication & Authorization

1. **Host Login**: Username/password → bcryptjs hash validation → JWT token
2. **Token Storage**: localStorage (consider secure HttpOnly cookie in future)
3. **Token Validation**: Every API request checks JWT signature + expiration
4. **WebSocket Auth**: Player token validated on connection; all messages re-validated

### Data Protection

- **CORS**: Restricted to production domain (configurable)
- **WebSocket Origin**: Checked against allowed origins
- **Input Validation**: All user input sanitized before storage
- **HTTPS/WSS**: Required in production (Nginx reverse proxy)

### Privacy

- No user accounts (login is host-only)
- Session data not persisted (in-memory only, cleared on restart)
- Drawings are temporary (cleared between rounds, deleted on game end)
- No cookies, no tracking

---

## 🧪 Testing Strategy

### Backend (Vitest)

```bash
npm run test --workspace=backend
```

**Unit Tests** (`__tests__/session.test.ts`):
- SessionManager: create, join, draw, score, advance round
- dedupName: collision detection
- Auth: JWT signing, validation, expiration
- Sanitization: XSS prevention

**Integration Tests** (`__tests__/api.test.ts`):
- POST /auth/login
- POST /api/session (create)
- POST /api/session/{id}/join
- PATCH /api/session/{id}/score
- WebSocket: connect, draw, disconnect

### Frontend (Playwright E2E)

```bash
npm run test:e2e --workspace=frontend
```

**Scenarios**:
1. Host login → create session
2. Player join via QR code
3. Player draws on canvas
4. Host awards points
5. Score updates in real-time
6. Game ends → final leaderboard

---

## 🚀 Performance

### Frontend
- **Canvas Rendering**: 60 FPS (requestAnimationFrame)
- **WebSocket Throttling**: Draw events every 100ms (not per-pixel)
- **Asset Caching**: Service Worker caches /static/*, index.html
- **Bundle Size**: <150KB gzipped (Vite optimized)

### Backend
- **Connection Limit**: ~50 concurrent sessions per instance
- **Memory**: ~2MB per session (canvas data included)
- **Latency**: <50ms for draw sync (local network)

### Scaling (Future)
- **Horizontal**: Load balancer + multiple backend instances
- **Session Store**: Redis (replace in-memory)
- **Database**: PostgreSQL for persistence
- **CDN**: CloudFront/Cloudflare for static assets

---

## 📈 Future Improvements

### Short-term
- [ ] Password reset mechanism (email-based)
- [ ] Multiple host sessions simultaneously
- [ ] Undo/redo in canvas
- [ ] Chat between players
- [ ] Sound effects (drawing, scoring)

### Medium-term
- [ ] PostgreSQL for session persistence
- [ ] User accounts (not just host)
- [ ] Custom drawing tools (colors, brushes)
- [ ] Replay system (watch recorded drawings)
- [ ] Leaderboard (persistent player rankings)

### Long-term
- [ ] Mobile app (React Native)
- [ ] AI judging (ML model scores drawings)
- [ ] Multiplayer features (shared canvas)
- [ ] Monetization (premium features)

---

## 🛠️ Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start dev servers (backend + frontend)
npm run dev

# Run tests (backend)
npm run test --workspace=backend

# Run E2E tests (requires dev servers running)
npm run test:e2e --workspace=frontend
```

### Build & Deploy

```bash
# Build frontend SPA
npm run build --workspace=frontend

# Build backend (TypeScript → JavaScript)
npm run build --workspace=backend

# Start production server
npm start --workspace=backend
```

---

## 🔗 Related Documentation

- [README.md](README.md) — Quick start, features, tech stack
- [DEPLOYMENT.md](DEPLOYMENT.md) — Docker, Railway, Node.js hosting
- [specs/001-pwa-drawing-game/](IArdoise/specs/001-pwa-drawing-game/) — Feature specs, validation scenarios

---

## ❓ FAQ

**Q: Why in-memory storage instead of database?**  
A: Simpler MVP. For production, add PostgreSQL (sessions, audit logs, leaderboard).

**Q: Can multiple hosts create sessions?**  
A: Currently one host per login. Future: multi-tenant support.

**Q: How are drawings transmitted (binary vs. JSON)?**  
A: Binary (ImageData) over WebSocket for efficiency.

**Q: Is drawing saved after game ends?**  
A: No, cleared from memory. Future: add archival to database.

**Q: Can players edit after submitting?**  
A: No, submit-once design. Future: allow redraw until round ends.

---

## 📞 Questions?

See backend/README.md and frontend/README.md for workspace-specific details.
