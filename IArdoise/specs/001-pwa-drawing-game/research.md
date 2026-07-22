# Research: PWA Drawing Game

**Branch**: `001-pwa-drawing-game` | **Date**: 2025-07-18

This document resolves all technical unknowns identified in the Technical Context and informs Phase 1 design decisions.

---

## 1. Real-Time Transport: WebSocket vs. SSE vs. Long-Polling

**Decision**: WebSocket (via the `ws` npm package, exposed through Fastify's `@fastify/websocket` plugin)

**Rationale**:
- Bidirectional: server needs to push events to clients (prompt broadcast, player list, score updates, game state transitions) **and** clients need to push events to the server (player join, name entry). SSE is server→client only and would require a separate HTTP POST channel for client→server events, adding complexity.
- `ws` is the most mature, dependency-light WebSocket library for Node.js. `@fastify/websocket` integrates it cleanly with the existing Fastify HTTP server, sharing the same port and TLS termination.
- For ≤20 simultaneous connections, raw WebSocket has negligible overhead vs. Socket.IO while avoiding Socket.IO's fallback negotiation, additional bundle size (~40 KB minified), and version coupling.

**Alternatives considered**:
- **Socket.IO**: Would simplify room management but adds ~40 KB to the client bundle and a non-standard protocol. Overkill for 20 players.
- **Server-Sent Events**: Unidirectional; requires a separate HTTP endpoint for client→server messages. More complex.
- **WebRTC DataChannels**: Peer-to-peer complexity is unjustified for a server-mediated game.

---

## 2. Frontend Framework Choice

**Decision**: Vanilla TypeScript + Vite 5 (no UI framework)

**Rationale**:
- The app has a small number of distinct screens (join, lobby-player, game-player, host-lobby, host-game, scoreboard) that are simple enough to implement as individual TypeScript modules with direct DOM manipulation.
- Eliminating React/Vue/Svelte removes ~40–120 KB from the mobile bundle and avoids framework-specific PWA integration complexity.
- HTML5 Canvas drawing cannot be abstracted usefully by a virtual DOM — direct imperative Canvas API access is the natural choice anyway.
- Vite 5 provides fast dev HMR and the official `vite-plugin-pwa` (built on Workbox) for zero-config service worker + manifest generation.

**Alternatives considered**:
- **React + Vite**: Familiar but adds bundle weight and an unnecessary abstraction layer over Canvas. Canvas drawing code would live outside React's rendering cycle regardless.
- **Svelte**: Lighter than React, but introduces a compiler dependency and framework-specific patterns for a project where direct DOM access is already required.
- **Preact**: Near-React API at ~3 KB — viable, but the Canvas page would still bypass Preact's virtual DOM.

---

## 3. Authentication Strategy

**Decision**: Single host account with credentials stored in environment variables; JWT issued on successful login; Bearer token validated on protected HTTP routes and the WebSocket upgrade handshake.

**Rationale**:
- The spec defines a single host per deployment. A dedicated users table/database is unnecessary complexity for v1.
- `bcryptjs` hashes the password at startup (or the hash is pre-computed and stored in `.env`); `jose` issues a short-lived JWT (1 h expiry) that the frontend stores in `sessionStorage`.
- JWT validates the WebSocket upgrade via a `?token=...` query param or an initial `AUTH` message, avoiding cookie/CORS issues across origins.

**Alternatives considered**:
- **HTTP Basic Auth**: No session token — every WebSocket connection would need to re-authenticate. Awkward for SPA navigation.
- **Cookie-based sessions**: Requires `SameSite`/`Secure` cookie handling; more complex when the SPA is served from the same origin (though workable). JWT is simpler for this scope.
- **No auth**: The spec explicitly requires authentication (FR-001). Not acceptable.

---

## 4. QR Code Generation

**Decision**: Server generates the QR code as a data URL using the `qrcode` npm package and returns it to the host frontend; the frontend renders it in an `<img>` tag or `<canvas>`.

**Rationale**:
- Server-side generation ensures the encoded URL is canonical (uses the server's public hostname). The host frontend does not need to know its own public URL.
- `qrcode` is the de-facto standard package, zero native dependencies, supports PNG data URLs and SVG strings.
- The QR code encodes `https://<HOST>/join/<SESSION_ID>` — a simple, scannable deep link.

**Alternatives considered**:
- **Client-side QR generation**: The host frontend would need to know the server's public base URL, which can be injected at build time but adds deployment configuration friction.
- **Third-party QR service**: Unnecessary external dependency; adds latency and a failure point.

---

## 5. Session and State Management (In-Memory)

**Decision**: `SessionManager` singleton (TypeScript class with `Map` storage) on the backend process. No Redis, no database.

**Rationale**:
- Sessions are inherently short-lived (one play session = one evening). Persistence across server restarts is not required for v1.
- A single Node.js process can comfortably hold 20-player session state in memory.
- Eliminates the need to provision, connect, and maintain any external data store.

**State machine** (per session):
```
LOBBY → ACTIVE → ENDED
```
Transitions triggered by host actions (`start_game`, `end_game`).

**Alternatives considered**:
- **Redis**: Enables horizontal scaling and persistence. Overkill for v1 single-host deployment.
- **SQLite file**: Durable but adds query complexity and a native module dependency.

---

## 6. PWA Requirements

**Decision**: `vite-plugin-pwa` (Workbox-based) configured for "network-first" caching of the SPA shell; `manifest.json` defines app name, icons, `display: standalone`, `start_url: /`.

**Rationale**:
- `vite-plugin-pwa` generates the service worker and manifest automatically from a Vite config object. No hand-written service worker required.
- "Network-first" strategy ensures players always get the latest version when online, while the service worker allows the app shell to load on reconnect.
- Drawing is local (Canvas) and doesn't require offline write-back to the server.
- iOS Safari 15+ supports `Add to Home Screen` for PWA install; Android Chrome auto-triggers the install prompt when manifest + service worker are present.

**Alternatives considered**:
- **Manual service worker**: More control but much more code to maintain.
- **Native app (Capacitor/Cordova)**: Contradicts the spec's PWA-first requirement (FR-013).

---

## 7. Drawing Canvas Implementation

**Decision**: HTML5 `<canvas>` element with `pointer events` API (handles both touch and mouse), drawn with `requestAnimationFrame` for 60 fps target on desktop, accepting graceful degradation to ≥30 fps on mobile.

**Key implementation notes**:
- Use `PointerEvent` (unified API for mouse, touch, and stylus) rather than separate `TouchEvent`/`MouseEvent` handlers.
- Canvas background: CSS `background: black` + `fillRect(0,0,w,h)` initialisation.
- Stroke colour: white (`#FFFFFF`) default; optional colour picker is a v2 feature.
- Canvas resize: listen to `ResizeObserver` on the container; re-draw last stroke array on resize (strokes kept as in-memory point arrays — never sent to server).
- Clear canvas: on `next_question` WS event, call `clearRect` and re-fill black.

**Alternatives considered**:
- **SVG drawing**: More DOM nodes, worse performance for freehand strokes.
- **Fabric.js / Konva**: Large libraries (~200 KB) for a feature that needs only freehand stroke capture. Not justified.

---

## 8. Deployment Topology

**Decision**: Single Node.js process serves both the REST/WS API and the Vite-built static frontend. One Docker container or bare Node.js on any VPS/PaaS.

**Rationale**:
- Avoids CORS configuration (same origin for API and frontend).
- QR code URL is the server's own public URL — no second origin to manage.
- Single `npm run build && npm start` deployment flow.

**Alternatives considered**:
- **Separate frontend CDN + backend API**: Introduces CORS and URL configuration complexity with no benefit at this scale.
- **Serverless**: WebSocket connections require persistent processes; serverless functions are incompatible with the WS session model.

---

## Summary Decision Table

| Topic | Decision | Key Reason |
|-------|----------|-----------|
| Real-time transport | WebSocket (`ws` + `@fastify/websocket`) | Bidirectional, lightweight, sufficient for 20 players |
| Frontend stack | Vanilla TypeScript + Vite 5 | Minimal bundle, direct Canvas API, no framework overhead |
| Auth | Env-based credentials + JWT (HS256, 1 h) | Single host, no user DB needed |
| QR generation | `qrcode` npm (server-side) | Canonical URL, zero external dependency |
| State | In-memory `SessionManager` | Ephemeral sessions, no DB overhead |
| PWA | `vite-plugin-pwa` (Workbox, network-first) | Zero-config manifest + SW generation |
| Canvas | HTML5 Canvas + PointerEvent | Native, performant, no library needed |
| Deployment | Single Node process (API + static files) | No CORS, simple deployment |
