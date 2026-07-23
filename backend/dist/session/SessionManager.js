import { randomUUID } from 'crypto';
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
    createSession(hostUsername, baseUrl, initialPhrase) {
        const existingSessionId = this.hostSessionIndex.get(hostUsername);
        if (existingSessionId) {
            const existingSession = this.sessions.get(existingSessionId);
            if (existingSession && existingSession.status !== 'ended') {
                throw new Error('Host already has an active session');
            }
        }
        const id = randomUUID();
        const joinUrl = `${baseUrl}/join/${id}`;
        const session = {
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
    getSession(id) {
        return this.sessions.get(id);
    }
    addPlayer(sessionId, name, options = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        const player = {
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