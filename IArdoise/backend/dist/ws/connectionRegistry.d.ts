import type { WebSocket } from 'ws';
export declare function register(wsClientId: string, ws: WebSocket): void;
export declare function deregister(wsClientId: string): void;
export declare function getWs(wsClientId: string): WebSocket | undefined;
export declare function getAllConnections(): Map<string, WebSocket>;
//# sourceMappingURL=connectionRegistry.d.ts.map