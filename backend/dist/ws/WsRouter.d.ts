import type { WebSocket } from 'ws';
export type WsHandler = (ws: WebSocket, wsClientId: string, payload: unknown) => Promise<void> | void;
export declare class WsRouter {
    private handlers;
    register(type: string, handler: WsHandler): void;
    handle(ws: WebSocket, wsClientId: string, raw: string): Promise<void>;
}
//# sourceMappingURL=WsRouter.d.ts.map