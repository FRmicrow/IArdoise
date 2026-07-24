import { GAME_CATALOG } from '../data/gameCatalog';

export function renderHub(app: HTMLElement): void {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.hash = '#/login';
    return;
  }

  app.innerHTML = `
    <main class="page page--wide">
      <div class="row" style="justify-content: space-between; align-items: baseline;">
        <h1>Choisis ton jeu</h1>
        <span class="text-hand">soirée !</span>
      </div>
      <div class="card-grid" id="game-grid">
        ${GAME_CATALOG.map((game) => `
          <button
            type="button"
            class="card"
            data-game-key="${game.key}"
            data-playable="${game.playable}"
          >
            <span class="avatar" style="width: 44px; height: 44px; font-size: 22px;">${game.glyph}</span>
            <span style="font-weight: 700;">${game.name}</span>
            <span class="text-muted" style="font-size: var(--font-size-sm);">${game.description}</span>
            <span class="badge" data-tone="${game.playable ? 'accent' : ''}">${game.playable ? 'JOUER' : 'BIENTÔT'}</span>
          </button>
        `).join('')}
      </div>
      <p class="text-muted" style="text-align: center;">D'autres jeux arrivent bientôt ✳</p>
    </main>
  `;

  const grid = app.querySelector<HTMLDivElement>('#game-grid');
  grid?.addEventListener('click', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLButtonElement>('.card');
    if (!card || card.dataset['playable'] !== 'true') {
      return;
    }
    window.location.hash = '#/host/config';
  });
}
