import { WebSocket } from 'ws';
import { getAllConnections, getWs } from './connectionRegistry.js';
import { SessionManager } from '../session/SessionManager.js';

export interface WsMessage {
  type: string;
  payload: unknown;
}

export function sendToClient(wsClientId: string, message: WsMessage): void {
  const ws = getWs(wsClientId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcastToSession(sessionId: string, message: WsMessage): void {
  const session = SessionManager.getInstance().getSession(sessionId);
  if (!session) return;

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
export function broadcastToAll(sessionId: string, message: WsMessage, hostWsClientId?: string): void {
  broadcastToSession(sessionId, message);

  // Also send to host if they are connected but not yet in the players map
  if (hostWsClientId) {
    sendToClient(hostWsClientId, message);
  }
}
