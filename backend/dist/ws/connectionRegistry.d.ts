import type { WebSocket } from 'ws';
export declare function register(wsClientId: string, ws: WebSocket): void;
export declare function deregister(wsClientId: string): void;
export declare function getWs(wsClientId: string): WebSocket | undefined;
export declare function getAllConnections(): Map<string, WebSocket>;
/** The host isn't a session player, so it's tracked separately for broadcast fan-out. */
export declare function registerHost(sessionId: string, wsClientId: string): void;
export declare function unregisterHost(sessionId: string): void;
export declare function getHostWsClientId(sessionId: string): string | undefined;
//# sourceMappingURL=connectionRegistry.d.ts.map