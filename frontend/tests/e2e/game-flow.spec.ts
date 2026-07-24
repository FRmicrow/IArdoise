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

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3000';

// Mirrors WebSocketClient.ts's HEARTBEAT_INTERVAL_MS/HEARTBEAT_REPLY_TIMEOUT_MS.
const HEARTBEAT_INTERVAL_MS = 20000;
const HEARTBEAT_REPLY_TIMEOUT_MS = 8000;

// Restore a blackholed connection's connectivity partway through the reply
// window: late enough that the first PING (sent HEARTBEAT_INTERVAL_MS after
// connect()) has already been silently dropped — proving the outage genuinely
// spans the detection window, not just a lucky coincidence — but before the
// reply-timeout itself elapses. Otherwise the heartbeat's own close-and
// -reconnect fires *into* a connection that's still blackholed (its fresh
// AUTH gets dropped too), and recovery would need an entire extra cycle.
const RESTORE_CONNECTIVITY_AT_MS = HEARTBEAT_INTERVAL_MS + HEARTBEAT_REPLY_TIMEOUT_MS / 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAsHost(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`);
  await page.fill('#username', 'admin');
  await page.fill('#password', process.env['HOST_PASSWORD'] ?? 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/#/host/hub`, { timeout: 5000 });
}

// Logs in, picks the one playable hub entry, configures a session with the
// given chip selections, and creates it — landing on the lobby exactly like
// createAndJoinActiveSession's pre-004 helper used to, but now via the hub
// (US3) and dedicated config screen (US1).
async function createConfiguredSession(
  page: Page,
  options: { durationSec: 30 | 60 | 90 | 120; rounds: 3 | 5 | 10; phrase: string },
): Promise<void> {
  await loginAsHost(page);
  await page.click('[data-game-key="ardoise"]');
  await page.waitForURL(`${BASE_URL}/#/host/config`, { timeout: 5000 });
  await page.click(`#duration-${options.durationSec}`);
  await page.click(`#rounds-${options.rounds}`);
  await page.fill('#initial-phrase-input', options.phrase);
  await page.click('#create-game');
  await page.waitForURL(`${BASE_URL}/#/host/lobby`, { timeout: 5000 });
}

// The canvas background is themeable (--color-canvas-bg, 004's retheme moved
// it off pure black), so "is this pixel ink" must be judged relative to the
// page's actual current background color rather than an assumed near-zero
// RGB — otherwise a mid-tone background itself reads as "ink" everywhere.
const INK_DELTA_THRESHOLD = 30;

async function getCanvasBackgroundRgb(page: Page): Promise<[number, number, number]> {
  const hex = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-canvas-bg').trim(),
  );
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)];
}

async function hasNonBackgroundPixel(page: Page, canvasSelector: string): Promise<boolean> {
  const bg = await getCanvasBackgroundRgb(page);
  return page.locator(canvasSelector).evaluate((el, [bgR, bgG, bgB]) => {
    const canvas = el as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i]! - bgR) > 30 ||
        Math.abs(data[i + 1]! - bgG) > 30 ||
        Math.abs(data[i + 2]! - bgB) > 30
      ) {
        return true;
      }
    }
    return false;
  }, bg);
}

// Drives a minimal host+player flow up to the player's active drawing
// screen, for the drawing-tool scenarios below (US1/US2/US3/US4). Each of
// these tests owns its own session — SessionManager frees the 'admin' host
// slot once a session's status is 'ended', so sequential tests (workers: 1)
// can each create a fresh one as long as the previous test called
// endSession() first.
async function createAndJoinActiveSession(
  page: Page,
  context: BrowserContext,
  phrase: string,
  playerName: string,
): Promise<Page> {
  await loginAsHost(page);
  await page.click('[data-game-key="ardoise"]');
  await page.waitForURL(`${BASE_URL}/#/host/config`, { timeout: 5000 });
  await page.fill('#initial-phrase-input', phrase);
  await page.click('#create-game');
  await page.waitForSelector('#qr-code[src]', { timeout: 5000 });
  const joinUrl = (await page.textContent('#join-url'))!.trim();

  const player = await context.newPage();
  await player.goto(joinUrl);
  await player.fill('#name', playerName);
  await player.click('#join-form button[type="submit"]');
  await player.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

  await page.click('#start-game');
  await page.waitForURL(`${BASE_URL}/#/host/game`, { timeout: 5000 });
  await expect(player.locator('#phrase')).toHaveText(phrase, { timeout: 3000 });

  return player;
}

