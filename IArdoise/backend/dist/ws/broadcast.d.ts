export interface WsMessage {
    type: string;
    payload: unknown;
}
export declare function sendToClient(wsClientId: string, message: WsMessage): void;
export declare function broadcastToSession(sessionId: string, message: WsMessage): void;
/**
 * Broadcast to all clients registered in the connection registry
 * that belong to a given session — including the host if connected.
 */
export declare function broadcastToAll(sessionId: string, message: WsMessage, hostWsClientId?: string): void;
//# sourceMappingURL=broadcast.d.ts.map