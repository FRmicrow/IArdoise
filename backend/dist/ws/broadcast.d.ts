export interface WsMessage {
    type: string;
    payload: unknown;
}
export declare function sendToClient(wsClientId: string, message: WsMessage): void;
/** Broadcasts to every connected player plus the connected host (who is never a player). */
export declare function broadcastToSession(sessionId: string, message: WsMessage): void;
//# sourceMappingURL=broadcast.d.ts.map