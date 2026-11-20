import { describe, expect, it } from 'vitest';
import { CHARACTERS, CHARACTER_STORAGE_KEY, characterById, loadCharacter, portraitUrl, saveCharacter } from './characters';

const storage = (raw: string | null) => ({ getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } });

describe('independent companion preferences', () => {
  it('contains nineteen unique local identities with explicit names', () => {
    expect(CHARACTERS).toHaveLength(19);
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(19);
    expect(CHARACTERS.every(c => c.name && c.short)).toBe(true);
  });
  it('uses an independent versioned key and relative portrait URLs', () => {
    expect(CHARACTER_STORAGE_KEY).toBe('puzzle-2048-character-v1');
    for (const c of CHARACTERS) expect(portraitUrl(c.id)).toBe(`./characters-2d/${c.id}.webp`);
    expect(portraitUrl('../bad')).toBe('./characters-2d/classic.webp');
  });
  it('round-trips every supported choice', () => {
    const port = storage(null);
    for (const c of CHARACTERS) {
      expect(saveCharacter(c.id, port)).toBe(true);
      expect(loadCharacter(port)).toEqual(c);
    }
  });
  it.each([null, '', '{broken', 'null', '[]', '{}', '"usagi"', '{"version":2,"id":"usagi"}', '{"version":1,"id":"unknown"}', '{"version":1,"id":3}'])('defaults safely for malformed or unsupported preference: %s', raw => {
    expect(loadCharacter(storage(raw))).toEqual(CHARACTERS[0]);
  });
  it('normalizes invalid identifiers before writing', () => {
    const port = storage(null);
    expect(characterById({ id: 'usagi' })).toBe(CHARACTERS[0]);
    expect(saveCharacter('invalid', port)).toBe(true);
    expect(loadCharacter(port)).toBe(CHARACTERS[0]);
  });
  it('handles denied reads and write quota failures independently', () => {
    const port = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
    expect(loadCharacter(port)).toBe(CHARACTERS[0]);
    expect(saveCharacter('usagi', port)).toBe(false);
    expect(loadCharacter()).toBe(CHARACTERS[0]);
    expect(saveCharacter('usagi')).toBe(false);
  });
});
