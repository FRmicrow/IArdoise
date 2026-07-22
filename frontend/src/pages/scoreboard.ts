export function renderScoreboard(app: HTMLElement): void {
  const raw = sessionStorage.getItem('scoreboard');
  const scoreboard = raw
    ? (JSON.parse(raw) as Array<{ playerId: string; name: string; score: number }>)
    : [];

  const rows = scoreboard
    .map((entry, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${entry.name}</td>
        <td>${entry.score}</td>
      </tr>
    `)
    .join('');

  app.innerHTML = `
    <main style="padding: 24px; max-width: 720px; margin: 0 auto; display: grid; gap: 16px;">
      <h1>Final Scoreboard</h1>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px;">Rank</th>
            <th style="text-align: left; padding: 8px;">Player</th>
            <th style="text-align: left; padding: 8px;">Score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
  `;
}
