import { verifyToken } from './jwt.js';
export async function authMiddleware(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        request.user = await verifyToken(token);
    }
    catch {
        reply.code(401).send({ error: 'Unauthorized' });
    }
}
//# sourceMappingURL=middleware.js.map