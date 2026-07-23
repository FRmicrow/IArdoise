export type SessionStatus = 'lobby' | 'active' | 'ended';
export type ConnectionStatus = 'connected' | 'disconnected';
export interface Session {
    id: string;
    status: SessionStatus;
    joinUrl: string;
    currentPhrase: string;
    roundIndex: number;
    players: Map<string, Player>;
    phrases: Phrase[];
    createdAt: Date;
}
export interface Player {
    id: string;
    sessionId: string;
    name: string;
    connectionStatus: ConnectionStatus;
    isHost: boolean;
    wsClientId: string | null;
    registeredAt: Date;
}
export interface Phrase {
    index: number;
    text: string;
    setAt: Date;
}
//# sourceMappingURL=types.d.ts.map