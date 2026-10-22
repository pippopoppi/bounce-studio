import { useCallback, useState } from 'react';
import type { Asset, Config } from '../types';
import { ensurePairs } from '../core/configio';

// Immutable path update: copies only the objects along the path, so large asset strings are never cloned.
export function setIn<T>(obj: T, path: (string | number)[], value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  const cur = obj as unknown as Record<string | number, unknown>;
  const child = cur[k];
  const next = setIn(child, rest, value);
  if (Array.isArray(obj)) { const arr = obj.slice(); arr[k as number] = next; return arr as unknown as T; }
  return { ...cur, [k]: next } as unknown as T;
}

export function useConfig(initial: Config) {
  const [cfg, setCfg] = useState<Config>(() => initial);
  const set = useCallback((path: (string | number)[], value: unknown) => setCfg((c) => setIn(c, path, value)), []);
  // Structural edits (add/remove categories or obstacles): mutate a shallow-cloned draft, assets untouched.
  const patch = useCallback((fn: (draft: Config) => void) => setCfg((c) => {
    const draft: Config = JSON.parse(JSON.stringify({ ...c, assets: [] }));
    draft.assets = c.assets;
    fn(draft);
    ensurePairs(draft);
    return draft;
  }), []);
  const addAsset = useCallback((a: Asset) => setCfg((c) => ({ ...c, assets: [...c.assets.filter((x) => x.id !== a.id), a] })), []);
  const removeAsset = useCallback((id: string) => setCfg((c) => {
    const d: Config = JSON.parse(JSON.stringify({ ...c, assets: [] }));
    d.assets = c.assets.filter((a) => a.id !== id);
    d.categories.forEach((k) => { if (k.imageAssetId === id) k.imageAssetId = null; });
    const clear = (s: { assetId: string | null }) => { if (s.assetId === id) s.assetId = null; };
    Object.values(d.audio.pairs).forEach(clear);
    [d.audio.wall, d.audio.obstacle, d.audio.escape, d.audio.eliminate, d.audio.victory, d.audio.music].forEach(clear);
    return d;
  }), []);
  const replace = useCallback((c: Config) => setCfg(c), []);
  return { cfg, set, patch, addAsset, removeAsset, replace };
}
