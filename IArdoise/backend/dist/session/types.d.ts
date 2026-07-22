export type SessionStatus = 'lobby' | 'active' | 'ended';
export type ConnectionStatus = 'connected' | 'disconnected';
export interface Session {
    id: string;
    status: SessionStatus;
    joinUrl: string;
    currentPrompt: string;
    roundIndex: number;
    players: Map<string, Player>;
    prompts: Prompt[];
    createdAt: Date;
}
export interface Player {
    id: string;
    sessionId: string;
    name: string;
    score: number;
    connectionStatus: ConnectionStatus;
    isHost: boolean;
    wsClientId: string | null;
    registeredAt: Date;
}
export interface Prompt {
    index: number;
    text: string;
    setAt: Date;
}
//# sourceMappingURL=types.d.ts.map