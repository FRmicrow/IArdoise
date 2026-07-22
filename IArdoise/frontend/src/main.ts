import { renderGameHost } from './pages/game-host';
import { renderGamePlayer } from './pages/game-player';
import { renderJoin } from './pages/join';
import { renderLobbyHost } from './pages/lobby-host';
import { renderLogin } from './pages/login';
import { renderScoreboard } from './pages/scoreboard';

// ── Global ERROR toast ────────────────────────────────────────────────────────
// Listens for unhandled ERROR WS events dispatched as a custom DOM event.
// Each page-level WebSocketClient can dispatch these if they choose not to
// handle ERROR themselves.
(function setupErrorToast() {
  const toast = document.createElement('div');
  toast.id = 'global-error-toast';
  toast.setAttribute('role', 'alert');
  toast.style.cssText = [
    'display:none',
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:#c00',
    'color:#fff',
    'padding:10px 20px',
    'border-radius:6px',
    'font-size:0.95rem',
    'z-index:9999',
    'max-width:90vw',
    'text-align:center',
    'cursor:pointer',
  ].join(';');
  toast.title = 'Click to dismiss';
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
    showToast(detail?.message ?? 'An unexpected error occurred');
  });
})();

function requireHostAuth(): boolean {
  return Boolean(sessionStorage.getItem('token'));
}

const routes: Record<string, (app: HTMLElement) => void> = {
  '#/login': renderLogin,
  '#/host/lobby': renderLobbyHost,
  '#/host/game': renderGameHost,
  '#/player/game': renderGamePlayer,
  '#/player/wait': renderGamePlayer,
  '#/scoreboard': renderScoreboard,
};

function getCurrentRoute(): string {
  if (window.location.pathname.startsWith('/join/')) {
    return '#/join';
  }

  return window.location.hash || '#/login';
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
