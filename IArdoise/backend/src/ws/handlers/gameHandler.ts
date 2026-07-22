import type { WsRouter } from '../WsRouter.js';
import { authContext } from './authHandler.js';
import { SessionManager } from '../../session/SessionManager.js';
import { broadcastToSession, sendToClient } from '../broadcast.js';

export function registerGameHandler(router: WsRouter): void {
  // START_GAME
  router.register('START_GAME', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'host') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only the host can start the game' },
      });
      return;
    }

    const p = payload as Record<string, unknown>;
    const session = SessionManager.getInstance().getSession(p['sessionId'] as string);
    if (!session) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (session.players.size < 1) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'At least 1 player required to start' },
      });
      return;
    }

    session.status = 'active';
    broadcastToSession(session.id, {
      type: 'GAME_STARTED',
      payload: { sessionId: session.id, currentPrompt: session.currentPrompt },
    });
    // Also send to host
    sendToClient(wsClientId, {
      type: 'GAME_STARTED',
      payload: { sessionId: session.id, currentPrompt: session.currentPrompt },
    });
  });

  // NEXT_QUESTION
  router.register('NEXT_QUESTION', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'host') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only the host can advance questions' },
      });
      return;
    }

    const p = payload as Record<string, unknown>;
    const session = SessionManager.getInstance().getSession(p['sessionId'] as string);
    if (!session || session.status !== 'active') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'Session must be active' },
      });
      return;
    }

    if (session.currentPrompt) {
      session.prompts.push({
        index: session.roundIndex,
        text: session.currentPrompt,
        setAt: new Date(),
      });
    }
    session.roundIndex++;
    session.currentPrompt = '';

    broadcastToSession(session.id, {
      type: 'QUESTION_ADVANCED',
      payload: { roundIndex: session.roundIndex },
    });
    sendToClient(wsClientId, {
      type: 'QUESTION_ADVANCED',
      payload: { roundIndex: session.roundIndex },
    });
  });

  // UPDATE_SCORE
  router.register('UPDATE_SCORE', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'host') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only the host can update scores' },
      });
      return;
    }

    const p = payload as Record<string, unknown>;
    const session = SessionManager.getInstance().getSession(p['sessionId'] as string);
    if (!session || session.status !== 'active') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'Session must be active to update scores' },
      });
      return;
    }

    const player = session.players.get(p['playerId'] as string);
    if (!player) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: 'Player not found' },
      });
      return;
    }

    const delta = p['delta'] as number;
    if (delta !== 1 && delta !== -1) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: 'delta must be 1 or -1' },
      });
      return;
    }

    player.score += delta;
    broadcastToSession(session.id, {
      type: 'SCORE_UPDATED',
      payload: { playerId: player.id, newScore: player.score },
    });
    sendToClient(wsClientId, {
      type: 'SCORE_UPDATED',
      payload: { playerId: player.id, newScore: player.score },
    });
  });

  // END_GAME
  router.register('END_GAME', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'host') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only the host can end the game' },
      });
      return;
    }

    const p = payload as Record<string, unknown>;
    const session = SessionManager.getInstance().getSession(p['sessionId'] as string);
    if (!session) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    session.status = 'ended';

    const scoreboard = Array.from(session.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ playerId: p.id, name: p.name, score: p.score }));

    broadcastToSession(session.id, {
      type: 'GAME_ENDED',
      payload: { scoreboard },
    });
    sendToClient(wsClientId, {
      type: 'GAME_ENDED',
      payload: { scoreboard },
    });
  });
}
