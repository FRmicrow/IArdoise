import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, type TokenPayload } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    request.user = await verifyToken(token);
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}
