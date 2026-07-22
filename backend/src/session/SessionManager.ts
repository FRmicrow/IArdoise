import { randomUUID } from 'crypto';
import type { Session, Player } from './types.js';
import { dedupName } from './nameDedup.js';

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

  createSession(hostUsername: string, baseUrl: string): Session {
    if (this.hostSessionIndex.has(hostUsername)) {
      throw new Error('Host already has an active session');
    }

    const id = randomUUID();
    const joinUrl = `${baseUrl}/join/${id}`;
    const session: Session = {
      id,
      status: 'lobby',
      joinUrl,
      currentPrompt: '',
      roundIndex: 0,
      players: new Map(),
      prompts: [],
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

    const existingNames = Array.from(session.players.values()).map((p) => p.name);
    const dedupedName = dedupName(existingNames, name.trim());

    const player: Player = {
      id: randomUUID(),
      sessionId,
      name: dedupedName,
      score: 0,
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
