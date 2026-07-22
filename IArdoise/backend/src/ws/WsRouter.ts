import type { WebSocket } from 'ws';
import type { WsMessage } from './broadcast.js';
import { sendToClient } from './broadcast.js';

export type WsHandler = (
  ws: WebSocket,
  wsClientId: string,
  payload: unknown,
) => Promise<void> | void;

export class WsRouter {
  private handlers = new Map<string, WsHandler>();

  register(type: string, handler: WsHandler): void {
    this.handlers.set(type, handler);
  }

  async handle(ws: WebSocket, wsClientId: string, raw: string): Promise<void> {
    let message: WsMessage;

    try {
      message = JSON.parse(raw) as WsMessage;
    } catch {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' },
      });
      return;
    }

    const { type, payload } = message;
    const handler = this.handlers.get(type);

    if (!handler) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: `Unknown event type: ${type}` },
      });
      return;
    }

    try {
      await handler(ws, wsClientId, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error';
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: msg },
      });
    }
  }
}
