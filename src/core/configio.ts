import type { Config } from '../types';
import { defaultConfig, soundSlot } from './defaults';
import { pairKey } from '../types';

function isObj(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }

// Deep merge: unknown/missing keys fall back to the defaults so older or partial files still load.
function merge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : over) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(over)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = isObj(b) ? merge(b, over[k]) : over[k];
  }
  return out as T;
}

export function normalizeConfig(raw: unknown): Config {
  const d = defaultConfig();
  if (!isObj(raw)) throw new Error('Not a configuration object');
  const c = merge<Config>({ ...d, categories: [], obstacles: [], assets: [], audio: { ...d.audio, pairs: {}, merges: {} } }, raw);
  if (!Array.isArray(c.categories)) c.categories = [];
  c.categories = c.categories.map((k) => merge(d.categories[0], k));
  c.obstacles = Array.isArray(c.obstacles) ? c.obstacles : [];
  c.assets = Array.isArray(c.assets) ? c.assets.filter((a) => a && typeof a.dataUrl === 'string') : [];
  ensurePairs(c);
  c.version = 1;
  return c;
}

// The sound slots adapt to the categories: every pair gets a slot, every evolving type gets a merge slot,
// stale ones are dropped. A mergeInto that points nowhere (type removed) is cleared.
export function ensurePairs(c: Config): void {
  const pairs: Config['audio']['pairs'] = {};
  const ids = c.categories.map((k) => k.id);
  for (let i = 0; i < ids.length; i++) for (let j = i; j < ids.length; j++) {
    const k = pairKey(ids[i], ids[j]);
    pairs[k] = c.audio.pairs[k] ? { ...soundSlot(), ...c.audio.pairs[k] } : soundSlot();
  }
  c.audio.pairs = pairs;
  const merges: Config['audio']['merges'] = {};
  const old = c.audio.merges ?? {};
  for (const k of c.categories) {
    if (k.mergeInto && (k.mergeInto === k.id || !ids.includes(k.mergeInto))) k.mergeInto = null;
    if (k.mergeInto) merges[k.id] = old[k.id] ? { ...soundSlot(), ...old[k.id] } : { ...soundSlot('builtin:chime', 0.9), intensityScaling: false };
  }
  c.audio.merges = merges;
}

export function serializeConfig(c: Config): string { return JSON.stringify(c, null, 2); }

export function parseConfig(text: string): Config { return normalizeConfig(JSON.parse(text)); }
