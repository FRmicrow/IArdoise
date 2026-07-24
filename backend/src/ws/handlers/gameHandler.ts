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

    if (session.status !== 'lobby') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'Session already started or ended' },
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
      payload: { sessionId: session.id, currentPhrase: session.currentPhrase },
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

    if (!SessionManager.getInstance().canAdvanceRound(session)) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'Already at the last configured round' },
      });
      return;
    }

    if (session.currentPhrase) {
      session.phrases.push({
        index: session.roundIndex,
        text: session.currentPhrase,
        setAt: new Date(),
      });
    }
    session.roundIndex++;
    session.currentPhrase = '';
    for (const player of session.players.values()) {
      player.finishedCurrentRound = false;
    }

    broadcastToSession(session.id, {
      type: 'QUESTION_ADVANCED',
      payload: { roundIndex: session.roundIndex, maxRounds: session.settings.maxRounds },
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

    const results = session.settings.pointsEnabled
      ? SessionManager.getInstance().computeResults(session.id)
      : [];

    broadcastToSession(session.id, {
      type: 'GAME_ENDED',
      payload: { pointsEnabled: session.settings.pointsEnabled, results },
    });
  });
}