async function endSession(page: Page): Promise<void> {
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#end-game');
  await page.waitForURL(`${BASE_URL}/#/results`, { timeout: 5000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Full game flow', () => {
  test('Golden path — create, join, roster, draw, publish, end', async ({ page, context }) => {
    // This scenario deliberately waits out real client heartbeat
    // detect-and-reconnect cycles (T005/T007) on top of the golden path
    // itself, well past Playwright's default 30s per-test timeout.
    test.setTimeout(120000);

    // US1 — admin creates a session with an initial phrase
    await loginAsHost(page);
    await page.click('[data-game-key="ardoise"]');
    await page.waitForURL(`${BASE_URL}/#/host/config`, { timeout: 5000 });
    await page.fill('#initial-phrase-input', 'Dessine un chat');
    await page.click('#create-game');

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

    // T005 (US1 regression) — Zoe's WebSocket will be silently blackholed (no
    // close/error event fires on either end) while her tab stays foregrounded
    // the whole time, faithfully reproducing the reported bug. Route her
    // socket before she navigates, so every message she sends/receives is
    // gated on `zoeBlackhole` (starts false — she joins and reaches the
    // waiting screen normally first). `zoeConnectionCount` increments each
    // time a new native WebSocket is constructed for her, so we can later
    // prove a *reconnect* happened rather than some other recovery path.
    let zoeBlackhole = false;
    let zoeConnectionCount = 0;
    const zoeContext = await context.browser()!.newContext();
    const zoe = await zoeContext.newPage();
    await zoe.routeWebSocket('/ws', (ws) => {
      zoeConnectionCount += 1;
      const server = ws.connectToServer();
      ws.onMessage((message) => {
        if (!zoeBlackhole) server.send(message);
      });
      server.onMessage((message) => {
        if (!zoeBlackhole) ws.send(message);
      });
    });
    await zoe.goto(joinUrl);
    await zoe.fill('#name', 'Zoe');
    await zoe.click('#join-form button[type="submit"]');
    await zoe.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });
    await expect(zoe.locator('#waiting')).toBeVisible();
    const zoeConnectedAt = Date.now();
    zoeBlackhole = true;

    // T007 (US2 regression) — Yasmine is blackholed the same way as Zoe, but
    // stays blackholed through both the game start *and* a later published
    // phrase, so her eventual resync must reflect the session's real current
    // state (the second phrase), not a stale replay of the original
    // GAME_STARTED broadcast. `yasmineLastConnectedAt` is refreshed on every
    // reconnect attempt (there may be several while she stays blackholed) so
    // that whenever we finally restore her connectivity, we can wait exactly
    // long enough relative to whichever connection is currently live.
    let yasmineBlackhole = false;
    let yasmineConnectionCount = 0;
    let yasmineLastConnectedAt = 0;
    const yasmineContext = await context.browser()!.newContext();
    const yasmine = await yasmineContext.newPage();
    await yasmine.routeWebSocket('/ws', (ws) => {
      yasmineConnectionCount += 1;
      yasmineLastConnectedAt = Date.now();
      const server = ws.connectToServer();
      ws.onMessage((message) => {
        if (!yasmineBlackhole) server.send(message);
      });
      server.onMessage((message) => {
        if (!yasmineBlackhole) ws.send(message);
      });
    });
    await yasmine.goto(joinUrl);
    await yasmine.fill('#name', 'Yasmine');
    await yasmine.click('#join-form button[type="submit"]');
    await yasmine.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });
    await expect(yasmine.locator('#waiting')).toBeVisible();
    yasmineBlackhole = true;

    // US2 — the admin's roster reflects all joins live, with no dedup suffix
    await expect(page.locator('#player-list .roster-item')).toHaveCount(5, { timeout: 3000 });
    const rosterNames = await page.locator('#player-list [data-role="name"]').allTextContents();
    expect(rosterNames).toEqual(['Alice', 'Alice', 'Bob', 'Zoe', 'Yasmine']);

    const startDisabled = await page.getAttribute('#start-game', 'disabled');
    expect(startDisabled).toBeNull();

    // US2/US3 — starting the game moves every joined player off the waiting screen.
    // FR-005/SC-004 — the admin must never be blocked by Zoe's still-blackholed
    // connection, so this must resolve almost immediately, not just within the
    // outer 5s Playwright timeout.
    const startClickedAt = Date.now();
    await page.click('#start-game');
    await page.waitForURL(`${BASE_URL}/#/host/game`, { timeout: 5000 });
    expect(Date.now() - startClickedAt).toBeLessThan(1000);
    await expect(alice.locator('#waiting')).toBeHidden({ timeout: 3000 });
    await expect(alice2.locator('#waiting')).toBeHidden({ timeout: 3000 });

    // T005 (US1 regression) — Zoe is still blackholed. Wait until the client
    // heartbeat's detect-and-reconnect cycle has had a chance to run at least
    // once *while she's still unreachable* (otherwise her first PING would
    // simply succeed once connectivity returns, and the heartbeat would never
    // notice anything was ever wrong — proving nothing about the fix). Only
    // then restore her connectivity and confirm she still reaches the game
    // screen within the ~15s recovery bound (SC-003) via a genuine reconnect
    // (a brand-new WebSocket), not some other path.
    await page.waitForTimeout(Math.max(0, RESTORE_CONNECTIVITY_AT_MS - (Date.now() - zoeConnectedAt)));
    zoeBlackhole = false;
    await expect(zoe.locator('#waiting')).toBeHidden({ timeout: 15000 });
    await expect(zoe.locator('#phrase')).toBeVisible();
    expect(zoeConnectionCount).toBeGreaterThan(1);

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
    // Fabric.js renders two stacked <canvas> elements (lower-canvas for
    // committed strokes, upper-canvas for live pointer interaction) inside
    // #canvas-container, so a bare "canvas" selector is now ambiguous.
    const canvas = alice.locator('#canvas-container canvas.upper-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // US3 — freehand strokes render immediately on pointer input
    await alice.mouse.move(box!.x + 20, box!.y + 20);
    await alice.mouse.down();
    await alice.mouse.move(box!.x + 80, box!.y + 80, { steps: 5 });
    await alice.mouse.up();
    await expect
      .poll(() => hasNonBackgroundPixel(alice, '#canvas-container canvas.lower-canvas'), { timeout: 3000 })
      .toBe(true);

    // US4 — admin publishes a new phrase via the explicit "Valider" action;
    // it appears on every connected player's screen without any player action
    await page.fill('#prompt-input', 'Dessine un chien');
    await page.click('#prompt-form button[type="submit"]');
    await expect(alice.locator('#phrase')).toHaveText('Dessine un chien', { timeout: 3000 });
    await expect(alice2.locator('#phrase')).toHaveText('Dessine un chien', { timeout: 3000 });

    // T007 (US2 regression) — Yasmine has been blackholed since before the
    // game even started, missing both GAME_STARTED (first phrase) and
    // PROMPT_UPDATED (second phrase) entirely. Restore her connectivity now
    // (mid-reply-window relative to whichever reconnect attempt is currently
    // live, same reasoning as Zoe's recovery above) and confirm her
    // heartbeat-triggered reconnect resyncs via SESSION_STATE straight to the
    // session's *real current* phrase — she must never show the first phrase
    // at any point, only ever go straight to the second one.
    await page.waitForTimeout(Math.max(0, RESTORE_CONNECTIVITY_AT_MS - (Date.now() - yasmineLastConnectedAt)));
    yasmineBlackhole = false;
    await expect(yasmine.locator('#phrase')).toHaveText('Dessine un chien', { timeout: 15000 });
    await expect(yasmine.locator('#waiting')).toBeHidden();
    expect(yasmineConnectionCount).toBeGreaterThan(1);

    // US4 — an empty submission is rejected and the previous phrase stays active
    await page.fill('#prompt-input', '   ');
    await page.click('#prompt-form button[type="submit"]');
    await page.waitForTimeout(300);
    await expect(alice.locator('#phrase')).toHaveText('Dessine un chien');

    // US5 — ending the game moves every connected player to the results screen
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('#end-game');
    await page.waitForURL(`${BASE_URL}/#/results`, { timeout: 5000 });
    await alice.waitForURL(`${BASE_URL}/#/results`, { timeout: 5000 });
    await alice2.waitForURL(`${BASE_URL}/#/results`, { timeout: 5000 });

    // US5 — a fresh join attempt at the same URL now shows the "ended"
    // message. Isolated context, same reasoning as lateActiveJoiner above.
    const lateJoinerContext = await context.browser()!.newContext();
    const lateJoiner = await lateJoinerContext.newPage();
    await lateJoiner.goto(joinUrl);
    await expect(lateJoiner.locator('#status-message')).toHaveText('Cette partie est terminée', { timeout: 5000 });

    await alice.close();
    await alice2Context.close();
    await lateJoinerContext.close();
    await zoeContext.close();
    await yasmineContext.close();
  });
});

