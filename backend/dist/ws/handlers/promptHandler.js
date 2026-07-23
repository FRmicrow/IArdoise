import { authContext } from './authHandler.js';
import { SessionManager } from '../../session/SessionManager.js';
import { broadcastToSession, sendToClient } from '../broadcast.js';
export function registerPromptHandler(router) {
    router.register('SET_PROMPT', (_ws, wsClientId, payload) => {
        const ctx = authContext.get(wsClientId);
        if (!ctx || ctx.role !== 'host') {
            sendToClient(wsClientId, {
                type: 'ERROR',
                payload: { code: 'UNAUTHORIZED', message: 'Only the host can set the prompt' },
            });
            return;
        }
        const p = payload;
        const { sessionId, text } = p;
        if (typeof sessionId !== 'string' || typeof text !== 'string') {
            sendToClient(wsClientId, {
                type: 'ERROR',
                payload: { code: 'VALIDATION_ERROR', message: 'sessionId and text required' },
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
        const trimmed = text.trim();
        if (!trimmed) {
            sendToClient(wsClientId, {
                type: 'ERROR',
                payload: { code: 'VALIDATION_ERROR', message: 'Phrase cannot be empty' },
            });
            return;
        }
        if (session.status !== 'active') {
            sendToClient(wsClientId, {
                type: 'ERROR',
                payload: { code: 'INVALID_STATE', message: 'Session must be active to publish a phrase' },
            });
            return;
        }
        session.currentPhrase = trimmed;
        session.phrases.push({ index: session.roundIndex, text: trimmed, setAt: new Date() });
        broadcastToSession(sessionId, {
            type: 'PROMPT_UPDATED',
            payload: { text: trimmed, roundIndex: session.roundIndex },
        });
    });
}
//# sourceMappingURL=promptHandler.js.map