/** Maps wsClientId → active WebSocket connection */
const registry = new Map();
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
//# sourceMappingURL=connectionRegistry.js.map