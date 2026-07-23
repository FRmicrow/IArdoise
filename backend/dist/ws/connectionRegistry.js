/** Maps wsClientId → active WebSocket connection */
const registry = new Map();
/** Maps sessionId → the host's current wsClientId (absent while no host is connected) */
const hostBySession = new Map();
export function register(wsClientId, ws) {
    registry.set(wsClientId, ws);
}
export function deregister(wsClientId) {
    registry.delete(wsClientId);
}
export function getWs(wsClientId) {
    return registry.get(wsClientId);
}
export function getAllConnections() {
    return registry;
}
/** The host isn't a session player, so it's tracked separately for broadcast fan-out. */
export function registerHost(sessionId, wsClientId) {
    hostBySession.set(sessionId, wsClientId);
}
export function unregisterHost(sessionId) {
    hostBySession.delete(sessionId);
}
export function getHostWsClientId(sessionId) {
    return hostBySession.get(sessionId);
}
//# sourceMappingURL=connectionRegistry.js.map