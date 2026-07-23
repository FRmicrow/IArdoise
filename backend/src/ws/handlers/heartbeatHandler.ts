import type { WsRouter } from '../WsRouter.js';
import { sendToClient } from '../broadcast.js';

export function registerHeartbeatHandler(router: WsRouter): void {
  router.register('PING', (_ws, wsClientId) => {
    sendToClient(wsClientId, { type: 'PONG', payload: {} });
  });
}
