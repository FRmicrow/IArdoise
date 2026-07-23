export function renderLogin(app: HTMLElement): void {
  app.innerHTML = `
    <main class="page page--narrow">
      <h1>Connexion admin</h1>
      <form id="login-form" class="stack">
        <label class="field">
          <span>Identifiant</span>
          <input id="username" name="username" type="text" required />
        </label>
        <label class="field">
          <span>Mot de passe</span>
          <input id="password" name="password" type="password" required />
        </label>
        <button type="submit" class="btn btn-primary">Se connecter</button>
      </form>
      <p id="error" class="status-text status-text--error" role="alert"></p>
    </main>
  `;

  const form = app.querySelector<HTMLFormElement>('#login-form');
  const error = app.querySelector<HTMLParagraphElement>('#error');

  if (!form || !error) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';

    const formData = new FormData(form);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: String(formData.get('username') ?? ''),
        password: String(formData.get('password') ?? ''),
      }),
    });

    if (response.status === 401) {
      error.textContent = 'Identifiants invalides';
      return;
    }

    const body = (await response.json()) as { token: string };
    localStorage.setItem('token', body.token);
    window.location.hash = '#/host/lobby';
  });
}
