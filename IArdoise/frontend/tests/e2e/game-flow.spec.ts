/**
 * E2E smoke test: Full game flow
 *
 * Prerequisites: the combined app is running at BASE_URL (default http://localhost:3000).
 * Set BASE_URL env var to override (e.g. for CI).
 *
 * Covers quickstart.md Scenarios 1–6:
 *   1. Host login and session creation
 *   2. Player joins via join URL, name appears in lobby
 *   3. Host sets prompt → player sees prompt text
 *   4. Host starts game → player canvas visible; late join rejected
 *   5. Host scores (+/−) and advances question
 *   6. Host ends game → scoreboard shown on all screens
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAsHost(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`);
  await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'admin');
  await page.fill('input[name="password"], input[type="password"]', process.env['HOST_PASSWORD'] ?? 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/#/host/lobby`, { timeout: 5000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Full game flow', () => {
  let joinUrl: string;
  let sessionId: string;
  let playerPage: Page;

  test('Scenario 1 — Host login and session creation', async ({ page, context }) => {
    await loginAsHost(page);

    // Create a new game session
    await page.click('#new-game');

    // Wait for the QR code image to appear
    await page.waitForSelector('#qr-code[src]', { timeout: 5000 });
    const qrVisible = await page.isVisible('#qr-code');
    expect(qrVisible).toBe(true);

    // Capture the join URL for subsequent tests
    const joinUrlText = await page.textContent('#join-url');
    expect(joinUrlText).toMatch(/\/join\//);
    joinUrl = joinUrlText!.trim();

    // Extract sessionId from the join URL
    sessionId = joinUrl.split('/join/')[1];
    expect(sessionId).toBeTruthy();

    // Store for other tests
    test.info().annotations.push({ type: 'joinUrl', description: joinUrl });

    // Scenario 2 — Player joins and name appears in lobby
    playerPage = await context.newPage();
    await playerPage.goto(joinUrl);
    await playerPage.waitForSelector('#join-form', { timeout: 5000 });
    await playerPage.fill('#name', 'Alice');
    await playerPage.click('button[type="submit"]');
    await playerPage.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    // Player name appears in host lobby within 3 s
    await page.waitForSelector(`li:has-text("Alice")`, { timeout: 3000 });

    // Scenario 3 — Host sets a prompt
    await page.fill('#prompt-input', 'Draw a cat');

    // Player sees prompt text within 3 s
    await playerPage.waitForSelector('#prompt', { timeout: 3000 });
    await expect(playerPage.locator('#prompt')).toHaveText('Draw a cat', { timeout: 3000 });

    // Start Game button should be enabled (at least 1 player)
    const startDisabled = await page.getAttribute('#start-game', 'disabled');
    expect(startDisabled).toBeNull();

    // Scenario 4 — Host starts game
    await page.click('#start-game');
    await page.waitForURL(`${BASE_URL}/#/host/game`, { timeout: 5000 });

    // Player canvas should be visible
    await playerPage.waitForSelector('#drawing-canvas', { timeout: 3000 });
    expect(await playerPage.isVisible('#drawing-canvas')).toBe(true);
    expect(await playerPage.isHidden('#waiting')).toBe(true);

    // Scenario 4 — Late join is rejected
    const lateJoiner = await context.newPage();
    await lateJoiner.goto(joinUrl);
    await lateJoiner.waitForSelector('#join-form', { timeout: 5000 });
    await lateJoiner.fill('#name', 'LatePlayer');
    await lateJoiner.click('button[type="submit"]');
    await expect(lateJoiner.locator('#message')).toHaveText(/[Rr]egistration/, { timeout: 3000 });
    await lateJoiner.close();

    // Scenario 5 — Scoring
    await page.waitForSelector('[data-player-id]', { timeout: 3000 });

    // Click + to increment Alice's score
    const plusButton = page.locator('[data-action="plus"]').first();
    await plusButton.click();
    // Score should now be 1
    await expect(page.locator('[data-role="score"]').first()).toHaveText('1', { timeout: 2000 });

    // Click − to decrement
    const minusButton = page.locator('[data-action="minus"]').first();
    await minusButton.click();
    await expect(page.locator('[data-role="score"]').first()).toHaveText('0', { timeout: 2000 });

    // Scenario 5 — Next question
    await page.click('#next-question');

    // Scenario 6 — End game and scoreboard
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('#end-game');
    await page.waitForURL(`${BASE_URL}/#/scoreboard`, { timeout: 5000 });
    const scoreboardVisible = await page.isVisible('table, #scoreboard-table, [id*="score"]');
    expect(scoreboardVisible).toBe(true);

    // Player also sees the scoreboard
    await playerPage.waitForURL(`${BASE_URL}/#/scoreboard`, { timeout: 5000 });
  });

  test('Scenario 7 — Duplicate player names', async ({ context }) => {
    // This test requires a fresh session
    const hostPage = await context.newPage();
    await loginAsHost(hostPage);
    await hostPage.click('#new-game');
    await hostPage.waitForSelector('#join-url', { timeout: 5000 });
    const url = (await hostPage.textContent('#join-url'))!.trim();

    const p1 = await context.newPage();
    await p1.goto(url);
    await p1.fill('#name', 'Bob');
    await p1.click('button[type="submit"]');
    await p1.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    const p2 = await context.newPage();
    await p2.goto(url);
    await p2.fill('#name', 'Bob');
    await p2.click('button[type="submit"]');
    await p2.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    // One of the two players should have the name "Bob 2"
    await hostPage.waitForSelector('li:has-text("Bob 2")', { timeout: 3000 });
  });
});
