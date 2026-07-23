import { renderGameHost } from './pages/game-host';
import { renderGamePlayer } from './pages/game-player';
import { renderJoin } from './pages/join';
import { renderLobbyHost } from './pages/lobby-host';
import { renderLogin } from './pages/login';
import { renderClosing } from './pages/closing';

// ── Global ERROR toast ────────────────────────────────────────────────────────
// Listens for unhandled ERROR WS events dispatched as a custom DOM event.
// Each page-level WebSocketClient can dispatch these if they choose not to
// handle ERROR themselves.
(function setupErrorToast() {
  const toast = document.createElement('div');
  toast.id = 'global-error-toast';
  toast.setAttribute('role', 'alert');
  toast.title = 'Cliquer pour fermer';
  document.body.appendChild(toast);

  let dismissTimer: ReturnType<typeof setTimeout> | undefined;

  function showToast(message: string): void {
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => { toast.style.display = 'none'; }, 5000);
  }

  toast.addEventListener('click', () => { toast.style.display = 'none'; });

  // Pages dispatch 'ws-error' on window when they receive an unhandled ERROR event
  window.addEventListener('ws-error', (e: Event) => {
    const detail = (e as CustomEvent<{ code: string; message: string }>).detail;
    showToast(detail?.message ?? "Une erreur inattendue s'est produite");
  });
})();

function requireHostAuth(): boolean {
  return Boolean(localStorage.getItem('token'));
}

const routes: Record<string, (app: HTMLElement) => void> = {
  '#/login': renderLogin,
  '#/host/lobby': renderLobbyHost,
  '#/host/game': renderGameHost,
  '#/player/game': renderGamePlayer,
  '#/player/wait': renderGamePlayer,
  '#/closing': renderClosing,
};

function getCurrentRoute(): string {
  if (window.location.pathname.startsWith('/join/')) {
    const sessionId = window.location.pathname.slice('/join/'.length);
    const storedPlayerId = localStorage.getItem('playerId');
    const storedSessionId = localStorage.getItem('playerSessionId');

    // A player who already joined this exact session (QR re-scan, re-shared
    // link, browser history, PWA shortcut) must resume straight into their
    // session instead of seeing the join form again (FR-023) — the target
    // page reconciles against the live session state once its WS connects.
    if (storedPlayerId && storedSessionId && storedSessionId === sessionId) {
      history.replaceState(null, '', '/#/player/game');
      return '#/player/game';
    }

    return '#/join';
  }

  if (window.location.hash) {
    return window.location.hash;
  }

  // Fresh load with no route-specific hash (e.g. a PWA relaunched from the
  // home screen starts a brand-new browsing context at "/"). Resume directly
  // into the previously persisted session instead of defaulting to login/join
  // (FR-023/FR-024) — the target page itself reconciles against the live
  // session state once its WebSocket connects.
  if (localStorage.getItem('playerId') && localStorage.getItem('playerSessionId')) {
    return '#/player/game';
  }

  if (localStorage.getItem('hostSessionId') && localStorage.getItem('token')) {
    return '#/host/lobby';
  }

  return '#/login';
}

function navigate(): void {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) {
    return;
  }

  const route = getCurrentRoute();

  if (route === '#/join') {
    renderJoin(app);
    return;
  }

  if (route.startsWith('#/host/') && !requireHostAuth()) {
    window.location.hash = '#/login';
    return;
  }

  const handler = routes[route] ?? routes['#/login'];
  handler(app);
}

window.addEventListener('hashchange', navigate);
document.addEventListener('DOMContentLoaded', navigate);
