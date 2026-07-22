import { DrawingCanvas } from '../canvas/DrawingCanvas';
import { WebSocketClient } from '../ws/WebSocketClient';

export function renderGamePlayer(app: HTMLElement): void {
  const playerId = sessionStorage.getItem('playerId');
  const sessionId = sessionStorage.getItem('playerSessionId');

  if (!playerId || !sessionId) {
    window.location.hash = '#/login';
    return;
  }

  app.innerHTML = `
    <main style="height: 100vh; display: grid; grid-template-rows: auto auto 1fr; gap: 12px; padding: 16px; position: relative;">
      <div id="waiting" style="padding: 12px; background: rgba(255,255,255,0.12);">Waiting for the host to start the game.</div>
      <p id="prompt" style="font-size: 1.125rem; min-height: 1.5em;"></p>
      <div id="canvas-container" style="min-height: 0; width: 100%; height: 100%;">
        <canvas id="drawing-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
      </div>
      <div id="host-disconnected-overlay" style="display: none; position: absolute; inset: 0; background: rgba(0,0,0,0.75); color: #fff; align-items: center; justify-content: center; font-size: 1.125rem; text-align: center; padding: 24px;">
        Host disconnected — waiting for reconnect…
      </div>
    </main>
  `;

  const waiting = app.querySelector<HTMLDivElement>('#waiting');
  const prompt = app.querySelector<HTMLParagraphElement>('#prompt');
  const canvas = app.querySelector<HTMLCanvasElement>('#drawing-canvas');
  const container = app.querySelector<HTMLElement>('#canvas-container');
  const hostDisconnectedOverlay = app.querySelector<HTMLDivElement>('#host-disconnected-overlay');

  if (!waiting || !prompt || !canvas || !container || !hostDisconnectedOverlay) {
    return;
  }

  const drawingCanvas = new DrawingCanvas(canvas, container);
  const wsClient = new WebSocketClient({ role: 'player', playerId, sessionId });
  wsClient.connect();

  wsClient.on('SESSION_STATE', (payload) => {
    prompt.textContent = payload.currentPrompt;
    waiting.style.display = payload.status === 'active' ? 'none' : 'block';
  });

  wsClient.on('PROMPT_UPDATED', (payload) => {
    prompt.textContent = payload.text;
  });

  wsClient.on('QUESTION_ADVANCED', () => {
    drawingCanvas.clear();
    prompt.textContent = '';
  });

  wsClient.on('GAME_STARTED', (payload) => {
    waiting.style.display = 'none';
    prompt.textContent = payload.currentPrompt;
    // Transition URL from #/player/wait → #/player/game without re-rendering
    if (window.location.hash !== '#/player/game') {
      history.replaceState(null, '', '#/player/game');
    }
  });

  wsClient.on('ERROR', (payload) => {
    window.dispatchEvent(new CustomEvent('ws-error', { detail: payload }));
  });

  wsClient.on('HOST_DISCONNECTED', () => {
    hostDisconnectedOverlay.style.display = 'flex';
  });

  wsClient.on('AUTH_OK', () => {
    // Host reconnected — hide overlay
    hostDisconnectedOverlay.style.display = 'none';
  });

  wsClient.on('GAME_ENDED', (payload) => {
    sessionStorage.setItem('scoreboard', JSON.stringify(payload.scoreboard));
    window.location.hash = '#/scoreboard';
  });

  window.addEventListener('hashchange', () => {
    drawingCanvas.destroy();
    wsClient.close();
  }, { once: true });
}
