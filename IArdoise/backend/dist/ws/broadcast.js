import { WebSocket } from 'ws';
import { getAllConnections, getWs } from './connectionRegistry.js';
import { SessionManager } from '../session/SessionManager.js';
export function sendToClient(wsClientId, message) {
    const ws = getWs(wsClientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}
export function broadcastToSession(sessionId, message) {
    const session = SessionManager.getInstance().getSession(sessionId);
    if (!session)
        return;
    const allConnections = getAllConnections();
    for (const player of session.players.values()) {
        if (player.wsClientId) {
            const ws = allConnections.get(player.wsClientId);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        }
    }
}
/**
 * Broadcast to all clients registered in the connection registry
 * that belong to a given session — including the host if connected.
 */
export function broadcastToAll(sessionId, message, hostWsClientId) {
    broadcastToSession(sessionId, message);
    // Also send to host if they are connected but not yet in the players map
    if (hostWsClientId) {
        sendToClient(hostWsClientId, message);
    }
}
//# sourceMappingURL=broadcast.js.map