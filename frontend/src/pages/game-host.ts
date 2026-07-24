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
      <div class="row" style="justify-content: space-between; align-items: baseline;">
        <h1 id="round-counter">Partie en cours</h1>
        <span id="round-timer" class="badge" data-tone="accent"></span>
      </div>
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
          <button id="next-question" type="button" class="btn btn-secondary">Manche suivante</button>
          <button id="end-game" type="button" class="btn btn-ink">Terminer la partie</button>
        </div>
        <section>
          <h2>Joueurs</h2>
          <ul id="player-list" class="roster"></ul>
        </section>
        <section id="scoring-section" style="display: none;">
          <h2>Notation de la manche</h2>
          <ul id="scoring-list" class="stack"></ul>
          <button id="submit-scores" type="button" class="btn btn-primary">Valider les points</button>
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
  const roundCounterEl = app.querySelector<HTMLHeadingElement>('#round-counter');
  const roundTimerEl = app.querySelector<HTMLSpanElement>('#round-timer');
  const scoringSection = app.querySelector<HTMLDivElement>('#scoring-section');
  const scoringList = app.querySelector<HTMLUListElement>('#scoring-list');
  const submitScores = app.querySelector<HTMLButtonElement>('#submit-scores');

  if (
    !playerList || !promptForm || !promptInput || !nextQuestion || !endGame || !status ||
    !tabControls || !tabCanvas || !panelControls || !panelCanvas || !hostCanvasEl ||
    !roundCounterEl || !roundTimerEl || !scoringSection || !scoringList || !submitScores
  ) {
    return;
  }

  const wsClient = new WebSocketClient({ role: 'host', token, sessionId });
  wsClient.connect();

  let drawingCanvas: DrawingCanvas | null = null;

  // ── Round counter + host-local countdown (004, FR-006/FR-007/FR-009) ─────────
  // The countdown is purely informational and never broadcast — see
  // research.md's "Round timer is host-local and purely visual" decision.
  let roundDurationSec = 60;
  let maxRounds = 3;
  let currentRoundIndex = 0;
  let countdownRemaining = 0;
  let countdownIntervalId: ReturnType<typeof setInterval> | null = null;

  const formatCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const renderRoundCounter = (roundIndex: number): void => {
    roundCounterEl.textContent = `Manche ${roundIndex + 1}/${maxRounds}`;
    nextQuestion.disabled = roundIndex + 1 >= maxRounds;
  };

  const startCountdown = (): void => {
    if (countdownIntervalId !== null) {
      clearInterval(countdownIntervalId);
    }
    countdownRemaining = roundDurationSec;
    roundTimerEl.textContent = formatCountdown(countdownRemaining);
    countdownIntervalId = setInterval(() => {
      countdownRemaining = Math.max(0, countdownRemaining - 1);
      roundTimerEl.textContent = formatCountdown(countdownRemaining);
      if (countdownRemaining <= 0 && countdownIntervalId !== null) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
      }
    }, 1000);
  };

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

  // ── Round scoring (004, FR-011/FR-012/FR-013) — in-person, free-form points ──
  const upsertScoreRow = (playerId: string, name: string, finished: boolean): void => {
    let item = scoringList.querySelector<HTMLLIElement>(`[data-player-id="${playerId}"]`);
    if (!item) {
      item = document.createElement('li');
      item.className = 'roster-item';
      item.dataset.playerId = playerId;
      item.dataset.playerName = name;
      item.innerHTML = `
        <span style="display: flex; flex-direction: column;">
          <span>${name}</span>
          <span class="tag" data-role="points-status"></span>
        </span>
        <input type="number" min="0" value="0" data-role="points-input" style="width: 64px; min-height: 36px;" />
      `;
      scoringList.appendChild(item);
    }
    const statusEl = item.querySelector<HTMLSpanElement>('[data-role="points-status"]');
    if (statusEl) statusEl.textContent = finished ? 'a terminé ✓' : 'dessine…';
  };

  const resetScoringRound = (): void => {
    for (const item of Array.from(scoringList.querySelectorAll<HTMLLIElement>('[data-player-id]'))) {
      const statusEl = item.querySelector<HTMLSpanElement>('[data-role="points-status"]');
      const inputEl = item.querySelector<HTMLInputElement>('[data-role="points-input"]');
      if (statusEl) statusEl.textContent = 'dessine…';
      if (inputEl) inputEl.value = '0';
    }
  };

  wsClient.on('SESSION_STATE', (payload) => {
    promptInput.value = payload.currentPhrase;
    playerList.innerHTML = '';
    for (const player of payload.players) {
      upsertPlayer(player.playerId, player.name, player.connectionStatus);
      upsertScoreRow(player.playerId, player.name, player.finishedCurrentRound);
    }
    roundDurationSec = payload.settings.roundDurationSec;
    maxRounds = payload.settings.maxRounds;
    currentRoundIndex = payload.roundIndex;
    scoringSection.style.display = payload.settings.pointsEnabled ? 'block' : 'none';
    renderRoundCounter(payload.roundIndex);
    if (payload.status === 'active' && countdownIntervalId === null) {
      startCountdown();
    }
  });

  wsClient.on('PLAYER_JOINED', (payload) => {
    upsertPlayer(payload.playerId, payload.name);
    upsertScoreRow(payload.playerId, payload.name, false);
  });

  wsClient.on('PLAYER_FINISHED', (payload) => {
    const item = scoringList.querySelector<HTMLLIElement>(`[data-player-id="${payload.playerId}"]`);
    const statusEl = item?.querySelector<HTMLSpanElement>('[data-role="points-status"]');
    if (statusEl) statusEl.textContent = 'a terminé ✓';
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

  wsClient.on('QUESTION_ADVANCED', (payload) => {
    promptInput.value = '';
    drawingCanvas?.clear();
    maxRounds = payload.maxRounds;
    currentRoundIndex = payload.roundIndex;
    renderRoundCounter(payload.roundIndex);
    resetScoringRound();
    startCountdown();
  });

  wsClient.on('ERROR', (payload) => {
    window.dispatchEvent(new CustomEvent('ws-error', { detail: payload }));
  });

  wsClient.on('GAME_ENDED', () => {
    window.location.hash = '#/results';
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

  submitScores.addEventListener('click', () => {
    const points: Record<string, number> = {};
    for (const item of Array.from(scoringList.querySelectorAll<HTMLLIElement>('[data-player-id]'))) {
      const playerId = item.dataset['playerId'];
      const inputEl = item.querySelector<HTMLInputElement>('[data-role="points-input"]');
      if (!playerId || !inputEl) continue;
      points[playerId] = Math.max(0, Math.round(Number(inputEl.value) || 0));
    }
    if (Object.keys(points).length === 0) return;
    wsClient.send('AWARD_ROUND_POINTS', { sessionId, roundIndex: currentRoundIndex, points });
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
    if (countdownIntervalId !== null) {
      clearInterval(countdownIntervalId);
    }
  }, { once: true });
}
