import type { WsRouter } from '../WsRouter.js';
import { authContext } from './authHandler.js';
import { SessionManager } from '../../session/SessionManager.js';
import { broadcastToSession } from '../broadcast.js';
import { unregisterHost } from '../connectionRegistry.js';

export function registerConnectionHandler(router: WsRouter): void {
  router.register('__DISCONNECT__', (_ws, wsClientId) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx) return;

    const { sessionId, role, playerId } = ctx;
    authContext.delete(wsClientId);

    const session = SessionManager.getInstance().getSession(sessionId);
    if (!session) return;

    if (role === 'host') {
      unregisterHost(sessionId);
      broadcastToSession(sessionId, {
        type: 'HOST_DISCONNECTED',
        payload: {},
      });
    }

    if (role === 'player' && playerId) {
      const player = session.players.get(playerId);
      if (player) {
        player.connectionStatus = 'disconnected';
        player.wsClientId = null;
        broadcastToSession(sessionId, {
          type: 'PLAYER_DISCONNECTED',
          payload: { playerId },
        });
      }
    }
  });
}
