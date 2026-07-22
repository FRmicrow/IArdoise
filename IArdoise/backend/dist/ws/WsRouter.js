import { sendToClient } from './broadcast.js';
export class WsRouter {
    handlers = new Map();
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    async handle(ws, wsClientId, raw) {
        let message;
        try {
            message = JSON.parse(raw);
        }
        catch {
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
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Internal error';
            sendToClient(wsClientId, {
                type: 'ERROR',
                payload: { code: 'INVALID_STATE', message: msg },
            });
        }
    }
}
//# sourceMappingURL=WsRouter.js.map