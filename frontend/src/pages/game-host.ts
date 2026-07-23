import { WebSocketClient } from '../ws/WebSocketClient';
import { DrawingCanvas } from '../canvas/DrawingCanvas';

export function renderGameHost(app: HTMLElement): void {
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('hostSessionId');

  if (!token || !sessionId) {
    window.location.hash = '#/login';
    return;
  }

  app.innerHTML = `
    <main class="page page--wide">
      <h1>Partie en cours</h1>
      <div class="tabs">
        <button id="tab-controls" type="button" class="tab tab--active" data-tab="controls">Contrôles</button>
        <button id="tab-canvas" type="button" class="tab" data-tab="canvas">Mon canevas</button>
      </div>
      <div id="panel-controls" class="stack">
        <form id="prompt-form" class="row">
          <label class="field" style="flex: 1;">
            <span>Nouvelle phrase</span>
            <input id="prompt-input" type="text" maxlength="200" placeholder="Nouvelle phrase pour les joueurs" />
          </label>
          <button type="submit" class="btn btn-primary">Valider</button>
        </form>
        <div class="row">
          <button id="next-question" type="button" class="btn btn-secondary">Question suivante</button>
          <button id="end-game" type="button" class="btn">Terminer la partie</button>
        </div>
        <section>
          <h2>Joueurs</h2>
          <ul id="player-list" class="roster"></ul>
        </section>
      </div>
      <div id="panel-canvas" class="canvas-container" style="display: none; height: 60vh;">
        <canvas id="host-canvas"></canvas>
      </div>
      <p id="status" class="status-text" role="status"></p>
    </main>
  `;

  const playerList = app.querySelector<HTMLUListElement>('#player-list');
  const promptForm = app.querySelector<HTMLFormElement>('#prompt-form');
  const promptInput = app.querySelector<HTMLInputElement>('#prompt-input');
  const nextQuestion = app.querySelector<HTMLButtonElement>('#next-question');
  const endGame = app.querySelector<HTMLButtonElement>('#end-game');
  const status = app.querySelector<HTMLParagraphElement>('#status');
  const tabControls = app.querySelector<HTMLButtonElement>('#tab-controls');
  const tabCanvas = app.querySelector<HTMLButtonElement>('#tab-canvas');
  const panelControls = app.querySelector<HTMLDivElement>('#panel-controls');
  const panelCanvas = app.querySelector<HTMLDivElement>('#panel-canvas');
  const hostCanvasEl = app.querySelector<HTMLCanvasElement>('#host-canvas');

  if (
    !playerList || !promptForm || !promptInput || !nextQuestion || !endGame || !status ||
    !tabControls || !tabCanvas || !panelControls || !panelCanvas || !hostCanvasEl
  ) {
    return;
  }

  const wsClient = new WebSocketClient({ role: 'host', token, sessionId });
  wsClient.connect();

  let drawingCanvas: DrawingCanvas | null = null;

  const switchTab = (tab: 'controls' | 'canvas'): void => {
    if (tab === 'controls') {
      panelControls.style.display = 'grid';
      panelCanvas.style.display = 'none';
      tabControls.classList.add('tab--active');
      tabCanvas.classList.remove('tab--active');
    } else {
      panelControls.style.display = 'none';
      panelCanvas.style.display = 'block';
      tabControls.classList.remove('tab--active');
      tabCanvas.classList.add('tab--active');
      if (!drawingCanvas) {
        drawingCanvas = new DrawingCanvas(hostCanvasEl, panelCanvas);
      }
    }
  };

  tabControls.addEventListener('click', () => switchTab('controls'));
  tabCanvas.addEventListener('click', () => switchTab('canvas'));

  const upsertPlayer = (playerId: string, name: string, connectionStatus: 'connected' | 'disconnected' = 'connected'): void => {
    let item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${playerId}"]`);
    if (!item) {
      item = document.createElement('li');
      item.className = 'roster-item';
      item.dataset.playerId = playerId;
      item.innerHTML = `<span data-role="name"></span><span class="tag" data-role="tag"></span>`;
      playerList.appendChild(item);
    }
    item.dataset.connectionStatus = connectionStatus;
    const nameEl = item.querySelector<HTMLSpanElement>('[data-role="name"]');
    const tagEl = item.querySelector<HTMLSpanElement>('[data-role="tag"]');
    if (nameEl) nameEl.textContent = name;
    if (tagEl) tagEl.textContent = connectionStatus === 'disconnected' ? 'déconnecté' : '';
  };

  wsClient.on('SESSION_STATE', (payload) => {
    promptInput.value = payload.currentPhrase;
    playerList.innerHTML = '';
    for (const player of payload.players) {
      upsertPlayer(player.playerId, player.name, player.connectionStatus);
    }
  });

  wsClient.on('PLAYER_JOINED', (payload) => {
    upsertPlayer(payload.playerId, payload.name);
  });

  wsClient.on('PLAYER_DISCONNECTED', (payload) => {
    const item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${payload.playerId}"]`);
    if (item) {
      item.dataset.connectionStatus = 'disconnected';
      const tagEl = item.querySelector<HTMLSpanElement>('[data-role="tag"]');
      if (tagEl) tagEl.textContent = 'déconnecté';
    }
  });

  wsClient.on('PLAYER_RECONNECTED', (payload) => {
    const item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${payload.playerId}"]`);
    if (item) {
      item.dataset.connectionStatus = 'connected';
      const tagEl = item.querySelector<HTMLSpanElement>('[data-role="tag"]');
      if (tagEl) tagEl.textContent = '';
    }
  });

  wsClient.on('PROMPT_UPDATED', (payload) => {
    promptInput.value = payload.text;
  });

  wsClient.on('QUESTION_ADVANCED', () => {
    promptInput.value = '';
    drawingCanvas?.clear();
  });

  wsClient.on('ERROR', (payload) => {
    window.dispatchEvent(new CustomEvent('ws-error', { detail: payload }));
  });

  wsClient.on('GAME_ENDED', () => {
    window.location.hash = '#/closing';
  });

  promptForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = promptInput.value.trim();
    if (!text) {
      return;
    }
    wsClient.send('SET_PROMPT', { sessionId, text });
  });

  nextQuestion.addEventListener('click', () => {
    wsClient.send('NEXT_QUESTION', { sessionId });
  });

  endGame.addEventListener('click', () => {
    if (!window.confirm('Terminer la partie ?')) {
      return;
    }
    wsClient.send('END_GAME', { sessionId });
    status.textContent = 'Fin de la partie…';
  });

  window.addEventListener('hashchange', () => {
    wsClient.close();
    drawingCanvas?.destroy();
  }, { once: true });
}
