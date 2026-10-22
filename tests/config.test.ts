import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../src/core/defaults';
import { ensurePairs, parseConfig, serializeConfig } from '../src/core/configio';
import { Rng } from '../src/core/rng';
import { pairKey } from '../src/types';

describe('config', () => {
  it('round-trips through JSON', () => {
    const c = defaultConfig();
    const back = parseConfig(serializeConfig(c));
    expect(back).toEqual(c);
  });
  it('fills missing fields from defaults', () => {
    const c = parseConfig(JSON.stringify({ version: 1, seed: 7, categories: [{ id: 'x', name: 'X', color: '#fff' }] }));
    expect(c.seed).toBe(7);
    expect(c.categories[0].radius).toBeGreaterThan(0);
    expect(Object.keys(c.audio.pairs)).toEqual([pairKey('x', 'x')]);
  });
  it('adapts the sound matrix to the categories', () => {
    const c = defaultConfig();
    c.categories.push({ ...c.categories[0], id: 'd', name: 'D' });
    ensurePairs(c);
    expect(Object.keys(c.audio.pairs).length).toBe(10); // 4 types → 4*5/2 pairs
    expect(c.audio.pairs[pairKey('cat_red', 'cat_blue')].assetId).toBe('builtin:blip-mid');
  });
});

describe('rng', () => {
  it('is reproducible', () => {
    const a = new Rng(42), b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(new Rng(43).next()).not.toBe(new Rng(42).next());
  });
});
