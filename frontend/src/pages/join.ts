type SessionStatus = 'lobby' | 'active' | 'ended';

export function renderJoin(app: HTMLElement): void {
  const sessionId = window.location.pathname.startsWith('/join/')
    ? window.location.pathname.slice('/join/'.length)
    : '';

  app.innerHTML = `
    <main class="page page--narrow">
      <h1>Rejoindre la partie</h1>
      <p id="status-message" class="status-text" role="status">Chargement…</p>
      <form id="join-form" class="stack" style="display: none;">
        <label class="field">
          <span>Pseudo</span>
          <input id="name" name="name" type="text" maxlength="32" required />
        </label>
        <button type="submit" class="btn btn-primary">Rejoindre</button>
      </form>
      <p id="message" class="status-text status-text--error" role="status"></p>
    </main>
  `;

  const statusMessage = app.querySelector<HTMLParagraphElement>('#status-message');
  const form = app.querySelector<HTMLFormElement>('#join-form');
  const message = app.querySelector<HTMLParagraphElement>('#message');

  if (!statusMessage || !form || !message) {
    return;
  }

  void (async () => {
    if (!sessionId) {
      statusMessage.textContent = 'Partie introuvable';
      return;
    }

    const statusResponse = await fetch(`/api/sessions/${sessionId}/status`);

    if (statusResponse.status === 404) {
      statusMessage.textContent = 'Partie introuvable';
      return;
    }

    if (!statusResponse.ok) {
      statusMessage.textContent = 'Partie introuvable';
      return;
    }

    const { status } = (await statusResponse.json()) as { status: SessionStatus };

    if (status === 'active') {
      statusMessage.textContent = 'La partie a déjà commencé';
      return;
    }

    if (status === 'ended') {
      statusMessage.textContent = 'Cette partie est terminée';
      return;
    }

    // status === 'lobby' — show the nickname form
    statusMessage.textContent = '';
    form.style.display = 'grid';
  })();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';

    const formData = new FormData(form);
    const response = await fetch(`/api/sessions/${sessionId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: String(formData.get('name') ?? ''),
      }),
    });

    const body = (await response.json()) as { playerId?: string; name?: string; error?: string };

    if (response.status === 409) {
      message.textContent = 'La partie a déjà commencé';
      return;
    }

    if (!response.ok || !body.playerId) {
      message.textContent = body.error ?? 'Impossible de rejoindre la partie';
      return;
    }

    localStorage.setItem('playerId', body.playerId);
    localStorage.setItem('playerSessionId', sessionId);

    // Navigate to the root path (not just set the hash) — we are currently at
    // /join/:sessionId, and setting only the hash would produce
    // /join/:sessionId#/player/game instead of routing through the SPA shell.
    // The small delay avoids racing the hashchange/load handler reading
    // localStorage before the write above has settled.
    setTimeout(() => {
      window.location.href = '/#/player/game';
    }, 50);
  });
}
