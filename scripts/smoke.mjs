import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.GAME_URL || 'http://localhost:5174';
const out = fileURLToPath(new URL('../artifacts/', import.meta.url));
const key = 'puzzle-2048-v1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const checks = [];
const contexts = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
const row = (...values) => [...values, ...Array(16 - values.length).fill(0)];
const snapshot = (board, score = 0) => ({ board, score, won: false, continued: false, previous: null });
const fixture = (board, score = 0, best = 128) => ({ version: 1, best, current: snapshot(board, score) });
const scene = fixture([2, 4, 8, 16, 4, 8, 16, 32, 0, 2, 64, 128, 0, 0, 4, 256], 512, 2048);
const getSave = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const click = (page, direction) => page.locator(`[data-direction="${direction}"]`).click();
const stateMatches = (page, board) => page.waitForFunction(({ key, board }) => JSON.stringify(JSON.parse(localStorage.getItem(key)).current.board) === JSON.stringify(board), { key, board });

async function setup(save, options = {}, mode = '') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  contexts.push(context);
  if (save !== undefined || mode) await context.addInitScript(({ save, key, mode }) => {
    if (mode === 'blocked') {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
    } else if (!sessionStorage.getItem('fixture-seeded')) {
      localStorage.setItem(key, mode === 'corrupt' ? '{broken JSON' : JSON.stringify(save));
      sessionStorage.setItem('fixture-seeded', '1');
    }
  }, { save, key, mode });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`pageerror ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.tile').last().waitFor();
  return { page, context };
}

async function swipe(page, context, direction) {
  const box = await page.locator('#board').boundingBox();
  assert.ok(box);
  const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  const dx = direction === 'left' ? -95 : direction === 'right' ? 95 : 0;
  const dy = direction === 'up' ? -95 : direction === 'down' ? 95 : 0;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 5, y: y + dy * i / 5, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

try {
  await mkdir(out, { recursive: true });
  const { page } = await setup(fixture(row(2, 2)));
  check('desktop has sixteen cells and no horizontal overflow', await page.locator('.tile').count() === 16 && await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await page.locator('#help').focus();
  await page.keyboard.press('ArrowLeft');
  check('direction keys outside game focus do not move tiles', (await getSave(page)).current.score === 0);
  await page.locator('#board').focus();
  check('board has a visible keyboard focus ring', await page.locator('#board').evaluate(el => getComputedStyle(el).outlineStyle !== 'none'));
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).current.score === 4, key);
  const merged = (await getSave(page)).current;
  check('real keyboard merges and spawns one tile', merged.board[0] === 4 && merged.board.filter(Boolean).length === 2);
  await page.reload({ waitUntil: 'networkidle' });
  check('reload preserves exact board, score and undo', JSON.stringify((await getSave(page)).current) === JSON.stringify(merged));
  await page.locator('#undo').click();
  await stateMatches(page, row(2, 2));
  check('undo restores board and score, retains best, and is one-use', (await getSave(page)).current.score === 0 && (await getSave(page)).best === 128 && await page.locator('#undo').isDisabled());
  await page.locator('#help').focus(); await page.keyboard.press('Enter');
  check('help opens via keyboard with complete rules', await page.locator('dialog').isVisible() && (await page.locator('.rules').textContent()).includes('每块在一个回合只合并一次'));
  await page.keyboard.press('ArrowRight');
  check('arrows do not control board while dialog is open', (await getSave(page)).current.score === 0);
  await page.keyboard.press('Tab');
  check('dialog traps keyboard focus', await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)));
  await page.keyboard.press('Escape');
  check('Escape closes help and restores focus', !await page.locator('dialog').isVisible() && await page.locator('#help').evaluate(el => el === document.activeElement));
  await click(page, 'left');
  check('direction button performs real move', (await getSave(page)).current.score === 4);
  await page.locator('#restart').click(); await page.keyboard.press('Escape');
  check('cancel restart keeps current game', (await getSave(page)).current.score === 4);
  await page.locator('#restart').click(); await page.locator('[data-dialog="new"]').click();
  const restarted = await getSave(page);
  check('confirmed restart resets board, score and undo but keeps best', restarted.current.board.filter(Boolean).length === 2 && restarted.current.score === 0 && restarted.current.previous === null && restarted.best === 128);
  await click(page, 'left'); await page.locator('#restart').click();
  await page.locator('[data-dialog="new"]').dblclick();
  check('rapid restart never leaks old game state', (await getSave(page)).current.score === 0 && (await getSave(page)).current.previous === null);

  const invalid = (await setup(fixture(row(2)))).page;
  const beforeInvalid = await getSave(invalid);
  await click(invalid, 'left'); await click(invalid, 'up');
  check('invalid moves never spawn tiles or add undo', JSON.stringify(await getSave(invalid)) === JSON.stringify(beforeInvalid));

  const won = (await setup(fixture(row(1024, 1024), 128, 128))).page;
  await click(won, 'left');
  check('real final move makes 2048 and opens victory dialog', (await getSave(won)).current.board.includes(2048) && await won.locator('dialog').isVisible() && await won.locator('[data-dialog="continue"]').isVisible());
  await won.screenshot({ path: `${out}/victory.png`, fullPage: true });
  await won.locator('[data-dialog="undo"]').click();
  check('winning move can be undone without erasing best', (await getSave(won)).current.board[0] === 1024 && (await getSave(won)).current.won === false && (await getSave(won)).best === 2176);
  await click(won, 'left'); await won.locator('[data-dialog="continue"]').click();
  await click(won, 'right');
  check('continue permits further real moves without repeat win dialog', (await getSave(won)).current.continued === true && !await won.locator('dialog').isVisible());
  await won.reload({ waitUntil: 'networkidle' });
  check('continued victory persists across reload', !await won.locator('dialog').isVisible() && (await getSave(won)).current.continued === true);

  const losingBoard = [2, 4, 2, 4, 4, 2, 4, 2, 32, 64, 32, 64, 8, 16, 8, 0];
  const lost = (await setup(fixture(losingBoard, 384, 512))).page;
  await click(lost, 'right');
  check('real final move fills a dead board and opens game-over dialog', (await getSave(lost)).current.board.every(Boolean) && (await lost.locator('#dialog-title').textContent()).includes('先到这里'));
  await lost.screenshot({ path: `${out}/game-over.png`, fullPage: true });
  await lost.reload({ waitUntil: 'networkidle' });
  check('game-over state and available undo persist after reload', await lost.locator('[data-dialog="undo"]').isEnabled());
  await lost.locator('[data-dialog="undo"]').click();
  await stateMatches(lost, losingBoard);
  check('undo exits game-over with exact previous board', !await lost.locator('dialog').isVisible());
  await click(lost, 'right'); await lost.locator('[data-dialog="new"]').click();
  check('game-over restart creates a fresh playable game', (await getSave(lost)).current.board.filter(Boolean).length === 2 && (await getSave(lost)).current.score === 0);

  const showcase = (await setup(scene)).page;
  await showcase.screenshot({ path: `${out}/desktop-1440.png`, fullPage: true });
  check('no product cheat globals are exposed', await showcase.evaluate(() => !('game' in window) && !('__GAME__' in window)));

  const mobile = await setup(fixture(row(2, 2)), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await swipe(mobile.page, mobile.context, 'left');
  check('real touch swipe merges tiles on 390px mobile', (await getSave(mobile.page)).current.score === 4);
  await swipe(mobile.page, mobile.context, 'down');
  check('real vertical touch swipe changes board and retains correct score', (await getSave(mobile.page)).current.previous !== null);
  check('390px mobile has no horizontal overflow', await mobile.page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await mobile.page.screenshot({ path: `${out}/mobile-390.png`, fullPage: true });
  await mobile.page.locator('#help').tap();
  check('mobile help opens with tappable dismissal', await mobile.page.locator('[data-dialog="close"]').isVisible());
  await mobile.page.locator('[data-dialog="close"]').tap();
  await mobile.page.locator('#undo').tap();
  check('mobile tap undo works', await mobile.page.locator('#undo').isDisabled());
  await mobile.page.locator('#restart').tap(); await mobile.page.locator('[data-dialog="new"]').tap();
  check('mobile tap restart works', (await getSave(mobile.page)).current.score === 0);
  const small = await setup(scene, { viewport: { width: 360, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await click(small.page, 'left');
  check('360px mobile has no horizontal overflow', await small.page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  check('reduced motion disables tile animation without blocking state changes', await small.page.locator('.tile').first().evaluate(el => getComputedStyle(el).animationName === 'none') && (await getSave(small.page)).current.previous !== null);
  await small.page.screenshot({ path: `${out}/mobile-360-reduced-motion.png`, fullPage: true });

  const blocked = (await setup(undefined, {}, 'blocked')).page;
  await click(blocked, 'left'); await click(blocked, 'down');
  check('unavailable storage still supports playing with fallback notice', await blocked.locator('#storage-note').isVisible() && await blocked.locator('.tile.filled').count() >= 2);
  const corrupt = (await setup(undefined, {}, 'corrupt')).page;
  check('corrupt storage recovers to playable new game', (await getSave(corrupt)).version === 1 && (await getSave(corrupt)).current.board.filter(Boolean).length === 2);
  const wrongFields = (await setup({ version: 1, best: 'bad', current: { board: [3] } })).page;
  check('invalid storage fields recover safely', (await getSave(wrongFields)).best === 0 && (await getSave(wrongFields)).current.board.length === 16);
  check('no pageerror, console error or HTTP 404/error', errors.length === 0);
  await writeFile(`${out}/smoke-results.json`, JSON.stringify({ base, passed: checks.length, checks, errors }, null, 2));
  console.log(`\n${checks.length} browser checks passed against ${base}. Screenshots: ${out}`);
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  if (errors.length) console.error(errors);
}
