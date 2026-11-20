export type Direction = 'left' | 'right' | 'up' | 'down';
export type Random = () => number;
export interface Snapshot {
  board: number[];
  score: number;
  won: boolean;
  continued: boolean;
}
export interface GameState extends Snapshot { previous: Snapshot | null }
export type Status = 'playing' | 'won' | 'over';

export function snapshot(state: Snapshot): Snapshot {
  return { board: [...state.board], score: state.score, won: state.won, continued: state.continued };
}

export interface TileTravel { from: number; to: number; value: number }

/** One shared resolver produces both values and their provenance; no UI merge rules. */
function resolveLine(line: readonly number[]) {
  const packed = line.flatMap((value, from) => value ? [{ value, from }] : []);
  const result: number[] = [];
  const travels: TileTravel[] = [];
  const merged: number[] = [];
  let points = 0;
  for (let i = 0; i < packed.length; i++) {
    const source = packed[i];
    const to = result.length;
    travels.push({ ...source, to });
    if (source.value === packed[i + 1]?.value) {
      travels.push({ ...packed[++i], to });
      result.push(source.value * 2); points += source.value * 2; merged.push(to);
    } else result.push(source.value);
  }
  return { line: result.concat(Array(line.length - result.length).fill(0)), points, travels, merged };
}

/** Resolve one line, without spawning. A merged tile cannot merge again this turn. */
export function mergeLine(line: readonly number[]): { line: number[]; points: number } {
  const { line: result, points } = resolveLine(line);
  return { line: result, points };
}

export function slide(board: readonly number[], direction: Direction) {
  const result = [...board];
  const travels: TileTravel[] = [];
  const merged: number[] = [];
  let points = 0;
  for (let n = 0; n < 4; n++) {
    const indexes = Array.from({ length: 4 }, (_, k) => {
      if (direction === 'left') return n * 4 + k;
      if (direction === 'right') return n * 4 + 3 - k;
      if (direction === 'up') return k * 4 + n;
      return (3 - k) * 4 + n;
    });
    const resolved = resolveLine(indexes.map(i => board[i]));
    points += resolved.points;
    indexes.forEach((index, k) => { result[index] = resolved.line[k]; });
    travels.push(...resolved.travels.map(travel => ({ ...travel, from: indexes[travel.from], to: indexes[travel.to] })));
    merged.push(...resolved.merged.map(index => indexes[index]));
  }
  return { board: result, points, travels, merged, changed: result.some((value, i) => value !== board[i]) };
}

function randomUnit(random: Random): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0;
}

export function spawn(board: readonly number[], random: Random = Math.random): number[] {
  const empty = board.flatMap((value, i) => value === 0 ? [i] : []);
  const result = [...board];
  if (empty.length) result[empty[Math.floor(randomUnit(random) * empty.length)]] = randomUnit(random) < 0.9 ? 2 : 4;
  return result;
}

export function createGame(random: Random = Math.random): GameState {
  return { board: spawn(spawn(Array(16).fill(0), random), random), score: 0, won: false, continued: false, previous: null };
}

export function canMove(board: readonly number[]): boolean {
  return board.some((value, index) => value === 0 ||
    (index % 4 < 3 && value === board[index + 1]) ||
    (index < 12 && value === board[index + 4]));
}

export function status(state: Snapshot): Status {
  if (state.won && !state.continued) return 'won';
  return canMove(state.board) ? 'playing' : 'over';
}

export function moveWithTrace(state: GameState, direction: Direction, random: Random = Math.random) {
  if (status(state) !== 'playing') return { state, trace: null };
  const next = slide(state.board, direction);
  if (!next.changed) return { state, trace: null };
  const board = spawn(next.board, random);
  return {
    state: {
      board, score: state.score + next.points,
      won: state.won || next.board.some(value => value >= 2048), continued: state.continued,
      previous: snapshot(state),
    } satisfies GameState,
    trace: { ...next, spawned: board.findIndex((value, i) => value !== next.board[i]) },
  };
}

export type MoveTrace = NonNullable<ReturnType<typeof moveWithTrace>['trace']>;

export function move(state: GameState, direction: Direction, random: Random = Math.random): GameState {
  return moveWithTrace(state, direction, random).state;
}

export function undo(state: GameState): GameState {
  return state.previous ? { ...snapshot(state.previous), previous: null } : state;
}

export function continueGame(state: GameState): GameState {
  return status(state) === 'won' ? { ...state, continued: true } : state;
}
