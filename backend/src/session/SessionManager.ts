import { randomUUID } from 'crypto';
import type { Session, Player, SessionSettings } from './types.js';
import { DEFAULT_SESSION_SETTINGS } from '../schemas/sessionSettings.js';

export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, Session>();
  /** Maps hostUsername → active sessionId */
  private hostSessionIndex = new Map<string, string>();

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  createSession(
    hostUsername: string,
    baseUrl: string,
    initialPhrase?: string,
    settings: SessionSettings = DEFAULT_SESSION_SETTINGS,
  ): Session {
    const existingSessionId = this.hostSessionIndex.get(hostUsername);
    if (existingSessionId) {
      const existingSession = this.sessions.get(existingSessionId);
      if (existingSession && existingSession.status !== 'ended') {
        throw new Error('Host already has an active session');
      }
    }

    const id = randomUUID();
    const joinUrl = `${baseUrl}/join/${id}`;
    const session: Session = {
      id,
      status: 'lobby',
      joinUrl,
      currentPhrase: initialPhrase?.trim() ?? '',
      roundIndex: 0,
      players: new Map(),
      phrases: [],
      createdAt: new Date(),
      settings,
      roundScores: new Map(),
    };

    this.sessions.set(id, session);
    this.hostSessionIndex.set(hostUsername, id);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** True while the session can still move to a further round (FR-009). */
  canAdvanceRound(session: Session): boolean {
    return session.roundIndex + 1 < session.settings.maxRounds;
  }

  /** Marks a single player as done drawing for the round in progress (FR-012). */
  setFinishedCurrentRound(sessionId: string, playerId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    const player = session.players.get(playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    player.finishedCurrentRound = true;
  }

  /**
   * Stores a round's points, keyed by playerId. Idempotent: awarding the
   * same round twice overwrites rather than accumulates (FR-011).
   */
  awardRoundPoints(sessionId: string, roundIndex: number, points: Record<string, number>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    session.roundScores.set(roundIndex, new Map(Object.entries(points)));
  }

  /**
   * Ranked results across every player in the session, summing points from
   * every scored round. Unscored rounds/players contribute 0. Ties are
   * broken by join order — `session.players` is a Map, insertion-ordered by
   * `addPlayer`, and Array.sort is stable, so no explicit tiebreaker needed.
   */
  computeResults(sessionId: string): Array<{ playerId: string; name: string; totalPoints: number; rank: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const totals = Array.from(session.players.values()).map((player) => {
      let totalPoints = 0;
      for (const roundPoints of session.roundScores.values()) {
        totalPoints += roundPoints.get(player.id) ?? 0;
      }
      return { playerId: player.id, name: player.name, totalPoints };
    });

    totals.sort((a, b) => b.totalPoints - a.totalPoints);

    return totals.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  addPlayer(
    sessionId: string,
    name: string,
    options: { isHost?: boolean; wsClientId?: string } = {},
  ): Player {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const player: Player = {
      id: randomUUID(),
      sessionId,
      name: name.trim(),
      connectionStatus: 'connected',
      isHost: options.isHost ?? false,
      wsClientId: options.wsClientId ?? null,
      registeredAt: new Date(),
      finishedCurrentRound: false,
    };

    session.players.set(player.id, player);
    return player;
  }

  removeSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;

    // Clean up host index
    for (const [username, sessionId] of this.hostSessionIndex) {
      if (sessionId === id) {
        this.hostSessionIndex.delete(username);
        break;
      }
    }

    this.sessions.delete(id);
  }
}
