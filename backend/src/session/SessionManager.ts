import { randomUUID } from 'crypto';
import type { Session, Player } from './types.js';

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

  createSession(hostUsername: string, baseUrl: string, initialPhrase?: string): Session {
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
    };

    this.sessions.set(id, session);
    this.hostSessionIndex.set(hostUsername, id);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
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
