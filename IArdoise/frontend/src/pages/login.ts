export function renderLogin(app: HTMLElement): void {
  app.innerHTML = `
    <main style="padding: 24px; max-width: 420px; margin: 0 auto; display: grid; gap: 12px;">
      <h1>Host Login</h1>
      <form id="login-form" style="display: grid; gap: 12px;">
        <label>
          Username
          <input id="username" name="username" required />
        </label>
        <label>
          Password
          <input id="password" name="password" type="password" required />
        </label>
        <button type="submit">Log in</button>
      </form>
      <p id="error" role="alert"></p>
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
      error.textContent = 'Invalid credentials';
      return;
    }

    const body = (await response.json()) as { token: string };
    sessionStorage.setItem('token', body.token);
    window.location.hash = '#/host/lobby';
  });
}
