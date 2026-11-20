import { describe, expect, it } from 'vitest';
import { createGame, move } from './engine';
import { loadSave, parseSave, saveGame, STORAGE_KEY, type StoragePort } from './storage';

const initial = () => createGame(() => 0);
const save = () => ({ version: 1, best: 128, current: initial() });
const memory = (raw: string | null): StoragePort => ({ getItem: () => raw, setItem: (_key, value) => { raw = value; } });

describe('versioned, defensive storage', () => {
  it('uses the isolated storage key', () => { expect(STORAGE_KEY).toBe('puzzle-2048-v1'); });
  it('round-trips board, score, best and one undo snapshot', () => {
    const storage = memory(null);
    const current = move(initial(), 'left', () => 0);
    expect(saveGame(current, 128, storage)).toBe(true);
    expect(loadSave(storage)).toEqual({ version: 1, best: 128, current });
  });
  it('keeps best independent of undo and normalizes best below score', () => {
    const current = { ...initial(), score: 256 };
    expect(parseSave({ version: 1, best: 4, current })?.best).toBe(256);
  });
  it.each([null, '', '{broken', 'null', '[]', '{}', '{"version":2}', '{"version":1,"best":"0"}'])('falls back for missing or corrupt JSON: %s', raw => {
    expect(loadSave(memory(raw))).toEqual({ version: 1, best: 0, current: null });
  });
  it('rejects unsupported versions and malformed top level fields', () => {
    for (const bad of [{ ...save(), version: 2 }, { ...save(), best: -4 }, { ...save(), best: NaN }, { ...save(), best: 1 }, { ...save(), best: '128' }]) expect(parseSave(bad)).toBeNull();
    expect(parseSave({ version: 1, best: 12, current: null })).toEqual({ version: 1, best: 12, current: null });
  });
  it('rejects wrong size, illegal tile values, invalid scores and flags', () => {
    const fields = [
      { board: [2] }, { board: Array(16).fill(0) }, { board: Array(16).fill(3) },
      { board: Array(16).fill(-2) }, { board: Array(16).fill('2') },
      { board: Array(16).fill(Infinity) }, { score: 1 }, { score: -4 }, { score: 2 ** 54 },
      { won: 'false' }, { continued: true }, { won: true },
      { board: [2048, ...Array(15).fill(0)] }, { previous: {} }, { previous: false },
    ];
    for (const field of fields) expect(parseSave({ ...save(), current: { ...initial(), ...field } })).toBeNull();
  });
  it('rejects corrupt previous snapshots and copies valid arrays', () => {
    const current = move(initial(), 'left', () => 0);
    const value = { version: 1, best: 128, current };
    const parsed = parseSave(value)!;
    current.board[0] = 512;
    expect(parsed.current?.board[0]).toBe(4);
    expect(parseSave({ ...value, current: { ...current, previous: { ...initial(), score: '4' } } })).toBeNull();
  });
  it('degrades safely when reads/writes are denied or quota is exceeded', () => {
    const unavailable = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
    expect(loadSave(unavailable)).toEqual({ version: 1, best: 0, current: null });
    expect(saveGame(initial(), 0, unavailable)).toBe(false);
    expect(loadSave()).toEqual({ version: 1, best: 0, current: null });
    expect(saveGame(initial(), 0)).toBe(false);
  });
});
