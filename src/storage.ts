import { snapshot, type GameState, type Snapshot } from './engine';

export const STORAGE_KEY = 'puzzle-2048-v1';
export interface SaveData { version: 1; best: number; current: GameState | null }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const score = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) % 4 === 0;
const tile = (value: unknown): value is number => typeof value === 'number' && (value === 0 || (Number.isSafeInteger(value) && value >= 2 && Number.isInteger(Math.log2(value))));

function parseSnapshot(value: unknown): Snapshot | null {
  if (!record(value) || !Array.isArray(value.board) || value.board.length !== 16 || !value.board.every(tile) ||
    !value.board.some(Boolean) || !score(value.score) || typeof value.won !== 'boolean' || typeof value.continued !== 'boolean') return null;
  const has2048 = value.board.some((n: number) => n >= 2048);
  if (has2048 !== value.won || (value.continued && !value.won)) return null;
  return { board: [...value.board], score: value.score, won: value.won, continued: value.continued };
}

export function parseSave(value: unknown): SaveData | null {
  if (!record(value) || value.version !== 1 || !score(value.best)) return null;
  if (value.current === null) return { version: 1, best: value.best, current: null };
  const current = parseSnapshot(value.current);
  if (!current || !record(value.current)) return null;
  const previous = value.current.previous === null ? null : parseSnapshot(value.current.previous);
  if (value.current.previous !== null && !previous) return null;
  return { version: 1, best: Math.max(value.best, current.score), current: { ...current, previous } };
}

export function loadSave(storage?: StoragePort): SaveData {
  try {
    const source = storage ?? window.localStorage;
    const raw = source.getItem(STORAGE_KEY);
    return (raw ? parseSave(JSON.parse(raw)) : null) ?? { version: 1, best: 0, current: null };
  } catch { return { version: 1, best: 0, current: null }; }
}

export function saveGame(state: GameState, best: number, storage?: StoragePort): boolean {
  try {
    const target = storage ?? window.localStorage;
    target.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, best: Math.max(best, state.score),
      current: { ...snapshot(state), previous: state.previous ? snapshot(state.previous) : null },
    }));
    return true;
  } catch { return false; }
}
