import type { WsRouter } from '../WsRouter.js';
import { authContext } from './authHandler.js';
import { SessionManager } from '../../session/SessionManager.js';
import { broadcastToSession, sendToClient } from '../broadcast.js';

export function registerPromptHandler(router: WsRouter): void {
  router.register('SET_PROMPT', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'host') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only the host can set the prompt' },
      });
      return;
    }

    const p = payload as Record<string, unknown>;
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

    session.currentPrompt = text;
    session.prompts.push({ index: session.roundIndex, text, setAt: new Date() });

    broadcastToSession(sessionId, {
      type: 'PROMPT_UPDATED',
      payload: { text, roundIndex: session.roundIndex },
    });
  });
}
