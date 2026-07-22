import type { WsRouter } from '../WsRouter.js';
/** Maps wsClientId → { sessionId, role, playerId? } */
export declare const authContext: Map<string, {
    sessionId: string;
    role: "host" | "player";
    playerId?: string;
}>;
export declare function registerAuthHandler(router: WsRouter): void;
//# sourceMappingURL=authHandler.d.ts.map