test.describe('Mobile drawing screen — fullscreen and toolbar (003-mobile-canvas-tools)', () => {
  test('US1 — canvas fills the viewport and survives rotation', async ({ page, context }, testInfo) => {
    // Fixed-viewport WebKit device emulation can't simulate a real mobile
    // browser's address-bar show/hide, so this scenario is only meaningful
    // on the Mobile Safari project (see plan.md's Testing-scope note).
    test.skip(testInfo.project.name !== 'Mobile Safari', 'Fullscreen/orientation behavior is specific to the Mobile Safari project');
    test.setTimeout(30000);

    const player = await createAndJoinActiveSession(page, context, 'Dessine une maison', 'Rex');

    const assertCanvasFillsViewport = async (): Promise<void> => {
      const viewport = player.viewportSize();
      expect(viewport).not.toBeNull();

      const [spaceMd, spaceSm] = await player.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        return [
          parseFloat(styles.getPropertyValue('--space-md')),
          parseFloat(styles.getPropertyValue('--space-sm')),
        ];
      });
      // .page--full's only "chrome" not covered by the phrase/canvas/finish-row
      // boxes themselves is 2×space-md vertical padding plus 3 row gaps of
      // space-sm (four grid rows: waiting/phrase/canvas/finish-row — waiting
      // collapses to 0 height once hidden, per style.css's explicit
      // grid-row rules; finish-row holds the "J'ai fini !" action, 004).
      const chrome = spaceMd * 2 + spaceSm * 3;

      const phraseBox = await player.locator('#phrase').boundingBox();
      const canvasBox = await player.locator('#canvas-container').boundingBox();
      const finishRowBox = await player.locator('#finish-row').boundingBox();
      expect(phraseBox).not.toBeNull();
      expect(canvasBox).not.toBeNull();
      expect(finishRowBox).not.toBeNull();

      const contentHeight = phraseBox!.height + canvasBox!.height + finishRowBox!.height;
      expect(Math.abs(contentHeight + chrome - viewport!.height)).toBeLessThanOrEqual(3);
    };

    await assertCanvasFillsViewport();

    // Draw a small stroke close to the canvas's own top-left corner so it's
    // guaranteed to remain within bounds after rotation regardless of the
    // new, possibly smaller, dimension (per spec.md's Assumptions: a stroke
    // near an edge may legitimately fall outside a smaller canvas, but this
    // one never gets close to any edge in either orientation).
    const lowerCanvas = player.locator('#canvas-container canvas.lower-canvas');
    const originBg = await getCanvasBackgroundRgb(player);
    const hasInkNearOrigin = async (): Promise<boolean> =>
      lowerCanvas.evaluate((el, [bgR, bgG, bgB]) => {
        const canvas = el as HTMLCanvasElement;
        const context = canvas.getContext('2d');
        if (!context) return false;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const { data } = context.getImageData(0, 0, Math.round(45 * scaleX), Math.round(45 * scaleY));
        for (let i = 0; i < data.length; i += 4) {
          if (
            Math.abs(data[i]! - bgR) > 30 ||
            Math.abs(data[i + 1]! - bgG) > 30 ||
            Math.abs(data[i + 2]! - bgB) > 30
          ) {
            return true;
          }
        }
        return false;
      }, originBg);

    const canvasBox = (await lowerCanvas.boundingBox())!;
    await player.mouse.move(canvasBox.x + 15, canvasBox.y + 15);
    await player.mouse.down();
    await player.mouse.move(canvasBox.x + 35, canvasBox.y + 35, { steps: 3 });
    await player.mouse.up();
    await expect.poll(hasInkNearOrigin, { timeout: 3000 }).toBe(true);

    // Simulate device rotation.
    const before = player.viewportSize()!;
    await player.setViewportSize({ width: before.height, height: before.width });

    await assertCanvasFillsViewport();
    expect(await hasInkNearOrigin()).toBe(true);

    await endSession(page);
  });

  test('US2 — eraser removes only the touched marks', async ({ page, context }) => {
    test.setTimeout(30000);

    const player = await createAndJoinActiveSession(page, context, 'Efface un carre', 'Uma');

    const lowerCanvas = player.locator('#canvas-container canvas.lower-canvas');
    const canvasBox = (await lowerCanvas.boundingBox())!;

    const drag = async (fromX: number, fromY: number, toX: number, toY: number): Promise<void> => {
      await player.mouse.move(canvasBox.x + fromX, canvasBox.y + fromY);
      await player.mouse.down();
      await player.mouse.move(canvasBox.x + toX, canvasBox.y + toY, { steps: 5 });
      await player.mouse.up();
    };

    const eraserBg = await getCanvasBackgroundRgb(player);
    const hasInkAt = async (cssX: number, cssY: number): Promise<boolean> =>
      lowerCanvas.evaluate(
        (el, [x, y, bgR, bgG, bgB]) => {
          const canvas = el as HTMLCanvasElement;
          const context = canvas.getContext('2d');
          if (!context) return false;
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          const size = Math.max(Math.round(8 * scaleX), 6);
          const data = context.getImageData(
            Math.max(Math.round(x * scaleX) - size / 2, 0),
            Math.max(Math.round(y * scaleY) - size / 2, 0),
            size,
            size,
          ).data;
          for (let i = 0; i < data.length; i += 4) {
            if (
              Math.abs(data[i]! - bgR) > 30 ||
              Math.abs(data[i + 1]! - bgG) > 30 ||
              Math.abs(data[i + 2]! - bgB) > 30
            ) {
              return true;
            }
          }
          return false;
        },
        [cssX, cssY, ...eraserBg] as [number, number, number, number, number],
      );

    // Stroke A and stroke B: two horizontal segments far enough apart that
    // erasing one cannot accidentally touch the other.
    await drag(40, 40, 90, 40);
    await drag(40, 150, 90, 150);
    await expect.poll(() => hasInkAt(65, 40), { timeout: 3000 }).toBe(true);
    await expect.poll(() => hasInkAt(65, 150), { timeout: 3000 }).toBe(true);

    // Switch to the eraser and drag back over stroke A only.
    const eraserButton = player.locator('.drawing-toolbar__eraser');
    await eraserButton.click();
    await expect(eraserButton).toHaveAttribute('aria-pressed', 'true');
    await drag(40, 40, 90, 40);

    // Stroke A is gone; stroke B, never touched by the eraser, is unaffected.
    await expect.poll(() => hasInkAt(65, 40), { timeout: 3000 }).toBe(false);
    expect(await hasInkAt(65, 150)).toBe(true);

    // Switching back to draw mode resumes normal drawing.
    await eraserButton.click();
    await expect(eraserButton).toHaveAttribute('aria-pressed', 'false');
    await drag(40, 250, 90, 250);
    await expect.poll(() => hasInkAt(65, 250), { timeout: 3000 }).toBe(true);

    await endSession(page);
  });

  test('US3 — color control only affects strokes drawn after the change', async ({ page, context }) => {
    test.setTimeout(30000);

    const player = await createAndJoinActiveSession(page, context, 'Colore un ballon', 'Vic');

    const lowerCanvas = player.locator('#canvas-container canvas.lower-canvas');
    const canvasBox = (await lowerCanvas.boundingBox())!;

    const drag = async (fromX: number, fromY: number, toX: number, toY: number): Promise<void> => {
      await player.mouse.move(canvasBox.x + fromX, canvasBox.y + fromY);
      await player.mouse.down();
      await player.mouse.move(canvasBox.x + toX, canvasBox.y + toY, { steps: 5 });
      await player.mouse.up();
    };

    const pixelColorAt = async (cssX: number, cssY: number): Promise<[number, number, number]> =>
      lowerCanvas.evaluate(
        (el, [x, y]) => {
          const canvas = el as HTMLCanvasElement;
          const context = canvas.getContext('2d')!;
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          const data = context.getImageData(Math.round(x * scaleX), Math.round(y * scaleY), 1, 1).data;
          return [data[0], data[1], data[2]] as [number, number, number];
        },
        [cssX, cssY],
      );

    // First stroke, drawn with the default color.
    await drag(40, 40, 90, 40);
    await expect.poll(async () => (await pixelColorAt(65, 40))[0], { timeout: 3000 }).toBeGreaterThan(200);
    const defaultStrokeColor = await pixelColorAt(65, 40);

    // Change color, then draw a second, spatially separate stroke.
    await player.locator('.drawing-toolbar__color').evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, '#ff0000');
    await drag(40, 150, 90, 150);

    await expect.poll(async () => (await pixelColorAt(65, 150))[0], { timeout: 3000 }).toBeGreaterThan(200);
    const newStrokeColor = await pixelColorAt(65, 150);
    expect(newStrokeColor[0]).toBeGreaterThan(200);
    expect(newStrokeColor[1]).toBeLessThan(50);
    expect(newStrokeColor[2]).toBeLessThan(50);

    // The earlier stroke must keep its original color.
    expect(await pixelColorAt(65, 40)).toEqual(defaultStrokeColor);

    await endSession(page);
  });

  test('US4 — stroke size control only affects strokes drawn after the change', async ({ page, context }) => {
    test.setTimeout(30000);

    const player = await createAndJoinActiveSession(page, context, 'Trace un trait epais', 'Theo');

    const lowerCanvas = player.locator('#canvas-container canvas.lower-canvas');
    const canvasBox = (await lowerCanvas.boundingBox())!;

    const drag = async (fromX: number, fromY: number, toX: number, toY: number): Promise<void> => {
      await player.mouse.move(canvasBox.x + fromX, canvasBox.y + fromY);
      await player.mouse.down();
      await player.mouse.move(canvasBox.x + toX, canvasBox.y + toY, { steps: 5 });
      await player.mouse.up();
    };

    // Approximates rendered stroke thickness in px by counting non-background
    // pixels along a short vertical scan line perpendicular to a horizontal
    // stroke, centered on it.
    const thicknessBg = await getCanvasBackgroundRgb(player);
    const strokeThicknessAt = async (cssX: number, cssYCenter: number): Promise<number> =>
      lowerCanvas.evaluate(
        (el, [x, yCenter, bgR, bgG, bgB]) => {
          const canvas = el as HTMLCanvasElement;
          const context = canvas.getContext('2d')!;
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          const scanHeightCss = 50;
          const px = Math.round(x * scaleX);
          const topY = Math.max(Math.round((yCenter - scanHeightCss / 2) * scaleY), 0);
          const height = Math.round(scanHeightCss * scaleY);
          const data = context.getImageData(px, topY, 1, height).data;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (
              Math.abs(data[i]! - bgR) > 30 ||
              Math.abs(data[i + 1]! - bgG) > 30 ||
              Math.abs(data[i + 2]! - bgB) > 30
            ) {
              count++;
            }
          }
          return count;
        },
        [cssX, cssYCenter, ...thicknessBg] as [number, number, number, number, number],
      );

    // First stroke, drawn at the default width.
    await drag(40, 60, 90, 60);
    await expect.poll(() => strokeThicknessAt(65, 60), { timeout: 3000 }).toBeGreaterThan(0);
    const defaultThickness = await strokeThicknessAt(65, 60);

    // Widen the stroke size, then draw a second, spatially separate stroke.
    await player.locator('.drawing-toolbar__width').evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, '20');
    await drag(40, 180, 90, 180);

    await expect
      .poll(() => strokeThicknessAt(65, 180), { timeout: 3000 })
      .toBeGreaterThan(defaultThickness * 1.5);

    // The earlier stroke must keep its original thickness.
    expect(await strokeThicknessAt(65, 60)).toBe(defaultThickness);

    await endSession(page);
  });
});

