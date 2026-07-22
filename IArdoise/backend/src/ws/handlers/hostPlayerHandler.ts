import type { WsRouter } from '../WsRouter.js';
import { authContext } from './authHandler.js';
import { SessionManager } from '../../session/SessionManager.js';
import { broadcastToSession, sendToClient } from '../broadcast.js';

export function registerHostPlayerHandler(router: WsRouter): void {
  router.register('HOST_JOIN_AS_PLAYER', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'host') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only the host can use this action' },
      });
      return;
    }

    const p = payload as Record<string, unknown>;
    const { sessionId, name } = p;

    if (typeof sessionId !== 'string' || typeof name !== 'string' || !name.trim()) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: 'sessionId and name required' },
      });
      return;
    }

    const session = SessionManager.getInstance().getSession(sessionId);
    if (!session) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (session.status !== 'lobby') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'Can only join as player during lobby' },
      });
      return;
    }

    const player = SessionManager.getInstance().addPlayer(sessionId, name.trim(), {
      isHost: true,
      wsClientId,
    });

    // The host is now in session.players with wsClientId set, so broadcastToSession
    // will deliver PLAYER_JOINED to all connected clients including the host themselves.
    broadcastToSession(sessionId, {
      type: 'PLAYER_JOINED',
      payload: { playerId: player.id, name: player.name, score: 0 },
    });
  });
}
