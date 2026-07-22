/**
 * Unit tests: JWT auth (signToken / verifyToken)
 *
 * Covers:
 *   - signToken + verifyToken round-trip: payload survives encode/decode
 *   - verifyToken rejects an expired token
 *   - verifyToken rejects a token signed with a different secret
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';

// Set required env vars before importing config (which is eagerly evaluated)
beforeAll(() => {
  process.env['HOST_USERNAME'] = 'testuser';
  process.env['HOST_PASSWORD_HASH'] = '$2b$10$placeholder';
  process.env['JWT_SECRET'] = 'unit-test-jwt-secret-at-least-32-characters!!';
  process.env['PORT'] = '0';
});

describe('signToken / verifyToken', () => {
  it('round-trips the payload correctly', async () => {
    // Dynamic import after env vars are set
    const { signToken, verifyToken } = await import('../../src/auth/jwt.js');
    const token = await signToken({ role: 'host', username: 'alice' });
    expect(typeof token).toBe('string');

    const decoded = await verifyToken(token);
    expect(decoded.role).toBe('host');
    expect(decoded.username).toBe('alice');
  });

  it('rejects an expired token', async () => {
    const secret = new TextEncoder().encode(
      'unit-test-jwt-secret-at-least-32-characters!!'
    );

    // Sign a token that expired 1 second ago
    const expiredToken = await new SignJWT({ role: 'host', username: 'alice' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('-1s')
      .sign(secret);

    const { verifyToken } = await import('../../src/auth/jwt.js');
    await expect(verifyToken(expiredToken)).rejects.toThrow();
  });

  it('rejects a token signed with a different secret', async () => {
    const wrongSecret = new TextEncoder().encode(
      'completely-different-secret-at-least-32-chars!!'
    );

    const wrongToken = await new SignJWT({ role: 'host', username: 'alice' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const { verifyToken } = await import('../../src/auth/jwt.js');
    await expect(verifyToken(wrongToken)).rejects.toThrow();
  });
});
