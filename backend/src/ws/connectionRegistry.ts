import type { WebSocket } from 'ws';

/** Maps wsClientId → active WebSocket connection */
const registry = new Map<string, WebSocket>();

/** Maps sessionId → the host's current wsClientId (absent while no host is connected) */
const hostBySession = new Map<string, string>();

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

/** The host isn't a session player, so it's tracked separately for broadcast fan-out. */
export function registerHost(sessionId: string, wsClientId: string): void {
  hostBySession.set(sessionId, wsClientId);
}

export function unregisterHost(sessionId: string): void {
  hostBySession.delete(sessionId);
}

export function getHostWsClientId(sessionId: string): string | undefined {
  return hostBySession.get(sessionId);
}
