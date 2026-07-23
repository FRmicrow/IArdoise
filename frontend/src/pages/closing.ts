export function renderClosing(app: HTMLElement): void {
  app.innerHTML = `
    <main class="page page--narrow">
      <h1>Partie terminée</h1>
      <p class="text-muted">L'admin a mis fin à la partie. Merci d'avoir joué !</p>
    </main>
  `;
}
