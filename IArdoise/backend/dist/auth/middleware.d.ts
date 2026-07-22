import type { FastifyRequest, FastifyReply } from 'fastify';
import { type TokenPayload } from './jwt.js';
declare module 'fastify' {
    interface FastifyRequest {
        user?: TokenPayload;
    }
}
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=middleware.d.ts.map