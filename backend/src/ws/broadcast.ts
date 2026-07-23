import { WebSocket } from 'ws';
import { getAllConnections, getHostWsClientId, getWs } from './connectionRegistry.js';
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

/** Broadcasts to every connected player plus the connected host (who is never a player). */
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

  const hostWsClientId = getHostWsClientId(sessionId);
  if (hostWsClientId) {
    sendToClient(hostWsClientId, message);
  }
}
