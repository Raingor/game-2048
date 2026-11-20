import './style.css';
import { continueGame, createGame, moveWithTrace, status, undo, type Direction } from './engine';
import { BoardMotion } from './motion';
import { loadSave, saveGame } from './storage';
import { mountCharacters } from './characters';

const saved = loadSave();
let game = saved.current ?? createGame();
let best = saved.best;
let dialogKind = '';
let savedFocus: HTMLElement | null = null;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="page-shell">
    <header class="masthead"><a class="wordmark" href="./" aria-label="陶土之间 首页"><span class="brand-mark" aria-hidden="true">◒</span> 陶土之间</a><span class="edition">数字小憩 / Nº 01</span></header>
    <main class="layout">
      <section class="introduction" aria-labelledby="title">
        <p class="eyebrow"><span></span> 合而为一，慢慢来。</p>
        <h1 id="title">2048<span class="title-dot">.</span></h1>
        <p class="subtitle">把相同的数字，<br>推向新的可能。</p>
        <p class="intro-copy">不必赶时间。让指尖找到方向，<br>在四乘四的小天地里，积木成诗。</p>
        <button class="text-button" id="help">玩法说明 <span aria-hidden="true">＋</span></button>
        <div class="character-host" id="characters"></div>
      </section>
      <section class="game" aria-label="2048 游戏区域">
        <div class="game-top"><p class="score-line">分数 <strong id="score">0</strong><span class="score-divider">/</span><span>最高 <b id="best">0</b></span></p><span class="target">目标 <b>2048</b></span></div>
        <div id="board" class="board" tabindex="0" role="group" aria-label="2048 棋盘，使用方向键或触摸滑动" aria-describedby="board-hint"></div>
        <div class="below-board"><p id="game-status" role="status" aria-live="polite">新的开始，向任意方向试试。</p><span class="board-size">4 × 4</span></div>
        <div class="game-actions"><button id="undo" class="button secondary" disabled><span aria-hidden="true">↶</span> 撤销一步</button><button id="restart" class="button primary"><span aria-hidden="true">↻</span> 重新开始</button></div>
        <div class="controls"><p id="board-hint"><span class="desktop-hint">点击棋盘后使用方向键<br></span>也可滑动棋盘，或轻点方向按钮</p><div class="direction-pad" role="group" aria-label="方向控制"><button data-direction="up" aria-label="向上移动">↑</button><button data-direction="left" aria-label="向左移动">←</button><button data-direction="down" aria-label="向下移动">↓</button><button data-direction="right" aria-label="向右移动">→</button></div></div>
        <p id="storage-note" class="storage-note" hidden>浏览器暂时无法保存，本局仍可正常游玩。</p>
      </section>
    </main>
    <footer><span>小小方寸 · 大大可能</span><span>没有倒计时，只有下一步。</span></footer>
  </div>
  <dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-inner" id="dialog-content"></div></dialog>
