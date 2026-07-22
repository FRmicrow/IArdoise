/**
 * Integration tests: HTTP API
 *
 * Covers:
 *   - POST /api/auth/login (happy path + invalid credentials)
 *   - POST /api/sessions (happy path + duplicate session)
 *   - POST /api/sessions/:id/players (happy path + registration lock)
 *
 * T052 verification: POST /api/sessions/:id/players returns 409 when status !== "lobby"
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

// ── Test credentials ──────────────────────────────────────────────────────────
const TEST_USERNAME = 'testhost';
const TEST_PASSWORD = 'secret123';
let TEST_PASSWORD_HASH: string;
const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-chars-long!!';

// ── Build test app ────────────────────────────────────────────────────────────
async function buildTestApp(): Promise<FastifyInstance> {
  // Set env vars before any config module is imported
  process.env['HOST_USERNAME'] = TEST_USERNAME;
  process.env['HOST_PASSWORD_HASH'] = TEST_PASSWORD_HASH;
  process.env['JWT_SECRET'] = TEST_JWT_SECRET;
  process.env['PORT'] = '0';

  const fastify = Fastify({ logger: false });

  const { loginRoute } = await import('../../src/auth/loginRoute.js');
  const { sessionRoutes } = await import('../../src/session/sessionRoutes.js');
  const { playerRoutes } = await import('../../src/session/playerRoutes.js');

  await fastify.register(loginRoute, { prefix: '/api/auth' });
  await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
  await fastify.register(playerRoutes, { prefix: '/api/sessions' });

  await fastify.ready();
  return fastify;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('HTTP API integration', () => {
  let app: FastifyInstance;
  let authToken: string;
  let sessionId: string;

  beforeAll(async () => {
    TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 10);
    app = await buildTestApp();
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
  });

  // ── Players — T052 registration lock ─────────────────────────────────────
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

    it('returns 400 when name is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/players`,
        payload: { name: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('T052 — returns 409 with "Registration is closed" when session is not in lobby', async () => {
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
    });
  });
});
