import { DrawingCanvas } from '../canvas/DrawingCanvas';
import { mountDrawingToolbar } from '../canvas/toolbar';
import { WebSocketClient } from '../ws/WebSocketClient';

export function renderGamePlayer(app: HTMLElement): void {
  const playerId = localStorage.getItem('playerId');
  const sessionId = localStorage.getItem('playerSessionId');

  if (!playerId || !sessionId) {
    window.location.hash = '#/login';
    return;
  }

  app.innerHTML = `
    <main class="page--full">
      <div id="waiting" class="waiting-banner">En attente du début de la partie…</div>
      <p id="phrase" class="phrase-label"></p>
      <div id="canvas-container" class="canvas-container"></div>
      <div id="finish-row" class="finish-row">
        <button id="finish-drawing" type="button" class="btn btn-primary" style="width: 100%;">J'ai fini !</button>
      </div>
      <div id="draw-wait" class="overlay">
        <div>
          <p class="text-hand" style="font-size: 1.5rem;">chef-d'œuvre envoyé !</p>
          <p>L'hôte regarde les dessins…</p>
        </div>
      </div>
      <div id="host-disconnected-overlay" class="overlay">Hôte déconnecté — en attente de reconnexion…</div>
    </main>
  `;

  const waiting = app.querySelector<HTMLDivElement>('#waiting');
  const phrase = app.querySelector<HTMLParagraphElement>('#phrase');
  const canvasContainer = app.querySelector<HTMLDivElement>('#canvas-container');
  const finishRow = app.querySelector<HTMLDivElement>('#finish-row');
  const finishButton = app.querySelector<HTMLButtonElement>('#finish-drawing');
  const drawWait = app.querySelector<HTMLDivElement>('#draw-wait');
  const hostDisconnectedOverlay = app.querySelector<HTMLDivElement>('#host-disconnected-overlay');

  if (!waiting || !phrase || !canvasContainer || !finishRow || !finishButton || !drawWait || !hostDisconnectedOverlay) {
    return;
  }

  let drawingCanvas: DrawingCanvas | null = null;

  const mountCanvas = (): void => {
    if (drawingCanvas) {
      return;
    }
    const canvasEl = document.createElement('canvas');
    canvasContainer.appendChild(canvasEl);
    drawingCanvas = new DrawingCanvas(canvasEl, canvasContainer);
    mountDrawingToolbar(canvasContainer, drawingCanvas);
  };

  const goToHash = (hash: string): void => {
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  };

  const showDrawing = (): void => {
    drawWait.style.display = 'none';
    canvasContainer.style.display = '';
    finishRow.style.display = '';
  };

  const showActive = (currentPhrase: string): void => {
    waiting.style.display = 'none';
    phrase.textContent = currentPhrase;
    mountCanvas();
    showDrawing();
    goToHash('#/player/game');
  };

  const showWaiting = (): void => {
    waiting.style.display = 'block';
    phrase.textContent = '';
  };

  const wsClient = new WebSocketClient({ role: 'player', playerId, sessionId });
  wsClient.connect();

  wsClient.on('SESSION_STATE', (payload) => {
    if (payload.status === 'active') {
      showActive(payload.currentPhrase);
      const self = payload.players.find((p) => p.playerId === playerId);
      if (self?.finishedCurrentRound) {
        canvasContainer.style.display = 'none';
        finishRow.style.display = 'none';
        drawWait.style.display = 'flex';
      }
    } else if (payload.status === 'ended') {
      window.location.hash = '#/results';
    } else {
      showWaiting();
    }
  });

  wsClient.on('GAME_STARTED', (payload) => {
    showActive(payload.currentPhrase);
  });

  wsClient.on('PROMPT_UPDATED', (payload) => {
    phrase.textContent = payload.text;
  });

  wsClient.on('QUESTION_ADVANCED', () => {
    drawingCanvas?.clear();
    phrase.textContent = '';
    showDrawing();
  });

  wsClient.on('ERROR', (payload) => {
    window.dispatchEvent(new CustomEvent('ws-error', { detail: payload }));
  });

  wsClient.on('HOST_DISCONNECTED', () => {
    hostDisconnectedOverlay.style.display = 'flex';
  });

  wsClient.on('AUTH_OK', () => {
    hostDisconnectedOverlay.style.display = 'none';
  });

  wsClient.on('GAME_ENDED', () => {
    window.location.hash = '#/results';
  });

  finishButton.addEventListener('click', () => {
    wsClient.send('MARK_DRAWING_DONE', { sessionId });
    canvasContainer.style.display = 'none';
    finishRow.style.display = 'none';
    drawWait.style.display = 'flex';
  });

  window.addEventListener('hashchange', () => {
    drawingCanvas?.destroy();
    wsClient.close();
  }, { once: true });
}
