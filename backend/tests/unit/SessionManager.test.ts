/**
 * Unit tests: SessionManager
 *
 * Covers:
 *   - createSession: creates a session, sets initial state
 *   - createSession: accepts an optional initialPhrase, trims it
 *   - createSession: enforces single-session-per-host constraint (throws on duplicate)
 *   - createSession: applies default settings / stores custom settings (004, FR-004)
 *   - canAdvanceRound: guards the maxRounds boundary (004, FR-009)
 *   - setFinishedCurrentRound: marks a single player's round as finished (004, FR-012)
 *   - awardRoundPoints: stores round points idempotently — re-awarding a round
 *     overwrites rather than accumulates (004, FR-011)
 *   - computeResults: sums points across rounds, ranks descending, breaks
 *     ties by join order, includes unscored players at 0 (004, FR-014)
 *   - addPlayer: adds a player to a session
 *   - addPlayer: stores duplicate names as-is (no dedup suffix), no score field
 *   - addPlayer: throws on unknown sessionId
 *   - removeSession: removes session and frees host slot
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../../src/session/SessionManager.js';
import { DEFAULT_SESSION_SETTINGS } from '../../src/schemas/sessionSettings.js';

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

  // ── createSession — settings (004, FR-004) ─────────────────────────────────

  describe('createSession — settings', () => {
    it('applies default settings when none are given', () => {
      const session = manager.createSession('host-settings-default', 'http://localhost:3000');
      expect(session.settings).toEqual(DEFAULT_SESSION_SETTINGS);
      expect(session.roundScores).toBeInstanceOf(Map);
      expect(session.roundScores.size).toBe(0);
    });

    it('stores custom settings when given', () => {
      const custom = { roundDurationSec: 30, maxRounds: 5, maxPlayers: 4, pointsEnabled: false };
      const session = manager.createSession(
        'host-settings-custom',
        'http://localhost:3000',
        undefined,
        custom,
      );
      expect(session.settings).toEqual(custom);
    });
  });

  // ── canAdvanceRound (004, FR-009) ───────────────────────────────────────────

  describe('canAdvanceRound', () => {
    it('allows advancing while below the configured maxRounds', () => {
      const session = manager.createSession('host-advance-ok', 'http://localhost:3000', undefined, {
        ...DEFAULT_SESSION_SETTINGS,
        maxRounds: 3,
      });
      session.roundIndex = 1; // about to become round 3 (index 2), still < maxRounds
      expect(manager.canAdvanceRound(session)).toBe(true);
    });

    it('refuses advancing once the last configured round is reached', () => {
      const session = manager.createSession('host-advance-blocked', 'http://localhost:3000', undefined, {
        ...DEFAULT_SESSION_SETTINGS,
        maxRounds: 3,
      });
      session.roundIndex = 2; // already at the last round (index 2 of 3)
      expect(manager.canAdvanceRound(session)).toBe(false);
    });
  });

  // ── setFinishedCurrentRound (004, FR-012) ───────────────────────────────────

  describe('setFinishedCurrentRound', () => {
    it('marks only the targeted player as finished', () => {
      const session = manager.createSession('host-finish', 'http://localhost:3000');
      const alice = manager.addPlayer(session.id, 'Alice');
      const bob = manager.addPlayer(session.id, 'Bob');

      manager.setFinishedCurrentRound(session.id, alice.id);

      expect(session.players.get(alice.id)?.finishedCurrentRound).toBe(true);
      expect(session.players.get(bob.id)?.finishedCurrentRound).toBe(false);
    });

    it('throws when sessionId is unknown', () => {
      expect(() => manager.setFinishedCurrentRound('nonexistent-id', 'p1')).toThrow();
    });
  });

  // ── awardRoundPoints (004, FR-011) ──────────────────────────────────────────

  describe('awardRoundPoints', () => {
    it('stores points for a round, keyed by playerId', () => {
      const session = manager.createSession('host-award', 'http://localhost:3000');
      const alice = manager.addPlayer(session.id, 'Alice');
      const bob = manager.addPlayer(session.id, 'Bob');

      manager.awardRoundPoints(session.id, 0, { [alice.id]: 5, [bob.id]: 2 });

      expect(session.roundScores.get(0)?.get(alice.id)).toBe(5);
      expect(session.roundScores.get(0)?.get(bob.id)).toBe(2);
    });

    it('overwrites rather than accumulates when a round is scored twice (idempotent)', () => {
      const session = manager.createSession('host-award-idempotent', 'http://localhost:3000');
      const alice = manager.addPlayer(session.id, 'Alice');

      manager.awardRoundPoints(session.id, 0, { [alice.id]: 5 });
      manager.awardRoundPoints(session.id, 0, { [alice.id]: 5 }); // retried/duplicate send

      expect(session.roundScores.get(0)?.get(alice.id)).toBe(5);
    });

    it('throws when sessionId is unknown', () => {
      expect(() => manager.awardRoundPoints('nonexistent-id', 0, {})).toThrow();
    });
  });

  // ── computeResults (004, FR-014) ────────────────────────────────────────────

  describe('computeResults', () => {
    it('sums points across every scored round, per player', () => {
      const session = manager.createSession('host-results-sum', 'http://localhost:3000');
      const alice = manager.addPlayer(session.id, 'Alice');
      const bob = manager.addPlayer(session.id, 'Bob');

      manager.awardRoundPoints(session.id, 0, { [alice.id]: 5, [bob.id]: 2 });
      manager.awardRoundPoints(session.id, 1, { [alice.id]: 3, [bob.id]: 7 });

      const results = manager.computeResults(session.id);
      expect(results.find((r) => r.playerId === alice.id)?.totalPoints).toBe(8);
      expect(results.find((r) => r.playerId === bob.id)?.totalPoints).toBe(9);
    });

    it('includes players with no scored round at 0 points', () => {
      const session = manager.createSession('host-results-unscored', 'http://localhost:3000');
      const alice = manager.addPlayer(session.id, 'Alice');

      const results = manager.computeResults(session.id);
      expect(results).toHaveLength(1);
      expect(results[0]?.playerId).toBe(alice.id);
      expect(results[0]?.totalPoints).toBe(0);
    });

    it('ranks descending by total points, 1-based', () => {
      const session = manager.createSession('host-results-rank', 'http://localhost:3000');
      const alice = manager.addPlayer(session.id, 'Alice');
      const bob = manager.addPlayer(session.id, 'Bob');
      const carla = manager.addPlayer(session.id, 'Carla');

      manager.awardRoundPoints(session.id, 0, { [alice.id]: 3, [bob.id]: 9, [carla.id]: 6 });

      const results = manager.computeResults(session.id);
      expect(results.map((r) => r.playerId)).toEqual([bob.id, carla.id, alice.id]);
      expect(results.map((r) => r.rank)).toEqual([1, 2, 3]);
    });

    it('breaks ties by join order (earlier join wins the better rank)', () => {
      const session = manager.createSession('host-results-tie', 'http://localhost:3000');
      const first = manager.addPlayer(session.id, 'First');
      const second = manager.addPlayer(session.id, 'Second');

      manager.awardRoundPoints(session.id, 0, { [first.id]: 4, [second.id]: 4 });

      const results = manager.computeResults(session.id);
      expect(results.map((r) => r.playerId)).toEqual([first.id, second.id]);
      expect(results.map((r) => r.rank)).toEqual([1, 2]);
    });

    it('throws when sessionId is unknown', () => {
      expect(() => manager.computeResults('nonexistent-id')).toThrow();
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
