/**
 * Integration tests: HTTP API + WebSocket contracts
 *
 * HTTP coverage:
 *   - POST /api/auth/login (happy path + invalid credentials)
 *   - POST /api/sessions (happy path, optional initialPhrase, duplicate session)
 *   - GET /api/sessions/:sessionId/status (lobby / 404)
 *   - POST /api/sessions/:sessionId/players (happy path + registration lock)
 *
 * WebSocket coverage:
 *   - SESSION_STATE / GAME_STARTED expose currentPhrase (not currentPrompt);
 *     player entries carry no score
 *   - START_GAME requires >=1 player and broadcasts GAME_STARTED to all clients
 *   - SET_PROMPT rejects blank/whitespace text and rejects when session is not active
 *   - END_GAME sets status to 'ended', broadcasts GAME_ENDED with no scoreboard,
 *     a subsequent SET_PROMPT is rejected, and joining after end returns 409
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'net';

// ── Test credentials ──────────────────────────────────────────────────────────
const TEST_USERNAME = 'testhost';
const TEST_PASSWORD = 'secret123';
let TEST_PASSWORD_HASH: string;
const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-chars-long!!';

// ── Build test app (HTTP routes + WS wiring, no static file serving) ─────────
async function buildTestApp(): Promise<FastifyInstance> {
  // Set env vars before any config module is imported
  process.env['HOST_USERNAME'] = TEST_USERNAME;
  process.env['HOST_PASSWORD_HASH'] = TEST_PASSWORD_HASH;
  process.env['JWT_SECRET'] = TEST_JWT_SECRET;
  process.env['PORT'] = '0';

  const fastify = Fastify({ logger: false });
  await fastify.register(fastifyWebsocket);

  const { loginRoute } = await import('../../src/auth/loginRoute.js');
  const { sessionRoutes } = await import('../../src/session/sessionRoutes.js');
  const { playerRoutes } = await import('../../src/session/playerRoutes.js');
  const { WsRouter } = await import('../../src/ws/WsRouter.js');
  const { register, deregister } = await import('../../src/ws/connectionRegistry.js');
  const { registerAuthHandler } = await import('../../src/ws/handlers/authHandler.js');
  const { registerConnectionHandler } = await import('../../src/ws/handlers/connectionHandler.js');
  const { registerPromptHandler } = await import('../../src/ws/handlers/promptHandler.js');
  const { registerGameHandler } = await import('../../src/ws/handlers/gameHandler.js');
  const { registerHostPlayerHandler } = await import('../../src/ws/handlers/hostPlayerHandler.js');
  const { registerHeartbeatHandler } = await import('../../src/ws/handlers/heartbeatHandler.js');

  await fastify.register(loginRoute, { prefix: '/api/auth' });
  await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
  await fastify.register(playerRoutes, { prefix: '/api/sessions' });

  const wsRouter = new WsRouter();
  registerAuthHandler(wsRouter);
  registerConnectionHandler(wsRouter);
  registerPromptHandler(wsRouter);
  registerGameHandler(wsRouter);
  registerHostPlayerHandler(wsRouter);
  registerHeartbeatHandler(wsRouter);

  fastify.get('/ws', { websocket: true }, (socket) => {
    const wsClientId = randomUUID();
    register(wsClientId, socket);

    socket.on('message', (raw: Buffer) => {
      wsRouter.handle(socket, wsClientId, raw.toString());
    });

    socket.on('close', () => {
      wsRouter.handle(socket, wsClientId, JSON.stringify({ type: '__DISCONNECT__', payload: {} }));
      deregister(wsClientId);
    });
  });

  await fastify.ready();
  return fastify;
}

// ── WS test helpers ────────────────────────────────────────────────────────────
function wsUrl(app: FastifyInstance): string {
  const address = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}/ws`;
}

function connectWs(app: FastifyInstance): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl(app));
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function send(socket: WebSocket, type: string, payload: unknown): void {
  socket.send(JSON.stringify({ type, payload }));
}

type WsMessage = { type: string; payload: Record<string, unknown> };

function waitFor(socket: WebSocket, type: string, timeoutMs = 3000): Promise<WsMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener('message', onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeoutMs);

    function onMessage(raw: Buffer): void {
      const msg = JSON.parse(raw.toString()) as WsMessage;
      if (msg.type === type) {
        clearTimeout(timer);
        socket.removeListener('message', onMessage);
        resolve(msg);
      }
    }

    socket.on('message', onMessage);
  });
}

async function mintHostToken(username: string): Promise<string> {
  const { signToken } = await import('../../src/auth/jwt.js');
  return signToken({ role: 'host', username });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('HTTP API integration', () => {
  let app: FastifyInstance;
  let authToken: string;
  let sessionId: string;

  beforeAll(async () => {
    TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 10);
    app = await buildTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns 200 with a token on valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ token: string }>();
      expect(typeof body.token).toBe('string');
      authToken = body.token;
    });

    it('returns 401 on invalid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: TEST_USERNAME, password: 'wrong' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── Sessions ─────────────────────────────────────────────────────────────
  describe('POST /api/sessions', () => {
    it('returns 201 with sessionId and joinUrl for authenticated host', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ sessionId: string; joinUrl: string }>();
      expect(typeof body.sessionId).toBe('string');
      expect(typeof body.joinUrl).toBe('string');
      sessionId = body.sessionId;
    });

    it('returns 409 when host already has an active session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(409);
    });

    it('accepts an optional initialPhrase and stores it as currentPhrase', async () => {
      const token = await mintHostToken('http-initial-phrase-host');
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { initialPhrase: '  Dessine un chat  ' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ sessionId: string }>();

      const { SessionManager } = await import('../../src/session/SessionManager.js');
      const session = SessionManager.getInstance().getSession(body.sessionId);
      expect(session?.currentPhrase).toBe('Dessine un chat');
    });
  });

  // ── Session status ───────────────────────────────────────────────────────
  describe('GET /api/sessions/:sessionId/status', () => {
    it('returns {status: "lobby"} for an existing session, unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/status`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'lobby' });
    });

    it('returns 404 for an unknown session id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/does-not-exist/status',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── Players — registration lock ─────────────────────────────────────────
  describe('POST /api/sessions/:sessionId/players', () => {
    it('returns 201 with playerId and name when session is in lobby', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/players`,
        payload: { name: 'Alice' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ playerId: string; name: string }>();
      expect(body.name).toBe('Alice');
      expect(typeof body.playerId).toBe('string');
    });

    it('stores a duplicate nickname as-is, with no " 2" suffix', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/players`,
        payload: { name: 'Alice' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ name: string }>();
      expect(body.name).toBe('Alice');
    });

    it('returns 400 when name is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/players`,
        payload: { name: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 409 with "Registration is closed" when session is not in lobby', async () => {
      // Manually set session status to "active" to simulate a started game
      const { SessionManager } = await import('../../src/session/SessionManager.js');
      const session = SessionManager.getInstance().getSession(sessionId);
      expect(session).toBeDefined();
      session!.status = 'active';

      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/players`,
        payload: { name: 'LateJoiner' },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json<{ error: string }>();
      expect(body.error).toBe('Registration is closed');

      // Restore lobby status so it doesn't leak into other tests
      session!.status = 'lobby';
    });
  });

  // ── WebSocket contracts ───────────────────────────────────────────────────
  describe('WebSocket', () => {
    it('SESSION_STATE and GAME_STARTED expose currentPhrase (not currentPrompt); player entries carry no score', async () => {
      const token = await mintHostToken('ws-fields-host');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { initialPhrase: 'Dessine un chien' },
      });
      const { sessionId: sid } = createRes.json<{ sessionId: string }>();

      const joinRes = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sid}/players`,
        payload: { name: 'Bob' },
      });
      const { playerId } = joinRes.json<{ playerId: string }>();

      const hostWs = await connectWs(app);
      send(hostWs, 'AUTH', { role: 'host', token, sessionId: sid });
      const hostState = await waitFor(hostWs, 'SESSION_STATE');

      expect(hostState.payload['currentPhrase']).toBe('Dessine un chien');
      expect(hostState.payload).not.toHaveProperty('currentPrompt');
      const players = hostState.payload['players'] as Array<Record<string, unknown>>;
      expect(players).toHaveLength(1);
      expect(players[0]).not.toHaveProperty('score');

      const playerWs = await connectWs(app);
      send(playerWs, 'AUTH', { role: 'player', playerId, sessionId: sid });
      await waitFor(playerWs, 'SESSION_STATE');

      send(hostWs, 'START_GAME', { sessionId: sid });
      const started = await waitFor(playerWs, 'GAME_STARTED');
      expect(started.payload['currentPhrase']).toBe('Dessine un chien');
      expect(started.payload).not.toHaveProperty('currentPrompt');

      hostWs.close();
      playerWs.close();
    });

    it('START_GAME requires >=1 player and broadcasts GAME_STARTED to every connected client', async () => {
      const token = await mintHostToken('ws-start-guard-host');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: `Bearer ${token}` },
      });
      const { sessionId: sid } = createRes.json<{ sessionId: string }>();

      const hostWs = await connectWs(app);
      send(hostWs, 'AUTH', { role: 'host', token, sessionId: sid });
      await waitFor(hostWs, 'SESSION_STATE');

      // No players yet — START_GAME must be rejected
      send(hostWs, 'START_GAME', { sessionId: sid });
      const err = await waitFor(hostWs, 'ERROR');
      expect(err.payload['code']).toBe('INVALID_STATE');

      // Add a player and connect them
      const joinRes = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sid}/players`,
        payload: { name: 'Carla' },
      });
      const { playerId } = joinRes.json<{ playerId: string }>();
      const playerWs = await connectWs(app);
      send(playerWs, 'AUTH', { role: 'player', playerId, sessionId: sid });
      await waitFor(playerWs, 'SESSION_STATE');

      // Attach both listeners before sending — the host and player broadcasts
      // arrive back-to-back, so waiting on them sequentially would race.
      const hostStarted = waitFor(hostWs, 'GAME_STARTED');
      const playerStarted = waitFor(playerWs, 'GAME_STARTED');
      send(hostWs, 'START_GAME', { sessionId: sid });
      await Promise.all([hostStarted, playerStarted]);

      hostWs.close();
      playerWs.close();
    });

    it('SET_PROMPT rejects blank text and rejects when the session is not active', async () => {
      const token = await mintHostToken('ws-prompt-guard-host');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { initialPhrase: 'Phrase initiale' },
      });
      const { sessionId: sid } = createRes.json<{ sessionId: string }>();

      const joinRes = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sid}/players`,
        payload: { name: 'Dana' },
      });
      const { playerId } = joinRes.json<{ playerId: string }>();

      const hostWs = await connectWs(app);
      send(hostWs, 'AUTH', { role: 'host', token, sessionId: sid });
      await waitFor(hostWs, 'SESSION_STATE');

      // Session is still 'lobby' — SET_PROMPT must be rejected
      send(hostWs, 'SET_PROMPT', { sessionId: sid, text: 'Nouvelle phrase' });
      const lobbyErr = await waitFor(hostWs, 'ERROR');
      expect(lobbyErr.payload['code']).toBe('INVALID_STATE');

      const playerWs = await connectWs(app);
      send(playerWs, 'AUTH', { role: 'player', playerId, sessionId: sid });
      await waitFor(playerWs, 'SESSION_STATE');

      send(hostWs, 'START_GAME', { sessionId: sid });
      await waitFor(hostWs, 'GAME_STARTED');

      // Blank/whitespace-only text rejected, currentPhrase left unchanged
      send(hostWs, 'SET_PROMPT', { sessionId: sid, text: '   ' });
      const blankErr = await waitFor(hostWs, 'ERROR');
      expect(blankErr.payload['code']).toBe('VALIDATION_ERROR');

      const { SessionManager } = await import('../../src/session/SessionManager.js');
      const session = SessionManager.getInstance().getSession(sid);
      expect(session?.currentPhrase).toBe('Phrase initiale');

      // Valid text is accepted and broadcast
      send(hostWs, 'SET_PROMPT', { sessionId: sid, text: 'Phrase suivante' });
      const updated = await waitFor(playerWs, 'PROMPT_UPDATED');
      expect(updated.payload['text']).toBe('Phrase suivante');

      hostWs.close();
      playerWs.close();
    });

    it('END_GAME sets status to ended, broadcasts GAME_ENDED with no scoreboard, and blocks further prompts/joins', async () => {
      const token = await mintHostToken('ws-end-game-host');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { initialPhrase: 'Phrase de depart' },
      });
      const { sessionId: sid } = createRes.json<{ sessionId: string }>();

      const joinRes = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sid}/players`,
        payload: { name: 'Eve' },
      });
      const { playerId } = joinRes.json<{ playerId: string }>();

      const hostWs = await connectWs(app);
      send(hostWs, 'AUTH', { role: 'host', token, sessionId: sid });
      await waitFor(hostWs, 'SESSION_STATE');

      const playerWs = await connectWs(app);
      send(playerWs, 'AUTH', { role: 'player', playerId, sessionId: sid });
      await waitFor(playerWs, 'SESSION_STATE');

      const hostStarted = waitFor(hostWs, 'GAME_STARTED');
      const playerStarted = waitFor(playerWs, 'GAME_STARTED');
      send(hostWs, 'START_GAME', { sessionId: sid });
      await Promise.all([hostStarted, playerStarted]);

      const hostEndedPromise = waitFor(hostWs, 'GAME_ENDED');
      const playerEndedPromise = waitFor(playerWs, 'GAME_ENDED');
      send(hostWs, 'END_GAME', { sessionId: sid });
      const [hostEnded, playerEnded] = await Promise.all([hostEndedPromise, playerEndedPromise]);
      expect(hostEnded.payload).toEqual({});
      expect(playerEnded.payload).toEqual({});
      expect(hostEnded.payload).not.toHaveProperty('scoreboard');

      const { SessionManager } = await import('../../src/session/SessionManager.js');
      expect(SessionManager.getInstance().getSession(sid)?.status).toBe('ended');

      // Further SET_PROMPT is rejected
      send(hostWs, 'SET_PROMPT', { sessionId: sid, text: 'Trop tard' });
      const rejected = await waitFor(hostWs, 'ERROR');
      expect(rejected.payload['code']).toBe('INVALID_STATE');

      // New joins are rejected
      const lateJoinRes = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sid}/players`,
        payload: { name: 'LateJoiner' },
      });
      expect(lateJoinRes.statusCode).toBe(409);

      hostWs.close();
      playerWs.close();
    });
  });

  // ── Heartbeat contract ───────────────────────────────────────────────────
  describe('Heartbeat (PING/PONG)', () => {
    it('replies PONG to PING, even before AUTH has been sent on that connection', async () => {
      const socket = await connectWs(app);

      send(socket, 'PING', {});
      const pong = await waitFor(socket, 'PONG');
      expect(pong.payload).toEqual({});

      socket.close();
    });
  });
});
