/**
 * Unit tests: SessionManager + dedupName
 *
 * Covers:
 *   - createSession: creates a session, sets initial state
 *   - createSession: enforces single-session-per-host constraint (throws on duplicate)
 *   - addPlayer: adds a player to a session
 *   - addPlayer: calls dedupName to suffix colliding names
 *   - addPlayer: throws on unknown sessionId
 *   - removeSession: removes session and frees host slot
 *   - dedupName: no-collision path
 *   - dedupName: collision increments suffix from 2 upward
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../../src/session/SessionManager.js';
import { dedupName } from '../../src/session/nameDedup.js';

// ── dedupName unit tests ──────────────────────────────────────────────────────

describe('dedupName', () => {
  it('returns the candidate unchanged when there is no collision', () => {
    expect(dedupName(['Alice', 'Bob'], 'Charlie')).toBe('Charlie');
  });

  it('returns the candidate unchanged when existing list is empty', () => {
    expect(dedupName([], 'Alice')).toBe('Alice');
  });

  it('appends " 2" when the candidate already exists', () => {
    expect(dedupName(['Bob'], 'Bob')).toBe('Bob 2');
  });

  it('increments suffix when " 2" also collides', () => {
    expect(dedupName(['Bob', 'Bob 2'], 'Bob')).toBe('Bob 3');
  });

  it('handles large suffix chains', () => {
    const existing = ['X', 'X 2', 'X 3', 'X 4'];
    expect(dedupName(existing, 'X')).toBe('X 5');
  });
});

// ── SessionManager unit tests ─────────────────────────────────────────────────

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
      expect(session.currentPrompt).toBe('');
      expect(session.roundIndex).toBe(0);
      expect(session.players.size).toBe(0);
      expect(session.prompts).toEqual([]);
      expect(session.joinUrl).toMatch(/\/join\//);
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
  });

  // ── addPlayer ───────────────────────────────────────────────────────────────

  describe('addPlayer', () => {
    it('adds a player and returns correct shape', () => {
      const session = manager.createSession('host4', 'http://localhost:3000');
      const player = manager.addPlayer(session.id, 'Alice');
      expect(player.name).toBe('Alice');
      expect(player.score).toBe(0);
      expect(player.connectionStatus).toBe('connected');
      expect(player.isHost).toBe(false);
      expect(session.players.get(player.id)).toBe(player);
    });

    it('deduplicates colliding names', () => {
      const session = manager.createSession('host5', 'http://localhost:3000');
      const p1 = manager.addPlayer(session.id, 'Bob');
      const p2 = manager.addPlayer(session.id, 'Bob');
      expect(p1.name).toBe('Bob');
      expect(p2.name).toBe('Bob 2');
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
