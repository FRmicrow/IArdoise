import type { WsRouter } from '../WsRouter.js';
import { authContext } from './authHandler.js';
import { SessionManager } from '../../session/SessionManager.js';
import { broadcastToSession, sendToClient } from '../broadcast.js';
import { markDrawingDoneSchema, awardRoundPointsSchema } from '../../schemas/roundScoring.js';

export function registerScoringHandler(router: WsRouter): void {
  // MARK_DRAWING_DONE (player-only, FR-012)
  router.register('MARK_DRAWING_DONE', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'player' || !ctx.playerId) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only a player can mark their drawing as done' },
      });
      return;
    }

    const parsed = markDrawingDoneSchema.safeParse(payload);
    if (!parsed.success) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid payload' },
      });
      return;
    }

    const session = SessionManager.getInstance().getSession(parsed.data.sessionId);
    if (!session || session.status !== 'active') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'Session must be active' },
      });
      return;
    }

    SessionManager.getInstance().setFinishedCurrentRound(session.id, ctx.playerId);

    broadcastToSession(session.id, {
      type: 'PLAYER_FINISHED',
      payload: { playerId: ctx.playerId },
    });
  });

  // AWARD_ROUND_POINTS (host-only, FR-011)
  router.register('AWARD_ROUND_POINTS', (_ws, wsClientId, payload) => {
    const ctx = authContext.get(wsClientId);
    if (!ctx || ctx.role !== 'host') {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'UNAUTHORIZED', message: 'Only the host can award points' },
      });
      return;
    }

    const parsed = awardRoundPointsSchema.safeParse(payload);
    if (!parsed.success) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid payload' },
      });
      return;
    }

    const { sessionId, roundIndex, points } = parsed.data;
    const session = SessionManager.getInstance().getSession(sessionId);
    if (!session) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (!session.settings.pointsEnabled) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'INVALID_STATE', message: 'Points are disabled for this session' },
      });
      return;
    }

    const unknownPlayerId = Object.keys(points).find((playerId) => !session.players.has(playerId));
    if (unknownPlayerId) {
      sendToClient(wsClientId, {
        type: 'ERROR',
        payload: { code: 'VALIDATION_ERROR', message: `Unknown playerId: ${unknownPlayerId}` },
      });
      return;
    }

    SessionManager.getInstance().awardRoundPoints(sessionId, roundIndex, points);

    const results = SessionManager.getInstance().computeResults(sessionId);
    const totals = Object.fromEntries(results.map((r) => [r.playerId, r.totalPoints]));

    broadcastToSession(sessionId, {
      type: 'SCORES_UPDATED',
      payload: { roundIndex, totals },
    });
  });
}
