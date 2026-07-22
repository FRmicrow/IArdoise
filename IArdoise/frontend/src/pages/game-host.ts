import { WebSocketClient } from '../ws/WebSocketClient';
import { DrawingCanvas } from '../canvas/DrawingCanvas';

export function renderGameHost(app: HTMLElement): void {
  const token = sessionStorage.getItem('token');
  const sessionId = sessionStorage.getItem('hostSessionId');

  if (!token || !sessionId) {
    window.location.hash = '#/login';
    return;
  }

  app.innerHTML = `
    <main style="padding: 24px; display: grid; gap: 16px; max-width: 720px; margin: 0 auto;">
      <h1>Host Game</h1>
      <div style="display: flex; gap: 8px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">
        <button id="tab-controls" type="button" data-tab="controls" style="font-weight: bold;">Controls</button>
        <button id="tab-canvas" type="button" data-tab="canvas">My Canvas</button>
      </div>
      <div id="panel-controls">
        <label style="display: grid; gap: 8px; margin-bottom: 12px;">
          <span>Prompt</span>
          <input id="prompt-input" type="text" maxlength="200" placeholder="Type the next prompt" />
        </label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
          <button id="next-question" type="button">Next Question</button>
          <button id="end-game" type="button">End Game</button>
        </div>
        <ul id="player-list" style="display: grid; gap: 8px; list-style: none; padding: 0;"></ul>
      </div>
      <div id="panel-canvas" style="display: none; position: relative; height: 60vh;">
        <canvas id="host-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
      </div>
      <p id="status" role="status"></p>
    </main>
  `;

  const playerList = app.querySelector<HTMLUListElement>('#player-list');
  const promptInput = app.querySelector<HTMLInputElement>('#prompt-input');
  const nextQuestion = app.querySelector<HTMLButtonElement>('#next-question');
  const endGame = app.querySelector<HTMLButtonElement>('#end-game');
  const status = app.querySelector<HTMLParagraphElement>('#status');
  const tabControls = app.querySelector<HTMLButtonElement>('#tab-controls');
  const tabCanvas = app.querySelector<HTMLButtonElement>('#tab-canvas');
  const panelControls = app.querySelector<HTMLDivElement>('#panel-controls');
  const panelCanvas = app.querySelector<HTMLDivElement>('#panel-canvas');
  const hostCanvasEl = app.querySelector<HTMLCanvasElement>('#host-canvas');

  if (!playerList || !promptInput || !nextQuestion || !endGame || !status || !tabControls || !tabCanvas || !panelControls || !panelCanvas || !hostCanvasEl) {
    return;
  }

  const wsClient = new WebSocketClient({ role: 'host', token, sessionId });
  wsClient.connect();

  // Tab switching
  let drawingCanvas: DrawingCanvas | null = null;

  const switchTab = (tab: 'controls' | 'canvas'): void => {
    if (tab === 'controls') {
      panelControls.style.display = 'block';
      panelCanvas.style.display = 'none';
      tabControls.style.fontWeight = 'bold';
      tabCanvas.style.fontWeight = '';
    } else {
      panelControls.style.display = 'none';
      panelCanvas.style.display = 'block';
      tabControls.style.fontWeight = '';
      tabCanvas.style.fontWeight = 'bold';
      // Initialise canvas lazily on first activation
      if (!drawingCanvas) {
        drawingCanvas = new DrawingCanvas(hostCanvasEl, panelCanvas);
      }
    }
  };

  tabControls.addEventListener('click', () => switchTab('controls'));
  tabCanvas.addEventListener('click', () => switchTab('canvas'));

  let promptDebounceId: number | undefined;

  const renderPlayers = (players: Array<{ playerId: string; name: string; score: number }>): void => {
    playerList.innerHTML = '';

    for (const player of players) {
      const item = document.createElement('li');
      item.dataset.playerId = player.playerId;
      item.style.display = 'grid';
      item.style.gridTemplateColumns = '1fr auto auto auto';
      item.style.gap = '8px';
      item.innerHTML = `
        <span>${player.name}</span>
        <span data-role="score">${player.score}</span>
        <button type="button" data-action="decrement">−</button>
        <button type="button" data-action="increment">+</button>
      `;
      playerList.appendChild(item);
    }
  };

  const updateScore = (playerId: string, score: number): void => {
    const item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${playerId}"]`);
    const scoreNode = item?.querySelector<HTMLSpanElement>('[data-role="score"]');
    if (scoreNode) {
      scoreNode.textContent = String(score);
    }
  };

  wsClient.on('SESSION_STATE', (payload) => {
    promptInput.value = payload.currentPrompt;
    renderPlayers(payload.players.map((player) => ({
      playerId: player.playerId,
      name: player.name,
      score: player.score,
    })));
  });

  wsClient.on('PLAYER_JOINED', (payload) => {
    const players = Array.from(playerList.querySelectorAll<HTMLLIElement>('li')).map((item) => ({
      playerId: item.dataset.playerId ?? '',
      name: item.querySelector('span')?.textContent ?? '',
      score: Number(item.querySelector('[data-role="score"]')?.textContent ?? '0'),
    }));
    players.push({ playerId: payload.playerId, name: payload.name, score: payload.score });
    renderPlayers(players);
  });

  wsClient.on('SCORE_UPDATED', (payload) => {
    updateScore(payload.playerId, payload.newScore);
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

  wsClient.on('GAME_ENDED', (payload) => {
    sessionStorage.setItem('scoreboard', JSON.stringify(payload.scoreboard));
    window.location.hash = '#/scoreboard';
  });

  playerList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) {
      return;
    }

    const item = target.closest<HTMLLIElement>('li');
    const playerId = item?.dataset.playerId;
    if (!playerId) {
      return;
    }

    wsClient.send('UPDATE_SCORE', {
      sessionId,
      playerId,
      delta: action === 'increment' ? 1 : -1,
    });
  });

  promptInput.addEventListener('input', () => {
    window.clearTimeout(promptDebounceId);
    promptDebounceId = window.setTimeout(() => {
      wsClient.send('SET_PROMPT', {
        sessionId,
        text: promptInput.value,
      });
    }, 300);
  });

  nextQuestion.addEventListener('click', () => {
    wsClient.send('NEXT_QUESTION', { sessionId });
  });

  endGame.addEventListener('click', () => {
    if (!window.confirm('End the game?')) {
      return;
    }
    wsClient.send('END_GAME', { sessionId });
    status.textContent = 'Ending game…';
  });

  window.addEventListener('hashchange', () => {
    wsClient.close();
    drawingCanvas?.destroy();
  }, { once: true });
}
