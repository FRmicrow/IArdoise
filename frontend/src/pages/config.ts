const DURATION_OPTIONS = [30, 60, 90, 120] as const;
const ROUNDS_OPTIONS = [3, 5, 10] as const;
const MAX_PLAYERS_OPTIONS = [4, 8, 12, 16] as const;

const DEFAULTS = {
  roundDurationSec: 60,
  maxRounds: 3,
  maxPlayers: 8,
  pointsEnabled: true,
};

export function renderConfig(app: HTMLElement): void {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.hash = '#/login';
    return;
  }

  app.innerHTML = `
    <main class="page page--wide">
      <h1>Règle ta partie</h1>
      <div class="stack">
        <div class="field">
          <span>DURÉE PAR MANCHE</span>
          <div class="row" id="duration-chips">
            ${DURATION_OPTIONS.map((v) => `<button type="button" class="chip" id="duration-${v}" data-value="${v}">${v}s</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <span>NOMBRE DE MANCHES</span>
          <div class="row" id="rounds-chips">
            ${ROUNDS_OPTIONS.map((v) => `<button type="button" class="chip" id="rounds-${v}" data-value="${v}">${v}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <span>JOUEURS MAX (indicatif)</span>
          <div class="row" id="maxplayers-chips">
            ${MAX_PLAYERS_OPTIONS.map((v) => `<button type="button" class="chip" id="maxplayers-${v}" data-value="${v}">${v}</button>`).join('')}
          </div>
        </div>
        <button type="button" id="points-toggle" class="toggle-row">
          <span>
            <strong>Compter les points</strong><br>
            <span class="text-muted" style="font-size: var(--font-size-sm);">Tu notes les dessins en direct, on fait un podium</span>
          </span>
          <span class="toggle" id="points-toggle-switch"><span class="toggle-knob"></span></span>
        </button>
        <label class="field">
          <span>Phrase initiale (optionnel)</span>
          <input id="initial-phrase-input" type="text" maxlength="200" placeholder="Ex : Dessine un chat" />
        </label>
        <button type="button" id="create-game" class="btn btn-primary">Créer la partie →</button>
      </div>
    </main>
  `;

  const state = { ...DEFAULTS };

  function selectChip(groupId: string, value: number): void {
    const group = app.querySelector<HTMLDivElement>(`#${groupId}`);
    if (!group) return;
    for (const chip of Array.from(group.querySelectorAll<HTMLButtonElement>('.chip'))) {
      chip.classList.toggle('chip--active', Number(chip.dataset['value']) === value);
    }
  }

  function wireChipGroup(groupId: string, onPick: (value: number) => void): void {
    const group = app.querySelector<HTMLDivElement>(`#${groupId}`);
    if (!group) return;
    group.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.chip');
      if (!target) return;
      onPick(Number(target.dataset['value']));
    });
  }

  wireChipGroup('duration-chips', (v) => {
    state.roundDurationSec = v;
    selectChip('duration-chips', v);
  });
  wireChipGroup('rounds-chips', (v) => {
    state.maxRounds = v;
    selectChip('rounds-chips', v);
  });
  wireChipGroup('maxplayers-chips', (v) => {
    state.maxPlayers = v;
    selectChip('maxplayers-chips', v);
  });

  selectChip('duration-chips', state.roundDurationSec);
  selectChip('rounds-chips', state.maxRounds);
  selectChip('maxplayers-chips', state.maxPlayers);

  const pointsToggle = app.querySelector<HTMLButtonElement>('#points-toggle');
  const pointsToggleSwitch = app.querySelector<HTMLSpanElement>('#points-toggle-switch');

  function syncPointsToggle(): void {
    pointsToggleSwitch?.setAttribute('data-on', String(state.pointsEnabled));
  }
  syncPointsToggle();

  pointsToggle?.addEventListener('click', () => {
    state.pointsEnabled = !state.pointsEnabled;
    syncPointsToggle();
  });

  const initialPhraseInput = app.querySelector<HTMLInputElement>('#initial-phrase-input');
  const createGameButton = app.querySelector<HTMLButtonElement>('#create-game');

  createGameButton?.addEventListener('click', async () => {
    if (createGameButton.disabled) return;
    createGameButton.disabled = true;

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        initialPhrase: initialPhraseInput?.value ?? '',
        roundDurationSec: state.roundDurationSec,
        maxRounds: state.maxRounds,
        maxPlayers: state.maxPlayers,
        pointsEnabled: state.pointsEnabled,
      }),
    });

    if (!response.ok) {
      createGameButton.disabled = false;
      return;
    }

    const { sessionId } = (await response.json()) as { sessionId: string; joinUrl: string };
    localStorage.setItem('hostSessionId', sessionId);
    localStorage.setItem(
      'lastSessionSettings',
      JSON.stringify({
        roundDurationSec: state.roundDurationSec,
        maxRounds: state.maxRounds,
        maxPlayers: state.maxPlayers,
        pointsEnabled: state.pointsEnabled,
      }),
    );
    window.location.hash = '#/host/lobby';
  });
}
