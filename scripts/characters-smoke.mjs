import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.GAME_URL || 'http://localhost:5174/';
const key = 'puzzle-2048-character-v1';
const gameKey = 'puzzle-2048-v1';
const out = fileURLToPath(new URL('../artifacts/', import.meta.url));
const identities = ['classic', 'chiikawa', 'hachiware', 'usagi', 'mole-croquette', 'old-dog', 'bear-raincoat', 'bear-pajama', 'bear-ninja', 'kurimanju', 'momonga', 'rakko', 'shisa', 'furuhonya', 'bear-strawberry', 'bear-frog', 'bear-astronaut', 'bear-chef', 'bear-pirate'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = [];
const errors = [];
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
const selected = page => page.locator('[data-character][aria-pressed="true"]').getAttribute('data-character');
const readGame = page => page.evaluate(key => localStorage.getItem(key), gameKey);
const openPicker = page => page.locator('.companion-summary').click();
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth === innerWidth);

async function setup(mode = '', viewport = { width: 1440, height: 900 }, raw = '') {
  const context = await browser.newContext({ viewport });
  contexts.push(context);
  await context.addInitScript(({ key, gameKey, mode, raw }) => {
    if (mode === 'blocked') {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage denied', 'SecurityError'); } });
      return;
    }
    if (!sessionStorage.getItem('characters-fixture')) {
      if (mode === 'invalid') localStorage.setItem(key, raw);
      // Avoid random initial boards in the keyboard-isolation test. No app/internal imports.
      localStorage.setItem(gameKey, JSON.stringify({ version: 1, best: 128, current: { board: [0, 0, 0, 2, ...Array(12).fill(0)], score: 0, won: false, continued: false, previous: null } }));
      sessionStorage.setItem('characters-fixture', '1');
    }
  }, { key, gameKey, mode, raw });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.companion-summary').waitFor();
  return page;
}

