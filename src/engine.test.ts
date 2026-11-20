import { describe, expect, it } from 'vitest';
import { canMove, continueGame, createGame, mergeLine, move, moveWithTrace, slide, spawn, status, undo, type GameState } from './engine';

const game = (board: number[], score = 0): GameState => ({ board, score, won: false, continued: false, previous: null });
const row = (...values: number[]) => [...values, ...Array(16 - values.length).fill(0)];

describe('2048 rules', () => {
  it.each([
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 4, 0], [4, 4, 0, 0], 4],
    [[4, 0, 4, 4], [8, 4, 0, 0], 8],
    [[0, 2, 0, 2], [4, 0, 0, 0], 4],
    [[4, 8, 16, 32], [4, 8, 16, 32], 0],
  ])('merges once per tile: %j', (input, output, points) => {
    expect(mergeLine(input as number[])).toEqual({ line: output, points });
  });
  it('moves in all four directions without crossing rows', () => {
    const board = row(2, 0, 0, 2, 4);
    expect(slide(board, 'left').board).toEqual(row(4, 0, 0, 0, 4));
    expect(slide(board, 'right').board).toEqual(row(0, 0, 0, 4, 0, 0, 0, 4));
    expect(slide(board, 'up').board).toEqual(row(2, 0, 0, 2, 4));
    expect(slide(board, 'down').board).toEqual(row(0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 2));
    expect(slide(row(2, 0, 0, 0, 2), 'up').board).toEqual(row(4));
    expect(slide(row(2, 0, 0, 0, 2), 'down').board).toEqual(row(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4));
  });
  it('starts with two tiles and deterministic random injection', () => {
    expect(createGame(() => 0).board).toEqual(row(2, 2));
    expect(spawn(Array(16).fill(0), () => 0.99)[15]).toBe(4);
    expect(spawn(Array(16).fill(2), () => 0)).toEqual(Array(16).fill(2));
  });
  it('does not spawn, consume randomness or overwrite undo on invalid input', () => {
    const initial = game(row(2));
    expect(move(initial, 'left', () => { throw new Error('should not spawn'); })).toBe(initial);
    const moved = move(initial, 'right', () => 0);
    expect(move(moved, 'up')).toBe(moved);
    expect(moved.previous?.board).toEqual(initial.board);
  });
  it('spawns exactly one tile on valid move and scores merged values', () => {
    const next = move(game(row(2, 2, 2, 2), 20), 'left', () => 0);
    expect(next.board).toEqual(row(4, 4, 2));
    expect(next.score).toBe(28);
  });
  it('undo restores full state exactly once', () => {
    const initial = game(row(2, 2), 12);
    const next = move(initial, 'left', () => 0);
    expect(undo(next)).toEqual(initial);
    expect(undo(undo(next))).toEqual(initial);
  });
  it('announces 2048 once, allows continue and undo of the winning move', () => {
    const initial = game(row(1024, 1024));
    const won = move(initial, 'left', () => 0);
    expect(status(won)).toBe('won');
    expect(move(won, 'right')).toBe(won);
    expect(undo(won)).toEqual(initial);
    const continued = continueGame(won);
    expect(status(continued)).toBe('playing');
    expect(status(move(continued, 'right', () => 0))).toBe('playing');
  });
  it('detects adjacent options and full dead boards', () => {
    const dead = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(canMove(dead)).toBe(false);
    const over = game(dead);
    expect(status(over)).toBe('over');
    expect(move(over, 'left')).toBe(over);
    expect(canMove([...dead.slice(0, 15), 4])).toBe(true);
    expect(canMove(row(2))).toBe(true);
  });
  it('a valid final move can cause game over and can be undone', () => {
    const initial = game([2, 4, 2, 4, 4, 2, 4, 2, 32, 64, 32, 64, 8, 16, 8, 0]);
    const next = move(initial, 'right', () => 0);
    expect(status(next)).toBe('over');
    expect(undo(next)).toEqual(initial);
  });
  it.each([
    ['left', [0, 3], [0, 0]],
    ['right', [3, 0], [3, 3]],
    ['up', [0, 12], [0, 0]],
    ['down', [12, 0], [12, 12]],
  ] as const)('tracks both sources across empty space going %s', (direction, sources, targets) => {
    const board = Array(16).fill(0);
    sources.forEach(index => { board[index] = 2; });
    const result = slide(board, direction);
    expect(result.travels).toEqual(sources.map((from, i) => ({ from, to: targets[i], value: 2 })));
    expect(result.merged).toEqual([targets[0]]);
    expect(result.board[targets[0]]).toBe(4);
  });
  it('maps four equal sources into two independent merges, never a chained merge', () => {
    const result = slide(row(2, 2, 2, 2), 'left');
    expect(result.travels).toEqual([0, 1, 2, 3].map(from => ({ from, to: Math.floor(from / 2), value: 2 })));
    expect(result.merged).toEqual([0, 1]);
    expect(result.board).toEqual(row(4, 4));
    expect(slide(row(2, 2, 4), 'left').merged).toEqual([0]);
  });
  it('includes stationary tiles exactly once and never emits empty-cell sources', () => {
    const result = slide(row(2, 0, 4), 'left');
    expect(result.travels).toEqual([{ from: 0, to: 0, value: 2 }, { from: 2, to: 1, value: 4 }]);
    expect(result.merged).toEqual([]);
    expect(slide(row(2), 'left').travels).toEqual([{ from: 0, to: 0, value: 2 }]);
  });
  it('returns the same trace used to commit the state and identifies only the spawned cell', () => {
    const initial = game(row(2, 0, 2));
    const result = moveWithTrace(initial, 'left', () => 0);
    expect(result.trace?.board).toEqual(row(4));
    expect(result.trace?.spawned).toBe(1);
    expect(result.state.board).toEqual(row(4, 2));
    expect(result.state.previous?.board).toEqual(initial.board);
    expect(moveWithTrace(game(row(2)), 'left').trace).toBeNull();
  });
  it('trace provenance reconstructs every slide across all directions', () => {
    const board = [0, 2, 0, 2, 4, 4, 4, 4, 8, 0, 16, 8, 0, 2, 2, 4];
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      const result = slide(board, direction);
      const reconstructed = Array(16).fill(0);
      result.travels.forEach(({ from, to, value }) => { expect(board[from]).toBe(value); reconstructed[to] += value; });
      expect(reconstructed).toEqual(result.board);
      expect(new Set(result.travels.map(t => t.from)).size).toBe(board.filter(Boolean).length);
      for (const to of result.merged) expect(result.travels.filter(t => t.to === to)).toHaveLength(2);
    }
  });
  it('preserves tile mass before spawning across seeded random boards', () => {
    let seed = 12345;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 150; i++) {
      const board = Array.from({ length: 16 }, () => rng() < 0.3 ? 0 : 2 ** (1 + Math.floor(rng() * 6)));
      for (const direction of ['left', 'right', 'up', 'down'] as const) {
        const result = slide(board, direction);
        expect(result.board.reduce((a, b) => a + b)).toBe(board.reduce((a, b) => a + b));
        expect(result.board).toHaveLength(16);
      }
    }
  });
});
