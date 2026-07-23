import type { FastifyInstance } from 'fastify';
import { SessionManager } from './SessionManager.js';
import { broadcastToSession } from '../ws/broadcast.js';

export async function playerRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/sessions/:sessionId/players
  fastify.post<{
    Params: { sessionId: string };
    Body: { name: string };
  }>('/:sessionId/players', async (request, reply) => {
    const { sessionId } = request.params;
    const { name } = request.body;

    const session = SessionManager.getInstance().getSession(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    if (session.status !== 'lobby') {
      return reply.code(409).send({ error: 'Registration is closed' });
    }

    const trimmed = name?.trim() ?? '';
    if (trimmed.length < 1 || trimmed.length > 32) {
      return reply.code(400).send({ error: 'Name must be between 1 and 32 characters' });
    }

    const player = SessionManager.getInstance().addPlayer(sessionId, trimmed);

    // Broadcast PLAYER_JOINED to all connected clients in the session
    broadcastToSession(sessionId, {
      type: 'PLAYER_JOINED',
      payload: { playerId: player.id, name: player.name },
    });

    return reply.code(201).send({ playerId: player.id, name: player.name });
  });
}
