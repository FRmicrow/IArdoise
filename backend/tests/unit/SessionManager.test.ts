/**
 * Unit tests: SessionManager
 *
 * Covers:
 *   - createSession: creates a session, sets initial state
 *   - createSession: accepts an optional initialPhrase, trims it
 *   - createSession: enforces single-session-per-host constraint (throws on duplicate)
 *   - addPlayer: adds a player to a session
 *   - addPlayer: stores duplicate names as-is (no dedup suffix), no score field
 *   - addPlayer: throws on unknown sessionId
 *   - removeSession: removes session and frees host slot
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../../src/session/SessionManager.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    // Reset singleton state between tests by accessing the private field via type cast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (SessionManager as any).instance = undefined;
    manager = SessionManager.getInstance();
  });

  // ── createSession ───────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('creates a session with correct initial state', () => {
      const session = manager.createSession('host1', 'http://localhost:3000');
      expect(session.status).toBe('lobby');
      expect(session.currentPhrase).toBe('');
      expect(session.roundIndex).toBe(0);
      expect(session.players.size).toBe(0);
      expect(session.phrases).toEqual([]);
      expect(session.joinUrl).toMatch(/\/join\//);
    });

    it('sets currentPhrase from a trimmed initialPhrase when provided', () => {
      const session = manager.createSession('host1b', 'http://localhost:3000', '  Draw a cat  ');
      expect(session.currentPhrase).toBe('Draw a cat');
    });

    it('leaves currentPhrase empty when initialPhrase is omitted', () => {
      const session = manager.createSession('host1c', 'http://localhost:3000');
      expect(session.currentPhrase).toBe('');
    });

    it('returns the session via getSession using the returned id', () => {
      const session = manager.createSession('host2', 'http://localhost:3000');
      expect(manager.getSession(session.id)).toBe(session);
    });

    it('throws when the same host already has an active session', () => {
      manager.createSession('sameHost', 'http://localhost:3000');
      expect(() => manager.createSession('sameHost', 'http://localhost:3000')).toThrow();
    });

    it('allows a second session after the first is removed', () => {
      const s1 = manager.createSession('host3', 'http://localhost:3000');
      manager.removeSession(s1.id);
      expect(() => manager.createSession('host3', 'http://localhost:3000')).not.toThrow();
    });

    it('allows a second session once the first has ended (host is not stuck after ending a game)', () => {
      const s1 = manager.createSession('host3b', 'http://localhost:3000');
      s1.status = 'ended';
      expect(() => manager.createSession('host3b', 'http://localhost:3000')).not.toThrow();
    });

    it('still rejects a second session while the first is only in lobby/active status', () => {
      const s1 = manager.createSession('host3c', 'http://localhost:3000');
      s1.status = 'active';
      expect(() => manager.createSession('host3c', 'http://localhost:3000')).toThrow();
    });
  });

  // ── addPlayer ───────────────────────────────────────────────────────────────

  describe('addPlayer', () => {
    it('adds a player and returns correct shape, with no score field', () => {
      const session = manager.createSession('host4', 'http://localhost:3000');
      const player = manager.addPlayer(session.id, 'Alice');
      expect(player.name).toBe('Alice');
      expect(player).not.toHaveProperty('score');
      expect(player.connectionStatus).toBe('connected');
      expect(player.isHost).toBe(false);
      expect(session.players.get(player.id)).toBe(player);
    });

    it('stores two identical names as-is, with no " 2" suffix', () => {
      const session = manager.createSession('host5', 'http://localhost:3000');
      const p1 = manager.addPlayer(session.id, 'Bob');
      const p2 = manager.addPlayer(session.id, 'Bob');
      expect(p1.name).toBe('Bob');
      expect(p2.name).toBe('Bob');
      expect(p1.id).not.toBe(p2.id);
    });

    it('trims whitespace from the submitted name', () => {
      const session = manager.createSession('host5b', 'http://localhost:3000');
      const player = manager.addPlayer(session.id, '  Charlie  ');
      expect(player.name).toBe('Charlie');
    });

    it('sets isHost flag when option is passed', () => {
      const session = manager.createSession('host6', 'http://localhost:3000');
      const player = manager.addPlayer(session.id, 'HostPlayer', { isHost: true });
      expect(player.isHost).toBe(true);
    });

    it('throws when sessionId is unknown', () => {
      expect(() => manager.addPlayer('nonexistent-id', 'Alice')).toThrow();
    });
  });

  // ── addPlayer — empty roster (US2) ────────────────────────────────────────

  describe('addPlayer — empty roster', () => {
    it('a freshly created session reports zero players', () => {
      const session = manager.createSession('host-empty', 'http://localhost:3000');
      expect(session.players.size).toBe(0);
    });
  });

  // ── removeSession ───────────────────────────────────────────────────────────

  describe('removeSession', () => {
    it('removes the session so getSession returns undefined', () => {
      const session = manager.createSession('host7', 'http://localhost:3000');
      manager.removeSession(session.id);
      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it('is a no-op for an unknown id', () => {
      expect(() => manager.removeSession('ghost-id')).not.toThrow();
    });
  });
});
