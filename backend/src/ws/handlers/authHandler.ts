import type { WebSocket } from 'ws';
import type { WsRouter } from '../WsRouter.js';
import type { Session } from '../../session/types.js';
import { verifyToken } from '../../auth/jwt.js';
import { SessionManager } from '../../session/SessionManager.js';
import { sendToClient, broadcastToSession } from '../broadcast.js';
import { registerHost } from '../connectionRegistry.js';

/** Maps wsClientId → { sessionId, role, playerId? } */
export const authContext = new Map<string, {
  sessionId: string;
  role: 'host' | 'player';
  playerId?: string;
}>();

export function registerAuthHandler(router: WsRouter): void {
  router.register('AUTH', async (ws: WebSocket, wsClientId: string, payload: unknown) => {
    const p = payload as Record<string, unknown>;
    const { role, sessionId } = p;

    if (!sessionId || typeof sessionId !== 'string') {
      sendToClient(wsClientId, {
        type: 'AUTH_ERROR',
        payload: { message: 'sessionId required' },
      });
      ws.close();
      return;
    }

    const session = SessionManager.getInstance().getSession(sessionId);
    if (!session) {
      sendToClient(wsClientId, {
        type: 'AUTH_ERROR',
        payload: { message: 'Session not found' },
      });
      ws.close();
      return;
    }

    if (role === 'host') {
      const token = p['token'];
      if (!token || typeof token !== 'string') {
        sendToClient(wsClientId, {
          type: 'AUTH_ERROR',
          payload: { message: 'Token required for host auth' },
        });
        ws.close();
        return;
      }
      try {
        await verifyToken(token);
      } catch {
        sendToClient(wsClientId, {
          type: 'AUTH_ERROR',
          payload: { message: 'Invalid or expired token' },
        });
        ws.close();
        return;
      }

      authContext.set(wsClientId, { sessionId, role: 'host' });
      registerHost(sessionId, wsClientId);

    } else if (role === 'player') {
      const playerId = p['playerId'];
      if (!playerId || typeof playerId !== 'string') {
        sendToClient(wsClientId, {
          type: 'AUTH_ERROR',
          payload: { message: 'playerId required for player auth' },
        });
        ws.close();
        return;
      }

      const player = session.players.get(playerId);
      if (!player) {
        sendToClient(wsClientId, {
          type: 'AUTH_ERROR',
          payload: { message: 'Player not found in session' },
        });
        ws.close();
        return;
      }

      const wasDisconnected = player.connectionStatus === 'disconnected';
      player.wsClientId = wsClientId;
      player.connectionStatus = 'connected';
      authContext.set(wsClientId, { sessionId, role: 'player', playerId });

      if (wasDisconnected) {
        broadcastToSession(sessionId, {
          type: 'PLAYER_RECONNECTED',
          payload: { playerId },
        });
      }

    } else {
      sendToClient(wsClientId, {
        type: 'AUTH_ERROR',
        payload: { message: 'role must be "host" or "player"' },
      });
      ws.close();
      return;
    }

    // Send AUTH_OK
    sendToClient(wsClientId, { type: 'AUTH_OK', payload: { role } });

    // Send SESSION_STATE snapshot
    sendSessionState(wsClientId, session);
  });
}

function sendSessionState(wsClientId: string, session: Session): void {
  if (!session) return;

  const players = Array.from(session.players.values()).map((p) => ({
    playerId: p.id,
    name: p.name,
    connectionStatus: p.connectionStatus,
    finishedCurrentRound: p.finishedCurrentRound,
  }));

  const cumulativeScores: Record<string, number> = {};
  for (const player of session.players.values()) {
    let total = 0;
    for (const roundPoints of session.roundScores.values()) {
      total += roundPoints.get(player.id) ?? 0;
    }
    cumulativeScores[player.id] = total;
  }

  sendToClient(wsClientId, {
    type: 'SESSION_STATE',
    payload: {
      sessionId: session.id,
      status: session.status,
      currentPhrase: session.currentPhrase,
      roundIndex: session.roundIndex,
      players,
      settings: session.settings,
      cumulativeScores,
    },
  });
}
