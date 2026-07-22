import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { config } from './config.js';
import { WsRouter } from './ws/WsRouter.js';
import { register, deregister } from './ws/connectionRegistry.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const app = Fastify({ logger: true });
// ── Plugins ──────────────────────────────────────────────────────────────────
await app.register(fastifyWebsocket);
// Serve compiled frontend in production
const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
const frontendDistExists = existsSync(frontendDist);
if (frontendDistExists) {
    await app.register(fastifyStatic, {
        root: frontendDist,
        prefix: '/',
        decorateReply: false,
    });
}
else {
    app.log.warn('Frontend dist not found; static file serving disabled');
}
// ── HTTP Routes ───────────────────────────────────────────────────────────────
// Auth routes
const { loginRoute } = await import('./auth/loginRoute.js');
await app.register(loginRoute, { prefix: '/api/auth' });
// Session routes
const { sessionRoutes } = await import('./session/sessionRoutes.js');
await app.register(sessionRoutes, { prefix: '/api/sessions' });
// Player routes
const { playerRoutes } = await import('./session/playerRoutes.js');
await app.register(playerRoutes, { prefix: '/api/sessions' });
// ── WebSocket ─────────────────────────────────────────────────────────────────
const wsRouter = new WsRouter();
// Register WS handlers (imported lazily so they can use wsRouter)
const { registerAuthHandler } = await import('./ws/handlers/authHandler.js');
const { registerConnectionHandler } = await import('./ws/handlers/connectionHandler.js');
const { registerPromptHandler } = await import('./ws/handlers/promptHandler.js');
const { registerGameHandler } = await import('./ws/handlers/gameHandler.js');
const { registerHostPlayerHandler } = await import('./ws/handlers/hostPlayerHandler.js');
registerAuthHandler(wsRouter);
registerConnectionHandler(wsRouter);
registerPromptHandler(wsRouter);
registerGameHandler(wsRouter);
registerHostPlayerHandler(wsRouter);
// Connection → wsClientId map for host tracking
const hostConnections = new Map(); // sessionId → wsClientId
app.get('/ws', { websocket: true }, (socket, _req) => {
    const wsClientId = randomUUID();
    register(wsClientId, socket);
    app.log.info(`WS connected: ${wsClientId}`);
    socket.on('message', (raw) => {
        wsRouter.handle(socket, wsClientId, raw.toString());
    });
    socket.on('close', () => {
        app.log.info(`WS disconnected: ${wsClientId}`);
        // Trigger connection handler for cleanup
        wsRouter.handle(socket, wsClientId, JSON.stringify({
            type: '__DISCONNECT__',
            payload: {},
        }));
        deregister(wsClientId);
    });
    socket.on('error', (err) => {
        app.log.error(`WS error on ${wsClientId}: ${err.message}`);
        deregister(wsClientId);
    });
});
// Health check
app.get('/health', async () => ({ status: 'ok' }));
// SPA fallback — serve index.html for all non-API, non-WS routes
if (frontendDistExists) {
    app.setNotFoundHandler(async (_req, reply) => {
        return reply.sendFile('index.html');
    });
}
// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
    try {
        await app.listen({ port: config.port, host: '0.0.0.0' });
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
export { hostConnections };
//# sourceMappingURL=index.js.map