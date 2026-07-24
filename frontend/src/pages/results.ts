import { WebSocketClient } from '../ws/WebSocketClient';

const PODIUM_HEIGHTS = [96, 66, 46]; // rank 1, 2, 3 — rank 1 is tallest
const PODIUM_ORDER = [1, 0, 2]; // display order: rank2, rank1, rank3 (rank 1 in the middle)
const AVATAR_COLORS = ['#e8684a', '#7b68d9', '#3fa372', '#e8c25a', '#5a9be8'];

function avatarStyle(index: number, size: number): string {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return `width: ${size}px; height: ${size}px; background: ${color}; font-size: ${Math.round(size * 0.45)}px;`;
}

export function renderResults(app: HTMLElement): void {
  const token = localStorage.getItem('token');
  const hostSessionId = localStorage.getItem('hostSessionId');
  const playerId = localStorage.getItem('playerId');
  const playerSessionId = localStorage.getItem('playerSessionId');

  const isHost = Boolean(token && hostSessionId);
  const isPlayer = Boolean(playerId && playerSessionId);

  if (!isHost && !isPlayer) {
    window.location.hash = '#/login';
    return;
  }

  const sessionId = isHost ? hostSessionId! : playerSessionId!;

  app.innerHTML = `
    <main class="page page--wide">
      <div style="text-align: center;">
        <span class="text-hand" style="font-size: 1.5rem;">et le podium…</span>
        <h1>Bien joué !</h1>
      </div>
      <div id="podium" class="podium" style="display: none;"></div>
      <ul id="rest-scores" class="stack" style="display: none;"></ul>
      <ul id="participant-list" class="roster" style="display: none;"></ul>
      <div id="host-actions" class="stack" style="display: none; margin-top: auto;">
        <button id="replay" type="button" class="btn btn-primary">On rejoue !</button>
        <button id="back-to-hub" type="button" class="btn btn-secondary">Retour à la bibliothèque</button>
      </div>
    </main>
  `;

  const podium = app.querySelector<HTMLDivElement>('#podium');
  const restScores = app.querySelector<HTMLUListElement>('#rest-scores');
  const participantList = app.querySelector<HTMLUListElement>('#participant-list');
  const hostActions = app.querySelector<HTMLDivElement>('#host-actions');
  const replayButton = app.querySelector<HTMLButtonElement>('#replay');
  const backToHubButton = app.querySelector<HTMLButtonElement>('#back-to-hub');

  if (!podium || !restScores || !participantList || !hostActions || !replayButton || !backToHubButton) {
    return;
  }

  const wsClient = new WebSocketClient(
    isHost ? { role: 'host', token: token!, sessionId } : { role: 'player', playerId: playerId!, sessionId },
  );
  wsClient.connect();

  wsClient.on('SESSION_STATE', (payload) => {
    const ranked = [...payload.players]
      .map((p) => ({ ...p, totalPoints: payload.cumulativeScores[p.playerId] ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    if (payload.settings.pointsEnabled) {
      participantList.style.display = 'none';
      podium.style.display = 'flex';
      restScores.style.display = ranked.length > 3 ? 'grid' : 'none';

      podium.innerHTML = '';
      const top3 = ranked.slice(0, 3);
      for (const displayIndex of PODIUM_ORDER) {
        const entry = top3[displayIndex];
        if (!entry) continue;
        const item = document.createElement('div');
        item.className = 'podium-item';
        item.dataset.playerName = entry.name;
        item.innerHTML = `
          <span class="avatar" style="${avatarStyle(displayIndex, 46)}">${entry.name[0]?.toUpperCase() ?? '?'}</span>
          <span>${entry.name}</span>
          <span data-role="points" class="text-muted" style="font-size: var(--font-size-sm);">${entry.totalPoints} pts</span>
          <div class="podium-bar" style="height: ${PODIUM_HEIGHTS[displayIndex]}px;">${displayIndex + 1}</div>
        `;
        podium.appendChild(item);
      }

      restScores.innerHTML = '';
      ranked.slice(3).forEach((entry, i) => {
        const li = document.createElement('li');
        li.className = 'roster-item';
        li.dataset.playerName = entry.name;
        li.innerHTML = `
          <span>${i + 4}. ${entry.name}</span>
          <span data-role="points" class="text-muted">${entry.totalPoints} pts</span>
        `;
        restScores.appendChild(li);
      });
    } else {
      podium.style.display = 'none';
      restScores.style.display = 'none';
      participantList.style.display = 'grid';
      participantList.innerHTML = '';
      for (const player of payload.players) {
        const li = document.createElement('li');
        li.className = 'roster-item';
        li.dataset.playerName = player.name;
        li.innerHTML = `<span data-role="name">${player.name}</span>`;
        participantList.appendChild(li);
      }
    }

    hostActions.style.display = isHost ? 'grid' : 'none';
  });

  wsClient.on('ERROR', (payload) => {
    window.dispatchEvent(new CustomEvent('ws-error', { detail: payload }));
  });

  replayButton.addEventListener('click', async () => {
    if (!isHost) return;
    replayButton.disabled = true;

    const rawSettings = localStorage.getItem('lastSessionSettings');
    const settings = rawSettings ? JSON.parse(rawSettings) : {};

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      replayButton.disabled = false;
      return;
    }

    const { sessionId: newSessionId } = (await response.json()) as { sessionId: string };
    localStorage.setItem('hostSessionId', newSessionId);
    window.location.hash = '#/host/lobby';
  });

  backToHubButton.addEventListener('click', () => {
    if (!isHost) return;
    localStorage.removeItem('hostSessionId');
    window.location.hash = '#/host/hub';
  });

  window.addEventListener('hashchange', () => {
    wsClient.close();
  }, { once: true });
}
