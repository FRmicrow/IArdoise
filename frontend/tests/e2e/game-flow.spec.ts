/**
 * E2E golden path: Mobile Drawing Party Game
 *
 * Prerequisites: the combined app is running at BASE_URL (default http://localhost:3000).
 * Set BASE_URL env var to override (e.g. for CI). Set HOST_PASSWORD to the
 * plaintext password matching HOST_PASSWORD_HASH in .env (defaults to 'password').
 *
 * Every scenario shares a single admin session (SessionManager only allows one
 * active session per host username and never frees it), so this file drives
 * the whole golden path — US1 through US5 — as one continuous flow rather than
 * separate tests that would each try to create their own session.
 *
 * Covers quickstart.md's manual golden-path checklist:
 *   1. Admin creates a session with an initial phrase (US1)
 *   2. A player joins via the join link, sees the French nickname form, and
 *      lands on the waiting message with no drawing canvas mounted (US1)
 *   3. A duplicate nickname is accepted as-is, with no " 2" suffix (US1/US2)
 *   4. An unknown session id shows a distinct "not found" message (US1)
 *   5. The admin's roster updates live without a refresh (US2)
 *   6. A late join while the game is active shows a distinct message (US1 edge case)
 *   6b. A player who already joined reopens the original join link (QR
 *       re-scan, re-shared link) and resumes straight into the session
 *       instead of seeing the join form again (FR-023 regression)
 *   7. Starting the game moves every player off the waiting screen (US2/US3)
 *   8. The phrase label and a full-space drawing canvas are shown; strokes
 *      render immediately on pointer input (US3)
 *   9. Publishing a new phrase updates every player automatically (US4)
 *  10. An empty phrase submission is rejected, previous phrase stays active (US4)
 *  11. Ending the game moves every player to the closing screen, and a fresh
 *      join attempt afterwards shows the "ended" message (US5)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAsHost(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`);
  await page.fill('#username', 'admin');
  await page.fill('#password', process.env['HOST_PASSWORD'] ?? 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/#/host/lobby`, { timeout: 5000 });
}

async function hasNonBackgroundPixel(page: Page, canvasSelector: string): Promise<boolean> {
  return page.locator(canvasSelector).evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
        return true;
      }
    }
    return false;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Full game flow', () => {
  test('Golden path — create, join, roster, draw, publish, end', async ({ page, context }) => {
    // US1 — admin creates a session with an initial phrase
    await loginAsHost(page);
    await page.fill('#initial-phrase-input', 'Dessine un chat');
    await page.click('#new-game');

    await page.waitForSelector('#qr-code[src]', { timeout: 5000 });
    expect(await page.isVisible('#qr-code')).toBe(true);

    const joinUrl = (await page.textContent('#join-url'))!.trim();
    expect(joinUrl).toMatch(/\/join\//);
    const sessionId = joinUrl.split('/join/')[1];
    expect(sessionId).toBeTruthy();

    // US1 — a player joins via the join link, sees the nickname form, then
    // lands on the waiting message with no drawing canvas mounted yet
    const alice = await context.newPage();
    await alice.goto(joinUrl);
    await alice.fill('#name', 'Alice');
    await alice.click('#join-form button[type="submit"]');
    await alice.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });
    await expect(alice.locator('#waiting')).toBeVisible();
    expect(await alice.locator('#canvas-container canvas').count()).toBe(0);

    // US1/US2 — a second player joins with the SAME nickname; both succeed
    // as-is. Uses an isolated browser context — two distinct players are two
    // distinct devices in reality, each with their own localStorage; sharing
    // `context` here would make Alice2's visit resolve as Alice's own
    // resume (FR-023) instead of a fresh join.
    const alice2Context = await context.browser()!.newContext();
    const alice2 = await alice2Context.newPage();
    await alice2.goto(joinUrl);
    await alice2.fill('#name', 'Alice');
    await alice2.click('#join-form button[type="submit"]');
    await alice2.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    // US1 — an unknown session id shows a distinct "not found" message
    const strangerPage = await context.newPage();
    await strangerPage.goto(`${BASE_URL}/join/00000000-0000-0000-0000-000000000000`);
    await expect(strangerPage.locator('#status-message')).toHaveText('Partie introuvable', { timeout: 5000 });
    await strangerPage.close();

    // Regression (FR-023) — a player who already joined reopens the ORIGINAL
    // join link (simulating a QR re-scan or re-tapping a shared link) and
    // must resume straight into their session, never seeing the join form
    // again. Uses an isolated browser context so this player's localStorage
    // doesn't collide with Alice/Alice2/the host in the shared `context`.
    const bobContext = await context.browser()!.newContext();
    const bobFirstVisit = await bobContext.newPage();
    await bobFirstVisit.goto(joinUrl);
    await bobFirstVisit.fill('#name', 'Bob');
    await bobFirstVisit.click('#join-form button[type="submit"]');
    await bobFirstVisit.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    const bobReturnVisit = await bobContext.newPage();
    await bobReturnVisit.goto(joinUrl);
    await bobReturnVisit.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });
    expect(await bobReturnVisit.locator('#join-form').isVisible()).toBe(false);
    await expect(bobReturnVisit.locator('#waiting')).toBeVisible();

    await bobFirstVisit.close();
    await bobReturnVisit.close();
    await bobContext.close();

    // US2 — the admin's roster reflects all joins live, with no dedup suffix
    await expect(page.locator('#player-list .roster-item')).toHaveCount(3, { timeout: 3000 });
    const rosterNames = await page.locator('#player-list [data-role="name"]').allTextContents();
    expect(rosterNames).toEqual(['Alice', 'Alice', 'Bob']);

    const startDisabled = await page.getAttribute('#start-game', 'disabled');
    expect(startDisabled).toBeNull();

    // US2/US3 — starting the game moves every joined player off the waiting screen
    await page.click('#start-game');
    await page.waitForURL(`${BASE_URL}/#/host/game`, { timeout: 5000 });
    await expect(alice.locator('#waiting')).toBeHidden({ timeout: 3000 });
    await expect(alice2.locator('#waiting')).toBeHidden({ timeout: 3000 });

    // Edge case — a late join once the game is active shows a distinct
    // message. Isolated context: a new device, not Alice's, must see the
    // status precheck rather than resuming into Alice's session.
    const lateActiveJoinerContext = await context.browser()!.newContext();
    const lateActiveJoiner = await lateActiveJoinerContext.newPage();
    await lateActiveJoiner.goto(joinUrl);
    await expect(lateActiveJoiner.locator('#status-message')).toHaveText('La partie a déjà commencé', { timeout: 5000 });
    await lateActiveJoinerContext.close();

    // US3 — the phrase label is visible and the drawing area fills the screen
    await expect(alice.locator('#phrase')).toHaveText('Dessine un chat', { timeout: 3000 });
    const canvas = alice.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // US3 — freehand strokes render immediately on pointer input
    await alice.mouse.move(box!.x + 20, box!.y + 20);
    await alice.mouse.down();
    await alice.mouse.move(box!.x + 80, box!.y + 80, { steps: 5 });
    await alice.mouse.up();
    await expect.poll(() => hasNonBackgroundPixel(alice, '#canvas-container canvas'), { timeout: 3000 }).toBe(true);

    // US4 — admin publishes a new phrase via the explicit "Valider" action;
    // it appears on every connected player's screen without any player action
    await page.fill('#prompt-input', 'Dessine un chien');
    await page.click('#prompt-form button[type="submit"]');
    await expect(alice.locator('#phrase')).toHaveText('Dessine un chien', { timeout: 3000 });
    await expect(alice2.locator('#phrase')).toHaveText('Dessine un chien', { timeout: 3000 });

    // US4 — an empty submission is rejected and the previous phrase stays active
    await page.fill('#prompt-input', '   ');
    await page.click('#prompt-form button[type="submit"]');
    await page.waitForTimeout(300);
    await expect(alice.locator('#phrase')).toHaveText('Dessine un chien');

    // US5 — ending the game moves every connected player to the closing screen
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('#end-game');
    await page.waitForURL(`${BASE_URL}/#/closing`, { timeout: 5000 });
    await alice.waitForURL(`${BASE_URL}/#/closing`, { timeout: 5000 });
    await alice2.waitForURL(`${BASE_URL}/#/closing`, { timeout: 5000 });

    // US5 — a fresh join attempt at the same URL now shows the "ended"
    // message. Isolated context, same reasoning as lateActiveJoiner above.
    const lateJoinerContext = await context.browser()!.newContext();
    const lateJoiner = await lateJoinerContext.newPage();
    await lateJoiner.goto(joinUrl);
    await expect(lateJoiner.locator('#status-message')).toHaveText('Cette partie est terminée', { timeout: 5000 });

    await alice.close();
    await alice2Context.close();
    await lateJoinerContext.close();
  });
});
