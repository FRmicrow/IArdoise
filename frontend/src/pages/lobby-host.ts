import { WebSocketClient } from '../ws/WebSocketClient';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function clearHostSession(): void {
  localStorage.removeItem('hostSessionId');
}

export function renderLobbyHost(app: HTMLElement): void {
  const token = getToken();
  if (!token) {
    window.location.hash = '#/login';
    return;
  }

  // The session is created by the config screen (004, US1) — arriving here
  // without one means the flow was skipped (direct nav, stale bookmark).
  const sessionId = localStorage.getItem('hostSessionId');
  if (!sessionId) {
    window.location.hash = '#/host/config';
    return;
  }

  app.innerHTML = `
    <main class="page page--wide">
      <h1>Fais scanner !</h1>
      <div id="session-section" class="stack">
        <p class="join-url" id="join-url"></p>
        <img id="qr-code" class="qr-code" alt="QR code de la partie" />
        <section>
          <div class="row" style="justify-content: space-between;">
            <h2>Joueurs</h2>
            <span id="player-count-label" class="text-muted"></span>
          </div>
          <ul id="player-list" class="roster"></ul>
        </section>
        <button id="start-game" type="button" class="btn btn-primary" disabled>Commencer la partie</button>
        <div id="join-as-player-section" style="display: none;">
          <button id="join-as-player-btn" type="button" class="btn btn-secondary">Rejoindre en tant que joueur</button>
          <div id="join-as-player-form" class="row" style="display: none;">
            <input id="host-player-name" type="text" maxlength="32" placeholder="Votre pseudo" />
            <button id="host-player-submit" type="button" class="btn">Rejoindre</button>
            <button id="host-player-cancel" type="button" class="btn btn-secondary">Annuler</button>
          </div>
        </div>
      </div>
      <p id="status" class="status-text" role="status"></p>
    </main>
  `;

  const status = app.querySelector<HTMLParagraphElement>('#status');
  const joinUrlEl = app.querySelector<HTMLParagraphElement>('#join-url');
  const qrCode = app.querySelector<HTMLImageElement>('#qr-code');
  const playerList = app.querySelector<HTMLUListElement>('#player-list');
  const playerCountLabel = app.querySelector<HTMLSpanElement>('#player-count-label');
  const startGameButton = app.querySelector<HTMLButtonElement>('#start-game');
  const joinAsPlayerSection = app.querySelector<HTMLDivElement>('#join-as-player-section');
  const joinAsPlayerBtn = app.querySelector<HTMLButtonElement>('#join-as-player-btn');
  const joinAsPlayerForm = app.querySelector<HTMLDivElement>('#join-as-player-form');
  const hostPlayerName = app.querySelector<HTMLInputElement>('#host-player-name');
  const hostPlayerSubmit = app.querySelector<HTMLButtonElement>('#host-player-submit');
  const hostPlayerCancel = app.querySelector<HTMLButtonElement>('#host-player-cancel');

  if (
    !status || !joinUrlEl || !qrCode || !playerList || !playerCountLabel ||
    !startGameButton || !joinAsPlayerSection || !joinAsPlayerBtn || !joinAsPlayerForm ||
    !hostPlayerName || !hostPlayerSubmit || !hostPlayerCancel
  ) {
    return;
  }

  let wsClient: WebSocketClient | null = null;
  let hasJoinedAsPlayer = false;
  let maxPlayers = 8;

  const syncStartButtonState = (): void => {
    startGameButton.disabled = playerList.children.length === 0;
  };

  const syncPlayerCountLabel = (): void => {
    playerCountLabel.textContent = `${playerList.children.length}/${maxPlayers} joueurs`;
  };

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
    syncStartButtonState();
    syncPlayerCountLabel();
  };

  const markConnectionStatus = (playerId: string, connectionStatus: 'connected' | 'disconnected'): void => {
    const item = playerList.querySelector<HTMLLIElement>(`[data-player-id="${playerId}"]`);
    if (!item) return;
    item.dataset.connectionStatus = connectionStatus;
    const tagEl = item.querySelector<HTMLSpanElement>('[data-role="tag"]');
    if (tagEl) tagEl.textContent = connectionStatus === 'disconnected' ? 'déconnecté' : '';
  };

  joinUrlEl.textContent = `${window.location.origin}/join/${sessionId}`;

  void fetch(`/api/sessions/${sessionId}/qr`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (qrResponse) => {
    if (qrResponse.ok) {
      const qr = (await qrResponse.json()) as { dataUrl: string };
      qrCode.src = qr.dataUrl;
      qrCode.style.display = 'block';
    }
  });

  const connectSocket = (): void => {
    wsClient?.close();
    wsClient = new WebSocketClient({ role: 'host', token, sessionId });
    wsClient.connect();

    joinAsPlayerSection.style.display = 'block';

    wsClient.on('AUTH_ERROR', () => {
      clearHostSession();
      window.location.hash = '#/host/config';
    });

    wsClient.on('SESSION_STATE', (payload) => {
      maxPlayers = payload.settings.maxPlayers;
      playerList.innerHTML = '';
      for (const player of payload.players) {
        upsertPlayer(player.playerId, player.name, player.connectionStatus);
      }
      syncStartButtonState();
      syncPlayerCountLabel();

      if (payload.status === 'active') {
        window.location.hash = '#/host/game';
      } else if (payload.status === 'ended') {
        window.location.hash = '#/results';
      }
    });

    wsClient.on('PLAYER_JOINED', (payload) => {
      upsertPlayer(payload.playerId, payload.name);
    });

    wsClient.on('PLAYER_DISCONNECTED', (payload) => {
      markConnectionStatus(payload.playerId, 'disconnected');
    });

    wsClient.on('PLAYER_RECONNECTED', (payload) => {
      markConnectionStatus(payload.playerId, 'connected');
    });

    wsClient.on('GAME_STARTED', () => {
      window.location.hash = '#/host/game';
    });

    wsClient.on('GAME_ENDED', () => {
      window.location.hash = '#/results';
    });

    wsClient.on('ERROR', (payload) => {
      window.dispatchEvent(new CustomEvent('ws-error', { detail: payload }));
    });
  };

  startGameButton.addEventListener('click', () => {
    if (!wsClient || startGameButton.disabled) {
      return;
    }
    wsClient.send('START_GAME', { sessionId });
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
    const name = hostPlayerName.value.trim();
    if (!wsClient || !name) {
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

  connectSocket();
}
