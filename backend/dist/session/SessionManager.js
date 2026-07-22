import { randomUUID } from 'crypto';
import { dedupName } from './nameDedup.js';
export class SessionManager {
    static instance;
    sessions = new Map();
    /** Maps hostUsername → active sessionId */
    hostSessionIndex = new Map();
    constructor() { }
    static getInstance() {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }
    createSession(hostUsername, baseUrl) {
        if (this.hostSessionIndex.has(hostUsername)) {
            throw new Error('Host already has an active session');
        }
        const id = randomUUID();
        const joinUrl = `${baseUrl}/join/${id}`;
        const session = {
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
    getSession(id) {
        return this.sessions.get(id);
    }
    addPlayer(sessionId, name, options = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        const existingNames = Array.from(session.players.values()).map((p) => p.name);
        const dedupedName = dedupName(existingNames, name.trim());
        const player = {
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
    removeSession(id) {
        const session = this.sessions.get(id);
        if (!session)
            return;
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
//# sourceMappingURL=SessionManager.js.map