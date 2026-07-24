# Quickstart: Hub de mini-jeux, parties configurables et podium

Manual end-to-end walkthrough exercising all three user stories. Mirrors the spec's
"Independent Test" for each story — use this to demonstrate the feature is actually working
(per the standing rule: tests green + demonstrated behavior, not just code written).

## Prerequisites

```bash
npm install            # root workspace install (backend + frontend)
cp .env.example .env   # if not already done — HOST_USERNAME / HOST_PASSWORD_HASH / JWT_SECRET
npm run dev            # starts backend (Fastify) + frontend (Vite) concurrently
```

Open the frontend dev URL on a laptop for the host, and on a second device (or a private browser
window on the same machine) for each simulated player.

## Story 3 — Hub (P3)

1. Log in as host (`#/login`) with the credentials from `.env`.
2. Land on the hub (`#/host/hub`): confirm "L'Ardoise" is shown as playable and at least one
   other catalog entry is shown as "bientôt disponible".
3. Click a "bientôt disponible" entry → confirm nothing happens (no navigation).
4. Click "L'Ardoise" → confirm arrival on the configuration screen (`#/host/config`).

## Story 1 — Configurable, round-limited, timed game (P1)

1. On the config screen, pick non-default values (e.g. 30s / 3 manches / 4 joueurs) and leave
   "Compter les points" on. Confirm "Créer la partie" leads to the lobby with a QR code.
2. From a player device, scan/open the join link, enter a pseudo, confirm — verify the host's
   lobby roster updates live (existing behavior, unaffected by this feature).
3. Start the game. Confirm the host screen shows "Manche 1/3" and a running countdown starting at
   30s (or your chosen value) that reaches 0 without forcing any transition.
4. Send a question, then advance to "Manche suivante" twice more (reaching manche 3/3) — confirm
   the round counter updates each time and the countdown resets to 30s.
5. At manche 3/3, confirm the UI no longer offers to advance further — only "Terminer" remains
   meaningful.
6. Reload the host's browser tab mid-round — confirm the host resumes at the same round number
   with the same countdown baseline (not reset to manche 1) per FR-019.

## Story 2 — In-person scoring and podium (P2)

1. While still on a round, have each joined player click "J'ai fini" on their drawing screen —
   confirm each transitions to the waiting screen, and confirm the host's player list shows
   "a terminé" for each one as they click it (FR-013).
2. On the host, before advancing, enter point values for each player for the current round and
   submit.
3. Advance through the remaining rounds, scoring at least one more round and deliberately
   skipping scoring for one round — confirm advancing/ending is never blocked by missing scores
   (FR-011 non-blocking).
4. End the game (via "Terminer" on any round, not necessarily the last).
5. Confirm both the host and every player device land on a results screen showing a top-3 podium
   and the full ranked list, with totals matching exactly the points entered in steps 2–3 (no
   phantom rounds, no lost/duplicated points — SC-003).
6. Click "on rejoue" — confirm a brand-new session starts with the same settings (same round
   duration/count/points toggle) and an empty lobby.
7. Separately, repeat steps 1–5 with "Compter les points" turned off at configuration — confirm
   the results screen shows the participant list without any point totals or podium (FR-015).

## Regression checks (existing behavior, must remain intact)

- Auth: wrong credentials still rejected with the existing error message (`login.ts`, unchanged).
- A player who scans a QR code for a session that already started sees "La partie a déjà
  commencé"; for one that ended, "Cette partie est terminée" (`join.ts`, unchanged).
- Drawing tools (color picker, eraser, stroke width) behave exactly as before 004 — this feature
  does not touch `DrawingCanvas.ts` or `toolState.ts`.
- The app remains installable and usable offline (PWA) after the visual retheme — verify via
  Chrome DevTools "Application" tab / Lighthouse PWA check that the new self-hosted fonts are
  precached, not loaded from a Google Fonts CDN request.