try {
  await mkdir(out, { recursive: true });
  const page = await setup();
  check('visible companion has the default portrait and name without covering board', await page.locator('.companion-portrait').isVisible() && await page.locator('.companion-name').textContent() === 'Joke Bear' && !await page.locator('#character-picker').evaluate(el => el.open) && await page.locator('#board').isVisible());
  check('desktop companion does not introduce horizontal overflow', await noOverflow(page));
  await page.screenshot({ path: `${out}/characters-desktop.png`, fullPage: true });
  await openPicker(page);
  check('native details exposes exactly all nineteen selectable identities', await page.locator('[data-character]').count() === 19 && JSON.stringify(await page.locator('[data-character]').evaluateAll(els => els.map(el => el.dataset.character))) === JSON.stringify(identities));
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.companion-option img')).every(img => img.complete && img.naturalWidth > 0));
  check('all nineteen local WebP portraits load with meaningful alt text', await page.locator('.companion-option img').evaluateAll(imgs => imgs.every(img => img.naturalWidth > 0 && img.alt.length > 2 && new URL(img.src).pathname.endsWith('.webp'))));
  check('portrait URLs stay on this game subpath', await page.locator('.companion-option img').evaluateAll(imgs => imgs.every(img => new URL(img.src).href.startsWith(new URL('./characters-2d/', location.href).href))));
  check('each selector has an accessible name and one pressed state', await page.locator('[data-character]').evaluateAll(buttons => buttons.every(b => b.getAttribute('aria-label')?.startsWith('选择') && ['true', 'false'].includes(b.getAttribute('aria-pressed'))) && buttons.filter(b => b.getAttribute('aria-pressed') === 'true').length === 1));
  await page.screenshot({ path: `${out}/characters-collection.png`, fullPage: true });
  const savedBoard = await readGame(page);
  // Select every character through the public UI, not only a single representative.
  for (const id of identities) {
    if (!await page.locator('#character-picker').evaluate(el => el.open)) await openPicker(page);
    await page.locator(`[data-character="${id}"]`).click();
    assert.equal(await selected(page), id);
    assert.equal(await page.locator('#character-picker').evaluate(el => el.open), false);
    assert.ok(await page.locator('.companion-summary').evaluate(el => el === document.activeElement));
    assert.ok((await page.locator('.companion-portrait').getAttribute('src')).endsWith(`/${id}.webp`));
  }
  check('all nineteen choices update portrait, pressed state, close and restore summary focus', await selected(page) === 'bear-pirate');
  check('selection storage is versioned and separate from the unchanged game save', await page.evaluate(key => { const value = JSON.parse(localStorage.getItem(key)); return value.version === 1 && value.id === 'bear-pirate'; }, key) && await readGame(page) === savedBoard);
  await page.reload({ waitUntil: 'networkidle' });
  check('refresh preserves chosen character, portrait and full name', await selected(page) === 'bear-pirate' && await page.locator('.companion-name').textContent() === '海盗熊' && (await page.locator('.companion-portrait').getAttribute('src')).endsWith('/bear-pirate.webp'));
  await page.locator('.companion-summary').focus(); await page.keyboard.press('Enter');
  check('keyboard Enter opens native character details with a visible focus ring', await page.locator('#character-picker').evaluate(el => el.open) && await page.locator('.companion-summary').evaluate(el => getComputedStyle(el).outlineStyle !== 'none'));
  await page.keyboard.press('Tab');
  check('keyboard Tab reaches the first character with a clear focus indicator', await page.locator('[data-character="classic"]').evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'));
  const beforeArrows = await readGame(page);
  await page.keyboard.press('ArrowLeft');
  check('arrows inside character selector do not move the game', await readGame(page) === beforeArrows);
  await page.keyboard.press('Escape');
  check('Escape collapses details and returns focus to summary', !await page.locator('#character-picker').evaluate(el => el.open) && await page.locator('.companion-summary').evaluate(el => el === document.activeElement));
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  check('keyboard Space selects a character and returns to the collapsed summary', await selected(page) === 'classic' && !await page.locator('#character-picker').evaluate(el => el.open) && await page.locator('.companion-summary').evaluate(el => el === document.activeElement));
  await page.locator('#board').focus(); await page.keyboard.press('ArrowLeft');
  check('game keys still perform a real move after character interaction', await readGame(page) !== beforeArrows);
  await page.waitForFunction(() => !document.querySelector('#board').dataset.motion);
  check('existing real movement settles without ghost tiles', await page.locator('.motion-tile').count() === 0 && await page.locator('[data-cell="0"]').getAttribute('data-value') === '2');

  for (const [name, raw] of [['broken JSON', '{bad'], ['unknown id', '{"version":1,"id":"not-a-character"}'], ['wrong field type', '{"version":1,"id":19}'], ['unsupported version', '{"version":2,"id":"usagi"}']]) {
    const invalid = await setup('invalid', undefined, raw);
    check(`${name} character preference safely defaults`, await selected(invalid) === 'classic' && await invalid.locator('.companion-name').textContent() === 'Joke Bear');
  }
  const blocked = await setup('blocked');
  await openPicker(blocked); await blocked.locator('[data-character="usagi"]').click();
  check('blocked storage still allows choosing a character with a fallback notice', await selected(blocked) === 'usagi' && (await blocked.locator('.companion-feedback').textContent()).includes('无法保存'));
  await blocked.reload({ waitUntil: 'networkidle' });
  check('blocked storage reload safely returns to default', await selected(blocked) === 'classic');

  const mobile = await setup('', { width: 360, height: 844 });
  check('360px companion and board remain visible with no horizontal overflow', await noOverflow(mobile) && await mobile.locator('.companion-summary').isVisible() && await mobile.locator('#board').isVisible());
  await mobile.screenshot({ path: `${out}/characters-mobile-360.png`, fullPage: true });
  await openPicker(mobile);
  check('360px expanded nineteen-character grid has no horizontal overflow', await noOverflow(mobile) && await mobile.locator('[data-character]').count() === 19);
  await mobile.screenshot({ path: `${out}/characters-mobile-grid-360.png`, fullPage: true });
  await mobile.locator('[data-character="bear-raincoat"]').click();
  check('360px longest character name fits after selection', await noOverflow(mobile) && await mobile.locator('.companion-name').textContent() === '小黄鸭雨衣熊' && !await mobile.locator('#character-picker').evaluate(el => el.open));
  check('no product cheat globals were added', await mobile.evaluate(() => !('game' in window) && !('__GAME__' in window) && !('CHARACTERS' in window)));
  check('no pageerror, console error or HTTP resource failure', errors.length === 0);
  await writeFile(`${out}/characters-results.json`, JSON.stringify({ base, passed: checks.length, checks, errors }, null, 2));
  console.log(`\n${checks.length} character checks passed against ${base}`);
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  if (errors.length) console.error(errors);
}
