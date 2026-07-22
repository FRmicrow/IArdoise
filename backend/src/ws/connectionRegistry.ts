import type { WebSocket } from 'ws';

/** Maps wsClientId → active WebSocket connection */
const registry = new Map<string, WebSocket>();

export function register(wsClientId: string, ws: WebSocket): void {
  registry.set(wsClientId, ws);
}

export function deregister(wsClientId: string): void {
  registry.delete(wsClientId);
}

export function getWs(wsClientId: string): WebSocket | undefined {
  return registry.get(wsClientId);
}

export function getAllConnections(): Map<string, WebSocket> {
  return registry;
}
