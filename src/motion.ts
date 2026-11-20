import type { MoveTrace } from './engine';

/** Presentation only. Rules/save commit synchronously; cancellation never rolls a turn back. */
export class BoardMotion {
  private generation = 0;
  private animations: Animation[] = [];
  private layer: HTMLDivElement;
  readonly preference = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private board: HTMLElement, private cells: HTMLElement[]) {
    this.layer = document.createElement('div');
    this.layer.className = 'motion-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    board.append(this.layer);
  }

  cancel() {
    this.generation++;
    this.animations.forEach(animation => animation.cancel());
    this.animations = [];
    this.layer.replaceChildren();
    this.board.classList.remove('sliding');
    delete this.board.dataset.motion;
    this.cells.forEach(cell => { delete cell.dataset.feedback; });
  }

  private animate(element: HTMLElement, frames: Keyframe[], duration: number) {
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.22,.65,.3,1)', fill: 'both' });
    this.animations.push(animation);
    return animation.finished.catch(() => undefined);
  }

  async play(trace: MoveTrace, done: () => void) {
    this.cancel();
    if (this.preference.matches || document.hidden || typeof this.board.animate !== 'function') { done(); return; }
    const generation = this.generation;
    try {
      const base = this.board.getBoundingClientRect();
      const rects = this.cells.map(cell => cell.getBoundingClientRect());
      this.board.classList.add('sliding');
      this.board.dataset.motion = 'sliding';
      const slides = trace.travels.map(({ from, to, value }) => {
        const tile = document.createElement('div');
        tile.className = `motion-tile filled tile-${Math.min(value, 4096)}${value >= 1024 ? ' small-number' : ''}${value >= 16384 ? ' tiny-number' : ''}`;
        tile.textContent = String(value);
        tile.dataset.from = String(from); tile.dataset.to = String(to);
        const start = rects[from]; const end = rects[to];
        Object.assign(tile.style, { left: `${start.left - base.left}px`, top: `${start.top - base.top}px`, width: `${start.width}px`, height: `${start.height}px` });
        this.layer.append(tile);
        return this.animate(tile, [
          { transform: 'translate(0px, 0px)' },
          { transform: `translate(${end.left - start.left}px, ${end.top - start.top}px)` },
        ], 150);
      });
      await Promise.all(slides);
      if (generation !== this.generation) return;
      this.animations.forEach(animation => animation.cancel());
      this.animations = [];
      this.layer.replaceChildren();
      this.board.classList.remove('sliding');
      this.board.dataset.motion = 'feedback';
      const feedback = trace.merged.map(index => {
        const cell = this.cells[index]; cell.dataset.feedback = 'merge';
        return this.animate(cell, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.45 }, { transform: 'scale(1)' }], 160);
      });
      if (trace.spawned >= 0) {
        const cell = this.cells[trace.spawned]; cell.dataset.feedback = 'spawn';
        feedback.push(this.animate(cell, [{ transform: 'scale(.35)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 160));
      }
      await Promise.all(feedback);
    } catch {
      // Unsupported/interrupted animation APIs must never block a committed game result.
    } finally {
      if (generation === this.generation) { this.cancel(); done(); }
    }
  }
}