test.describe('Party game hub, rounds, and podium (004-party-game-hub)', () => {
  test('US1 — configured rounds are counted, timed, and bounded', async ({ page, context }) => {
    test.setTimeout(30000);

    await createConfiguredSession(page, { durationSec: 30, rounds: 3, phrase: 'Manche un' });
    await page.waitForSelector('#qr-code[src]', { timeout: 5000 });
    const joinUrl = (await page.textContent('#join-url'))!.trim();

    const player = await context.newPage();
    await player.goto(joinUrl);
    await player.fill('#name', 'Gaspard');
    await player.click('#join-form button[type="submit"]');
    await player.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    await page.click('#start-game');
    await page.waitForURL(`${BASE_URL}/#/host/game`, { timeout: 5000 });

    await expect(page.locator('#round-counter')).toHaveText('Manche 1/3');
    await expect(page.locator('#round-timer')).toHaveText('0:30', { timeout: 3000 });
    await expect
      .poll(async () => page.locator('#round-timer').textContent(), { timeout: 3000 })
      .not.toBe('0:30');

    // Round 1 -> 2
    await page.click('#next-question');
    await expect(page.locator('#round-counter')).toHaveText('Manche 2/3');
    await expect(page.locator('#round-timer')).toHaveText('0:30');

    // Round 2 -> 3 (last configured round)
    await page.click('#next-question');
    await expect(page.locator('#round-counter')).toHaveText('Manche 3/3');
    await expect(page.locator('#next-question')).toBeDisabled();

    await endSession(page);
  });

  test('US2 — player finishes drawing, host scores rounds (skipping one), and podium matches on both ends', async ({ page, context }) => {
    test.setTimeout(30000);

    await createConfiguredSession(page, { durationSec: 30, rounds: 3, phrase: 'Manche un' });
    await page.waitForSelector('#qr-code[src]', { timeout: 5000 });
    const joinUrl = (await page.textContent('#join-url'))!.trim();

    const player = await context.newPage();
    await player.goto(joinUrl);
    await player.fill('#name', 'Ines');
    await player.click('#join-form button[type="submit"]');
    await player.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    await page.click('#start-game');
    await page.waitForURL(`${BASE_URL}/#/host/game`, { timeout: 5000 });

    const scoreRow = page.locator('[data-player-name="Ines"]');
    await expect(scoreRow.locator('[data-role="points-status"]')).toHaveText('dessine…', { timeout: 3000 });

    // Player signals they're done; host sees the live status change (FR-012/FR-013)
    await player.click('#finish-drawing');
    await expect(player.locator('#draw-wait')).toBeVisible();
    await expect(scoreRow.locator('[data-role="points-status"]')).toHaveText('a terminé ✓', { timeout: 3000 });

    // Round 1 scored
    await scoreRow.locator('[data-role="points-input"]').fill('7');
    await page.click('#submit-scores');

    // Round 2 -> deliberately NOT scored (FR-011 non-blocking)
    await page.click('#next-question');
    await expect(page.locator('#round-counter')).toHaveText('Manche 2/3');
    await page.click('#next-question');
    await expect(page.locator('#round-counter')).toHaveText('Manche 3/3');

    // Round 3 scored
    await scoreRow.locator('[data-role="points-input"]').fill('3');
    await page.click('#submit-scores');

    // End the game (not necessarily on a scored round boundary constraint)
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('#end-game');
    await page.waitForURL(`${BASE_URL}/#/results`, { timeout: 5000 });
    await player.waitForURL(`${BASE_URL}/#/results`, { timeout: 5000 });

    // Both host and player see the same podium/total — 7 + 0 + 3 = 10
    await expect(page.locator('[data-player-name="Ines"] [data-role="points"]')).toHaveText('10 pts', { timeout: 5000 });
    await expect(player.locator('[data-player-name="Ines"] [data-role="points"]')).toHaveText('10 pts', { timeout: 5000 });

    await player.close();
  });

  test('US2 — results show a plain participant list, no podium, when points are disabled', async ({ page, context }) => {
    test.setTimeout(20000);

    await loginAsHost(page);
    await page.click('[data-game-key="ardoise"]');
    await page.waitForURL(`${BASE_URL}/#/host/config`, { timeout: 5000 });
    await page.click('#points-toggle');
    await page.fill('#initial-phrase-input', 'Sans points');
    await page.click('#create-game');
    await page.waitForURL(`${BASE_URL}/#/host/lobby`, { timeout: 5000 });
    await page.waitForSelector('#qr-code[src]', { timeout: 5000 });
    const joinUrl = (await page.textContent('#join-url'))!.trim();

    const player = await context.newPage();
    await player.goto(joinUrl);
    await player.fill('#name', 'Jules');
    await player.click('#join-form button[type="submit"]');
    await player.waitForURL(`${BASE_URL}/#/player/game`, { timeout: 5000 });

    await page.click('#start-game');
    await page.waitForURL(`${BASE_URL}/#/host/game`, { timeout: 5000 });
    await expect(page.locator('#scoring-section')).toBeHidden();

    page.once('dialog', (dialog) => dialog.accept());
    await page.click('#end-game');
    await page.waitForURL(`${BASE_URL}/#/results`, { timeout: 5000 });

    await expect(page.locator('#podium')).toBeHidden();
    await expect(page.locator('#participant-list')).toContainText('Jules');

    await player.close();
  });

  test('US3 — hub lists the playable game and inert placeholders', async ({ page }) => {
    test.setTimeout(15000);

    await page.goto(`${BASE_URL}/#/login`);
    await page.fill('#username', 'admin');
    await page.fill('#password', process.env['HOST_PASSWORD'] ?? 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/#/host/hub`, { timeout: 5000 });

    const playableCard = page.locator('[data-game-key="ardoise"]');
    await expect(playableCard).toHaveAttribute('data-playable', 'true');

    const inertCard = page.locator('.card[data-playable="false"]').first();
    await expect(inertCard).toBeVisible();
    await inertCard.click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('#/host/hub');

    await playableCard.click();
    await page.waitForURL(`${BASE_URL}/#/host/config`, { timeout: 5000 });
  });
});
