import { useEffect, useMemo, useRef, useState } from 'react';
import type { Config } from './types';
import { defaultConfig } from './core/defaults';
import { normalizeConfig } from './core/configio';
import { useConfig } from './ui/useConfig';
import { Simulation, type SimStatus } from './sim/simulation';
import { AudioEngine } from './audio/engine';
import { SettingsPanel } from './ui/SettingsPanel';
import { CharactersPanel } from './ui/CharactersPanel';
import { Preview } from './ui/Preview';

// Anything in this slice changes the physics outcome → rebuild the world when it changes.
function worldKey(c: Config): string {
  return JSON.stringify({ seed: c.seed, physics: c.physics, arena: c.arena, obstacles: c.obstacles,
    categories: c.categories.map(({ name: _n, color: _c, imageAssetId: _i, rotate: _r, ...rest }) => rest) });
}

export function App() {
  const { cfg, set, patch, addAsset, removeAsset, replace } = useConfig(defaultConfig());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audio = useMemo(() => new AudioEngine(cfg.audio, cfg.assets), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [sim, setSim] = useState<Simulation | null>(null);
  const [status, setStatus] = useState<SimStatus>({ state: 'idle', time: 0, counts: {}, winner: null, alive: 0 });
  const [tab, setTab] = useState<'settings' | 'preview' | 'characters'>('preview');
  const lastKey = useRef('');
  const cfgRef = useRef(cfg); cfgRef.current = cfg;

  useEffect(() => {
    if (!canvasRef.current) return;
    const s = new Simulation(canvasRef.current, audio, cfg);
    s.onStatus = setStatus;
    setStatus(s.status);
    lastKey.current = worldKey(cfg);
    setSim(s);
    // Console/automation hooks: BounceStudio.sim, .audio, .getConfig(), .setConfig(cfg)
    (window as unknown as { BounceStudio: unknown }).BounceStudio = { sim: s, audio, getConfig: () => cfgRef.current, setConfig: (c: Config) => replace(normalizeConfig(c)) };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sim) return;
    const k = worldKey(cfg);
    if (k !== lastKey.current) { lastKey.current = k; const t = setTimeout(() => sim.load(cfg), 120); return () => clearTimeout(t); }
    sim.applyLive(cfg);
  }, [cfg, sim]);

  return (
    <div className="app">
      <header className="topbar">
        <h1><span>●</span> Bounce Studio</h1>
        <small>physics bouncing-ball video maker · 1080×1920</small>
        <span className="spacer" />
        <nav className="tabs">
          {(['settings', 'preview', 'characters'] as const).map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
        </nav>
        <a href="https://pippopoppi.github.io/" title="Pippo Poppi Games"><small>Pippo Poppi Games</small></a>
      </header>
      <div className="layout" data-tab={tab}>
        <aside className="panel left"><SettingsPanel cfg={cfg} set={set} patch={patch} replace={replace} /></aside>
        <Preview cfg={cfg} sim={sim} status={status} audio={audio} canvasRef={canvasRef} set={set} />
        <aside className="panel right"><CharactersPanel cfg={cfg} set={set} patch={patch} addAsset={addAsset} removeAsset={removeAsset} /></aside>
      </div>
    </div>
  );
}