`;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const board = $<HTMLDivElement>('#board');
const dialog = $<HTMLDialogElement>('#dialog');
const content = $('#dialog-content');
mountCharacters($('#characters'));

for (let i = 0; i < 16; i++) {
  const tile = document.createElement('div');
  tile.className = 'tile'; tile.dataset.cell = String(i);
  board.append(tile);
}

const cells = Array.from(board.querySelectorAll<HTMLDivElement>('[data-cell]'));
const motion = new BoardMotion(board, cells);

function persist() {
  best = Math.max(best, game.score);
  $('#storage-note').hidden = saveGame(game, best);
}

function render(message?: string) {
  cells.forEach((tile, i) => {
    const value = game.board[i];
    tile.className = `tile ${value ? `filled tile-${Math.min(value, 4096)}` : 'empty'}${value >= 1024 ? ' small-number' : ''}${value >= 16384 ? ' tiny-number' : ''}`;
    tile.textContent = value ? String(value) : '';
    tile.dataset.value = String(value);
    tile.setAttribute('aria-label', `第 ${Math.floor(i / 4) + 1} 行，第 ${i % 4 + 1} 列，${value || '空'}`);
  });
  $('#score').textContent = String(game.score);
  $('#best').textContent = String(best);
  $<HTMLButtonElement>('#undo').disabled = !game.previous;
  $('#game-status').textContent = message ?? (status(game) === 'playing' ? '寻找相同，留一点空白。' : status(game) === 'won' ? '2048 达成！新的可能还在继续。' : '棋盘已满，这一局也很精彩。');
}

function openDialog(kind: string) {
  motion.cancel();
  // A committed terminal move takes precedence over an incidental help/restart click.
  if (status(game) !== 'playing' && (kind === 'help' || kind === 'restart')) kind = status(game);
  savedFocus = document.activeElement as HTMLElement;
  dialogKind = kind;
  const views: Record<string, string> = {
    help: `<p class="dialog-eyebrow">HOW TO PLAY</p><h2 id="dialog-title">相遇，就合而为一。</h2><ol class="rules"><li>点击棋盘后按方向键，或在棋盘上滑动，让所有数字向同一方向移动。方向按钮也可以。</li><li>相同数字相遇会合并：<strong>2 + 2 = 4</strong>。每块在一个回合只合并一次，合并数字计入分数。</li><li>每次有效移动后出现一个 2 或 4；没有变化的移动不会生成新块。</li><li>合成 <strong>2048</strong> 即达成目标，可以继续挑战。没有空位且无法合并时，本局结束。</li><li>可撤销最近一次有效移动。当前棋盘与最高分自动保存在本浏览器；没有倒计时。</li></ol><button class="button primary full" data-dialog="close">明白了，开始吧</button>`,
    restart: `<p class="dialog-eyebrow">A FRESH START</p><h2 id="dialog-title">重新摆一盘？</h2><p class="dialog-copy">当前局面会清空，最高分会保留。<br>每个新的开始，都有新的可能。</p><div class="dialog-actions"><button class="button secondary" data-dialog="close">继续本局</button><button class="button primary" data-dialog="new">确认重开</button></div>`,
    won: `<p class="dialog-eyebrow">BEAUTIFULLY DONE</p><div class="result-seal" aria-hidden="true">2048</div><h2 id="dialog-title">每一步，都算数。</h2><p class="dialog-copy">你已合成 2048！本局 <strong>${game.score}</strong> 分。<br>继续往前，还会遇见更大的可能。</p><button class="button primary full" data-dialog="continue">继续挑战</button><div class="dialog-actions"><button class="button secondary" data-dialog="undo" ${game.previous ? '' : 'disabled'}>撤销一步</button><button class="button secondary" data-dialog="new">开启新局</button></div>`,
    over: `<p class="dialog-eyebrow">UNTIL THE NEXT MOVE</p><h2 id="dialog-title">这一盘，先到这里。</h2><p class="dialog-copy">没有可移动的方向了。<br>本局 <strong>${game.score}</strong> 分，最高 <strong>${best}</strong> 分。</p><button class="button primary full" data-dialog="new">再来一局</button><button class="button secondary full" data-dialog="undo" ${game.previous ? '' : 'disabled'}>撤销一步，再想想</button>`,
  };
  content.innerHTML = views[kind];
  if (!dialog.open) dialog.showModal();
}

function closeDialog() {
  dialog.close(); dialogKind = '';
  if (savedFocus?.isConnected && !(savedFocus as HTMLButtonElement).disabled) savedFocus.focus({ preventScroll: true });
  else board.focus({ preventScroll: true });
}

function checkResult() {
  const result = status(game);
  if (result !== 'playing' && !dialog.open) openDialog(result);
}

function play(direction: Direction) {
  if (dialog.open) return;
  // Every input acts on the already-committed state. Interrupting visual motion never drops a move.
  motion.cancel();
  if (status(game) !== 'playing') { checkResult(); return; }
  const before = game;
  const next = moveWithTrace(game, direction);
  game = next.state;
  if (!next.trace) { render('这个方向暂时不行，换个方向试试。'); return; }
  const gain = game.score - before.score;
  persist(); render(gain ? `合而为一，获得 ${gain} 分。` : '挪出一点空间，等待新的相遇。');
  void motion.play(next.trace, checkResult);
}

function undoMove() {
  motion.cancel();
  game = undo(game); persist(); render('已撤销一步。换个方向，也许不同。');
}

$('#help').addEventListener('click', () => openDialog('help'));
$('#restart').addEventListener('click', () => openDialog('restart'));
$('#undo').addEventListener('click', undoMove);
$('.direction-pad').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-direction]');
  if (button) play(button.dataset.direction as Direction);
});
content.addEventListener('click', event => {
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-dialog]')?.dataset.dialog;
  if (!action) return;
  if (action === 'close') { closeDialog(); return; }
  closeDialog();
  if (action === 'continue') { game = continueGame(game); persist(); render('2048 只是起点。继续，看看下一块。'); checkResult(); }
  if (action === 'new') { game = createGame(); persist(); render('新的开始，向任意方向试试。'); }
  if (action === 'undo') undoMove();
  board.focus({ preventScroll: true });
});
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const first = controls[0]; const last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
});
dialog.addEventListener('cancel', event => {
  if (dialogKind === 'won' || dialogKind === 'over') event.preventDefault();
  else { event.preventDefault(); closeDialog(); }
});

document.addEventListener('keydown', event => {
  if (dialog.open || !(event.target instanceof HTMLElement) || !event.target.closest('.game') ||
    event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select, [contenteditable]')) return;
  const map: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (map[event.key]) { event.preventDefault(); play(map[event.key]); }
});

let pointer: { id: number; x: number; y: number } | null = null;
board.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || dialog.open) return;
  board.focus({ preventScroll: true });
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  board.setPointerCapture(event.pointerId);
});
board.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const dx = event.clientX - pointer.x; const dy = event.clientY - pointer.y;
  pointer = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy) * 1.15) play(dx > 0 ? 'right' : 'left');
  else if (Math.abs(dy) > Math.abs(dx) * 1.15) play(dy > 0 ? 'down' : 'up');
});
board.addEventListener('pointercancel', () => { pointer = null; });
board.addEventListener('lostpointercapture', () => { pointer = null; });

function settlePresentation() { motion.cancel(); checkResult(); }
window.addEventListener('resize', settlePresentation);
document.addEventListener('visibilitychange', settlePresentation);
window.addEventListener('pagehide', () => motion.cancel());
motion.preference.addEventListener('change', settlePresentation);

persist(); render(saved.current ? '欢迎回来，接着上次的灵感。' : '新的开始，向任意方向试试。'); checkResult();
