import { WebSocketClient } from '../ws/WebSocketClient';

function setHostSession(sessionId: string): void {
  sessionStorage.setItem('hostSessionId', sessionId);
}

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

export function renderLobbyHost(app: HTMLElement): void {
  const token = getToken();
  if (!token) {
    window.location.hash = '#/login';
    return;
  }

  app.innerHTML = `
    <main style="padding: 24px; display: grid; gap: 16px; max-width: 720px; margin: 0 auto;">
      <h1>Host Lobby</h1>
      <button id="new-game" type="button">New Game</button>
      <button id="start-game" type="button" disabled>Start Game</button>
      <label style="display: grid; gap: 8px;">
        <span>Prompt</span>
        <input id="prompt-input" type="text" maxlength="200" placeholder="Type a prompt for players" />
      </label>
      <p id="current-prompt"></p>
      <p id="join-url"></p>
      <img id="qr-code" alt="Session QR code" style="max-width: 280px; width: 100%; display: none; background: #fff; padding: 12px;" />
      <section>
        <h2>Players</h2>
        <ul id="player-list" style="display: grid; gap: 8px; padding-left: 20px;"></ul>
      </section>
      <div id="join-as-player-section" style="display: none;">
        <button id="join-as-player-btn" type="button">Join as Player</button>
        <div id="join-as-player-form" style="display: none; gap: 8px; align-items: center;">
          <input id="host-player-name" type="text" maxlength="32" placeholder="Your display name" style="flex: 1;" />
          <button id="host-player-submit" type="button">Join</button>
          <button id="host-player-cancel" type="button">Cancel</button>
        </div>
      </div>
      <p id="status" role="status"></p>
    </main>
  `;

  const status = app.querySelector<HTMLParagraphElement>('#status');
  const joinUrl = app.querySelector<HTMLParagraphElement>('#join-url');
  const qrCode = app.querySelector<HTMLImageElement>('#qr-code');
  const playerList = app.querySelector<HTMLUListElement>('#player-list');
  const newGameButton = app.querySelector<HTMLButtonElement>('#new-game');
  const startGameButton = app.querySelector<HTMLButtonElement>('#start-game');
  const promptInput = app.querySelector<HTMLInputElement>('#prompt-input');
  const currentPrompt = app.querySelector<HTMLParagraphElement>('#current-prompt');
  const joinAsPlayerSection = app.querySelector<HTMLDivElement>('#join-as-player-section');
  const joinAsPlayerBtn = app.querySelector<HTMLButtonElement>('#join-as-player-btn');
  const joinAsPlayerForm = app.querySelector<HTMLDivElement>('#join-as-player-form');
  const hostPlayerName = app.querySelector<HTMLInputElement>('#host-player-name');
  const hostPlayerSubmit = app.querySelector<HTMLButtonElement>('#host-player-submit');
  const hostPlayerCancel = app.querySelector<HTMLButtonElement>('#host-player-cancel');

  if (!status || !joinUrl || !qrCode || !playerList || !newGameButton || !startGameButton || !promptInput || !currentPrompt || !joinAsPlayerSection || !joinAsPlayerBtn || !joinAsPlayerForm || !hostPlayerName || !hostPlayerSubmit || !hostPlayerCancel) {
    return;
  }

  let wsClient: WebSocketClient | null = null;
  let promptDebounceId: number | undefined;
  let hasJoinedAsPlayer = false;

  const syncStartButtonState = (): void => {
    startGameButton.disabled = playerList.children.length === 0;
  };

  const upsertPlayer = (playerId: string, name: string, suffix = ''): void => {
    let item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${playerId}"]`);
    if (!item) {
      item = document.createElement('li');
      item.dataset.playerId = playerId;
      playerList.appendChild(item);
    }
    item.textContent = `${name}${suffix}`;
    syncStartButtonState();
  };

  const markDisconnected = (playerId: string): void => {
    const item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${playerId}"]`);
    if (item) {
      item.textContent = `${item.textContent?.replace(' (disconnected)', '') ?? ''} (disconnected)`;
    }
  };

  const connectSocket = (sessionId: string): void => {
    wsClient?.close();
    wsClient = new WebSocketClient({ role: 'host', token, sessionId });
    wsClient.connect();

    // Show "Join as Player" section once a session is active
    joinAsPlayerSection.style.display = 'block';

    wsClient.on('SESSION_STATE', (payload) => {
      playerList.innerHTML = '';
      currentPrompt.textContent = payload.currentPrompt;
      promptInput.value = payload.currentPrompt;
      for (const player of payload.players) {
        upsertPlayer(
          player.playerId,
          player.name,
          player.connectionStatus === 'disconnected' ? ' (disconnected)' : '',
        );
      }
      syncStartButtonState();
    });

    wsClient.on('PLAYER_JOINED', (payload) => {
      upsertPlayer(payload.playerId, payload.name);
    });

    wsClient.on('PLAYER_DISCONNECTED', (payload) => {
      markDisconnected(payload.playerId);
    });

    wsClient.on('PLAYER_RECONNECTED', (payload) => {
      const item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${payload.playerId}"]`);
      if (item) {
        item.textContent = item.textContent?.replace(' (disconnected)', '') ?? '';
      }
    });

    wsClient.on('PROMPT_UPDATED', (payload) => {
      currentPrompt.textContent = payload.text;
      promptInput.value = payload.text;
    });

    wsClient.on('GAME_STARTED', () => {
      window.location.hash = '#/host/game';
    });

    wsClient.on('GAME_ENDED', (payload) => {
      sessionStorage.setItem('scoreboard', JSON.stringify(payload.scoreboard));
      window.location.hash = '#/scoreboard';
    });
  };

  newGameButton.addEventListener('click', async () => {
    status.textContent = 'Creating session…';

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      status.textContent = body.error ?? 'Unable to create session';
      return;
    }

    const { sessionId, joinUrl: joinUrlValue } = (await response.json()) as {
      sessionId: string;
      joinUrl: string;
    };

    setHostSession(sessionId);
    joinUrl.textContent = joinUrlValue;
    status.textContent = 'Session created';

    const qrResponse = await fetch(`/api/sessions/${sessionId}/qr`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (qrResponse.ok) {
      const qr = (await qrResponse.json()) as { dataUrl: string };
      qrCode.src = qr.dataUrl;
      qrCode.style.display = 'block';
    }

    connectSocket(sessionId);
  });

  startGameButton.addEventListener('click', () => {
    const sessionId = sessionStorage.getItem('hostSessionId');
    if (!wsClient || !sessionId || startGameButton.disabled) {
      return;
    }

    wsClient.send('START_GAME', { sessionId });
  });

  promptInput.addEventListener('input', () => {
    const sessionId = sessionStorage.getItem('hostSessionId');
    if (!wsClient || !sessionId) {
      return;
    }

    currentPrompt.textContent = promptInput.value;
    window.clearTimeout(promptDebounceId);
    promptDebounceId = window.setTimeout(() => {
      wsClient?.send('SET_PROMPT', {
        sessionId,
        text: promptInput.value,
      });
    }, 300);
  });

  joinAsPlayerBtn.addEventListener('click', () => {
    joinAsPlayerBtn.style.display = 'none';
    joinAsPlayerForm.style.display = 'flex';
    hostPlayerName.focus();
  });

  hostPlayerCancel.addEventListener('click', () => {
    joinAsPlayerForm.style.display = 'none';
    joinAsPlayerBtn.style.display = hasJoinedAsPlayer ? 'none' : 'inline-block';
    hostPlayerName.value = '';
  });

  const submitHostAsPlayer = (): void => {
    const sessionId = sessionStorage.getItem('hostSessionId');
    const name = hostPlayerName.value.trim();
    if (!wsClient || !sessionId || !name) {
      return;
    }
    wsClient.send('HOST_JOIN_AS_PLAYER', { sessionId, name });
    hasJoinedAsPlayer = true;
    joinAsPlayerForm.style.display = 'none';
    joinAsPlayerBtn.style.display = 'none';
    hostPlayerName.value = '';
  };

  hostPlayerSubmit.addEventListener('click', submitHostAsPlayer);

  hostPlayerName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submitHostAsPlayer();
    }
  });
}
