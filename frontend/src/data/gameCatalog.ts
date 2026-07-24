export interface GameCatalogEntry {
  key: string;
  name: string;
  description: string;
  glyph: string;
  playable: boolean;
}

// Static, frontend-only catalog (research.md — no backend entity for a
// single-entry catalog). Only "L'Ardoise" is a real, playable game today;
// the rest are visually present placeholders for future mini-games.
export const GAME_CATALOG: GameCatalogEntry[] = [
  { key: 'ardoise', name: "L'Ardoise", description: 'Dessine ta réponse à la question', glyph: '✎', playable: true },
  { key: 'quiz-eclair', name: 'Quiz Éclair', description: 'Le plus rapide gagne le point', glyph: '?', playable: false },
  { key: 'blind-test', name: 'Blind Test', description: 'Devine le morceau avant les autres', glyph: '♪', playable: false },
  { key: 'petit-bac', name: 'Le Petit Bac', description: 'Une lettre, cinq catégories, top chrono', glyph: 'B', playable: false },
  { key: 'qui-a-dit-ca', name: 'Qui a dit ça ?', description: 'Retrouve qui a écrit quoi', glyph: '“', playable: false },
  { key: 'mime-ou-triche', name: 'Mime ou Triche', description: 'Fais deviner sans parler… ou presque', glyph: '☻', playable: false },
];
