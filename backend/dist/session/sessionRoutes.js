import { authMiddleware } from '../auth/middleware.js';
import { SessionManager } from './SessionManager.js';
import { generateQrDataUrl } from '../qr/generateQr.js';
export async function sessionRoutes(fastify) {
    // POST /api/sessions — create session (host only)
    fastify.post('/', {
        preHandler: authMiddleware,
    }, async (request, reply) => {
        const user = request.user;
        const baseUrl = `${request.protocol}://${request.headers.host ?? request.hostname}`;
        const rawInitialPhrase = request.body?.initialPhrase;
        const initialPhrase = typeof rawInitialPhrase === 'string' ? rawInitialPhrase.trim() : undefined;
        try {
            const session = SessionManager.getInstance().createSession(user.username, baseUrl, initialPhrase);
            return reply.code(201).send({
                sessionId: session.id,
                joinUrl: session.joinUrl,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Conflict';
            return reply.code(409).send({ error: msg });
        }
    });
    // GET /api/sessions/:sessionId/qr
    fastify.get('/:sessionId/qr', {
        preHandler: authMiddleware,
    }, async (request, reply) => {
        const session = SessionManager.getInstance().getSession(request.params.sessionId);
        if (!session) {
            return reply.code(404).send({ error: 'Session not found' });
        }
        const dataUrl = await generateQrDataUrl(session.joinUrl);
        return reply.send({ dataUrl });
    });
    // GET /api/sessions/:sessionId/status — unauthenticated (players are anonymous)
    fastify.get('/:sessionId/status', async (request, reply) => {
        const session = SessionManager.getInstance().getSession(request.params.sessionId);
        if (!session) {
            return reply.code(404).send({ error: 'Session not found' });
        }
        return reply.send({ status: session.status });
    });
}
//# sourceMappingURL=sessionRoutes.js.map