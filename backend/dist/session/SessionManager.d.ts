import type { Session, Player } from './types.js';
export declare class SessionManager {
    private static instance;
    private sessions;
    /** Maps hostUsername → active sessionId */
    private hostSessionIndex;
    private constructor();
    static getInstance(): SessionManager;
    createSession(hostUsername: string, baseUrl: string, initialPhrase?: string): Session;
    getSession(id: string): Session | undefined;
    addPlayer(sessionId: string, name: string, options?: {
        isHost?: boolean;
        wsClientId?: string;
    }): Player;
    removeSession(id: string): void;
}
//# sourceMappingURL=SessionManager.d.ts.map