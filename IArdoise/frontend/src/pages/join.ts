export function renderJoin(app: HTMLElement): void {
  const sessionId = window.location.pathname.startsWith('/join/')
    ? window.location.pathname.slice('/join/'.length)
    : sessionStorage.getItem('hostSessionId') ?? '';

  app.innerHTML = `
    <main style="padding: 24px; max-width: 420px; margin: 0 auto; display: grid; gap: 12px;">
      <h1>Join Game</h1>
      <form id="join-form" style="display: grid; gap: 12px;">
        <label>
          Name
          <input id="name" name="name" maxlength="32" required />
        </label>
        <button type="submit">Join</button>
      </form>
      <p id="message" role="status"></p>
    </main>
  `;

  const form = app.querySelector<HTMLFormElement>('#join-form');
  const message = app.querySelector<HTMLParagraphElement>('#message');

  if (!form || !message) {
    return;
  }

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
      message.textContent = 'Registration closed';
      return;
    }

    if (!response.ok || !body.playerId) {
      message.textContent = body.error ?? 'Unable to join session';
      return;
    }

    sessionStorage.setItem('playerId', body.playerId);
    sessionStorage.setItem('playerName', body.name ?? '');
    sessionStorage.setItem('playerSessionId', sessionId);
    window.location.hash = '#/player/game';
  });
}
