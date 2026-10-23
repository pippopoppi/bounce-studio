import React from 'react';
import type { Asset, Category, Config, SoundSlot } from '../types';
import { pairKey } from '../types';
import { BUILTIN_MUSIC, BUILTIN_SOUNDS, newCategory } from '../core/defaults';
import { BUILTIN_LABELS } from '../audio/builtins';
import { uid } from '../core/id';
import { Check, Color, FileBtn, Num, Range, Row, Sel, Section, Text, readFileAsDataUrl } from './fields';

type Set = (path: (string | number)[], value: unknown) => void;
type Patch = (fn: (d: Config) => void) => void;
interface Props { cfg: Config; set: Set; patch: Patch; addAsset: (a: Asset) => void; removeAsset: (id: string) => void }

const PALETTE = ['#ff4d4d', '#4da6ff', '#ffd93d', '#6bcB77', '#c77dff', '#ff9f43', '#48dbfb', '#f368e0'];

export function CharactersPanel({ cfg, set, patch, addAsset, removeAsset }: Props) {
  const images = cfg.assets.filter((a) => a.kind === 'image');
  const sounds = cfg.assets.filter((a) => a.kind === 'audio');
  const upload = async (file: File, kind: Asset['kind']): Promise<Asset> => {
    const a: Asset = { id: uid(kind), kind, name: file.name, dataUrl: await readFileAsDataUrl(file) };
    addAsset(a); return a;
  };
  const addCategory = () => patch((d) => {
    const n = d.categories.length;
    d.categories.push(newCategory({ id: uid('cat'), name: 'Type ' + String.fromCharCode(65 + (n % 26)), color: PALETTE[n % PALETTE.length] }));
  });
  return (
    <div>
      <h2>Characters</h2>
      {cfg.categories.map((k, i) => (
        <CategoryEditor key={k.id} k={k} i={i} set={set} images={images} cfg={cfg}
          onUpload={async (f) => { const a = await upload(f, 'image'); set(['categories', i, 'imageAssetId'], a.id); }}
          remove={() => patch((d) => { d.categories.splice(i, 1); })} />
      ))}
      <div className="toolbar"><button className="btn btn-primary" onClick={addCategory}>+ Add character type</button></div>

      <h2>Music</h2>
      <Section title="Background music" open>
        <SoundPicker label="Track" value={cfg.audio.music.assetId} sounds={sounds} music onChange={(v) => set(['audio', 'music', 'assetId'], v)}
          onUpload={async (f) => { const a = await upload(f, 'audio'); set(['audio', 'music', 'assetId'], a.id); }} />
        <Range label="Music volume" value={cfg.audio.music.volume} onChange={(v) => set(['audio', 'music', 'volume'], v)} min={0} max={1} />
        <Check label="Loop" checked={cfg.audio.music.loop} onChange={(v) => set(['audio', 'music', 'loop'], v)} />
        <Row>
          <Range label="Master volume" value={cfg.audio.masterVolume} onChange={(v) => set(['audio', 'masterVolume'], v)} min={0} max={1} />
          <Num label="Max simultaneous sounds" value={cfg.audio.maxVoices} onChange={(v) => set(['audio', 'maxVoices'], Math.max(1, Math.round(v)))} min={1} max={64} />
        </Row>
        <p className="hint">Music follows the simulation timeline: pause, reset and playback speed apply to it too.</p>
      </Section>

      <h2>Collision sounds</h2>
      <Section title="Character vs character" open>
        <p className="hint">One sound per pair. The table grows with your character types.</p>
        <Matrix cfg={cfg} set={set} sounds={sounds} upload={(f) => upload(f, 'audio')} />
      </Section>
      <Section title="Events">
        {([['wall', 'Character hits a wall'], ['obstacle', 'Character hits an obstacle'], ['escape', 'Character escapes the arena'], ['eliminate', 'Character eliminated'], ['victory', 'Victory / simulation over']] as const).map(([key, label]) => (
          <SlotEditor key={key} title={label} slot={cfg.audio[key]} sounds={sounds} onChange={(path, v) => set(['audio', key, ...path], v)} upload={(f) => upload(f, 'audio')} />
        ))}
      </Section>

      <Section title="Uploaded files" badge={String(cfg.assets.filter((a) => !a.id.startsWith('img_')).length || '')}>
        <ul className="asset-list">
          {cfg.assets.map((a) => <li key={a.id}>{a.kind === 'image' ? <img className="thumb" style={{ width: 28, height: 28 }} src={a.dataUrl} alt="" /> : '🔊'}<span title={a.name}>{a.name}</span><small>{Math.round(a.dataUrl.length * 0.75 / 1024)} KB</small><button className="btn btn-sm btn-danger" onClick={() => removeAsset(a.id)}>✕</button></li>)}
        </ul>
        {!cfg.assets.length ? <p className="hint">Nothing uploaded yet.</p> : <p className="hint">Files are embedded in the saved JSON, so a preset is self-contained.</p>}
      </Section>
    </div>
  );
}

function CategoryEditor({ k, i, set, images, cfg, onUpload, remove }: { k: Category; i: number; set: Set; images: Asset[]; cfg: Config; onUpload: (f: File) => void; remove: () => void }) {
  const b = ['categories', i];
  const img = images.find((a) => a.id === k.imageAssetId);
  const s = k.spawn;
  return (
    <details className="section" open={i === 0}>
      <summary><span className="cat-swatch" style={{ background: k.color }} />{k.name || 'Unnamed'}<span className="badge">×{k.count}</span></summary>
      <div className="section-body">
        <Row>
          <Text label="Name" value={k.name} onChange={(v) => set([...b, 'name'], v)} />
          <Color label="Colour" value={k.color} onChange={(v) => set([...b, 'color'], v)} />
        </Row>
        <div className="thumb-row">
          {img ? <img className="thumb" src={img.dataUrl} alt="" /> : <div className="thumb" style={{ background: k.color }} />}
          <div>
            <FileBtn label="Upload image" accept="image/png,image/jpeg,image/webp,image/svg+xml" onFile={onUpload} />
            {images.length ? <select style={{ marginTop: 6, width: '100%' }} value={k.imageAssetId ?? ''} onChange={(e) => set([...b, 'imageAssetId'], e.target.value || null)}>
              <option value="">— plain colour —</option>
              {images.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select> : null}
          </div>
        </div>
        <p className="hint">PNG, JPG, WebP (transparent OK). The image is clipped to the circle; collisions stay circular.</p>
        <Row>
          <Num label="Count" value={k.count} onChange={(v) => set([...b, 'count'], Math.max(0, Math.round(v)))} min={0} max={200} />
          <Num label="Radius" unit="px" value={k.radius} onChange={(v) => set([...b, 'radius'], Math.max(6, v))} min={6} max={300} />
        </Row>
        <Row>
          <Num label="Mass" value={k.mass} onChange={(v) => set([...b, 'mass'], Math.max(0.01, v))} min={0.01} step={0.1} />
          <Num label="Bounciness" value={k.restitution} onChange={(v) => set([...b, 'restitution'], Math.max(0, v))} min={0} max={1.5} step={0.05} />
        </Row>
        <Row>
          <Num label="Friction" value={k.friction} onChange={(v) => set([...b, 'friction'], Math.max(0, v))} min={0} max={1} step={0.01} />
          <Num label="Air resistance" value={k.frictionAir} onChange={(v) => set([...b, 'frictionAir'], Math.max(0, v))} min={0} max={0.5} step={0.001} />
        </Row>
        <Sel label="Start position" value={s.mode} onChange={(v) => set([...b, 'spawn', 'mode'], v)} options={[
          { value: 'random', label: 'Random inside the arena' }, { value: 'ring', label: 'Evenly on a ring' }, { value: 'manual', label: 'Manual list' }, { value: 'pipe', label: 'From the pipe, one at a time' }
        ]} />
        {s.mode === 'manual' ? <ManualPositions k={k} b={b} set={set} /> : null}
        {s.mode === 'pipe' ? <>
          <Row>
            <Num label="Entry speed" unit="px/s" value={s.speed} onChange={(v) => set([...b, 'spawn', 'speed'], Math.max(0, v))} min={0} step={50} />
            <Num label="Speed variation" unit="0–1" value={s.speedJitter} onChange={(v) => set([...b, 'spawn', 'speedJitter'], Math.min(1, Math.max(0, v)))} min={0} max={1} step={0.1} />
          </Row>
          <p className="hint">Timing and order are set in Settings → Arena → Pipe.</p>
        </> : <Sel label="Start velocity" value={s.velocityMode} onChange={(v) => set([...b, 'spawn', 'velocityMode'], v)} options={[
          { value: 'random', label: 'Random direction' }, { value: 'fixed', label: 'Fixed direction' }, { value: 'zero', label: 'At rest' }
        ]} />}
        {s.mode !== 'pipe' && s.velocityMode !== 'zero' ? <Row>
          <Num label="Speed" unit="px/s" value={s.speed} onChange={(v) => set([...b, 'spawn', 'speed'], Math.max(0, v))} min={0} step={50} />
          {s.velocityMode === 'fixed' ? <Num label="Direction" unit="°" value={s.angle} onChange={(v) => set([...b, 'spawn', 'angle'], v)} step={15} />
            : <Num label="Speed variation" unit="0–1" value={s.speedJitter} onChange={(v) => set([...b, 'spawn', 'speedJitter'], Math.min(1, Math.max(0, v)))} min={0} max={1} step={0.1} />}
        </Row> : null}
        <Check label="Rotate the picture with the ball" checked={k.rotate} onChange={(v) => set([...b, 'rotate'], v)} />
        <Row>
          <Num label="Lives (0 = immortal)" value={k.lives} onChange={(v) => set([...b, 'lives'], Math.max(0, Math.round(v)))} min={0} max={99} />
          <Num label="Min. impact to count" unit="px/s" value={k.minImpact} onChange={(v) => set([...b, 'minImpact'], Math.max(0, v))} min={0} step={50} />
        </Row>
        {k.lives > 0 ? <Sel label="Loses a life when hit by" value={k.loseLifeOn} onChange={(v) => set([...b, 'loseLifeOn'], v)} options={[
          { value: 'otherCategory', label: 'Another character type' }, { value: 'anyCharacter', label: 'Any character' }, { value: 'wall', label: 'A wall' }, { value: 'obstacle', label: 'An obstacle' }, { value: 'never', label: 'Never' }
        ]} /> : null}
        <div className="toolbar"><button className="btn btn-sm btn-danger" onClick={remove} disabled={cfg.categories.length <= 1}>Remove type</button></div>
      </div>
    </details>
  );
}

function ManualPositions({ k, b, set }: { k: Category; b: (string | number)[]; set: Set }) {
  const list = k.spawn.positions;
  return (
    <div>
      {list.map((p, j) => <div className="row-3" key={j}>
        <Num label={`#${j + 1} X`} value={p.x} onChange={(v) => set([...b, 'spawn', 'positions', j, 'x'], v)} step={10} />
        <Num label="Y" value={p.y} onChange={(v) => set([...b, 'spawn', 'positions', j, 'y'], v)} step={10} />
        <div className="field"><span className="field-label">&nbsp;</span><button className="btn btn-sm" onClick={() => set([...b, 'spawn', 'positions'], list.filter((_, x) => x !== j))}>✕</button></div>
      </div>)}
      <button className="btn btn-sm" onClick={() => set([...b, 'spawn', 'positions'], [...list, { x: 0, y: 0 }])}>+ Position</button>
      <p className="hint">Offsets from the arena centre in pixels; extra characters reuse the list.</p>
    </div>
  );
}

function SoundPicker({ label, value, sounds, music, onChange, onUpload }: { label: string; value: string | null; sounds: Asset[]; music?: boolean; onChange: (v: string | null) => void; onUpload: (f: File) => void }) {
  const builtins = music ? [BUILTIN_MUSIC] : [...BUILTIN_SOUNDS];
  return (
    <div className="slot-head">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— none —</option>
        {sounds.length ? <optgroup label="Uploaded">{sounds.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup> : null}
        <optgroup label="Built-in">{builtins.map((id) => <option key={id} value={id}>{BUILTIN_LABELS[id] ?? id}</option>)}</optgroup>
      </select>
      <FileBtn label="⬆" className="btn-sm" accept="audio/mpeg,audio/wav,audio/ogg,audio/*,.mp3,.wav,.ogg" onFile={onUpload} />
    </div>
  );
}

function SlotEditor({ title, slot, sounds, onChange, upload }: { title: string; slot: SoundSlot; sounds: Asset[]; onChange: (path: string[], v: unknown) => void; upload: (f: File) => Promise<Asset> }) {
  return (
    <div className="slot">
      <SoundPicker label={title} value={slot.assetId} sounds={sounds} onChange={(v) => onChange(['assetId'], v)} onUpload={async (f) => { const a = await upload(f); onChange(['assetId'], a.id); }} />
      <SlotFields slot={slot} onChange={onChange} />
    </div>
  );
}

function SlotFields({ slot, onChange }: { slot: SoundSlot; onChange: (path: string[], v: unknown) => void }) {
  return (
    <>
      <div className="row-3">
        <Num label="Volume" value={slot.volume} onChange={(v) => onChange(['volume'], Math.min(2, Math.max(0, v)))} min={0} max={2} step={0.05} />
        <Num label="Pitch" unit="st" value={slot.pitch} onChange={(v) => onChange(['pitch'], v)} min={-24} max={24} step={1} />
        <Num label="Cooldown" unit="ms" value={slot.cooldown} onChange={(v) => onChange(['cooldown'], Math.max(0, v))} min={0} step={10} />
      </div>
      <Check label="Louder on harder impacts" checked={slot.intensityScaling} onChange={(v) => onChange(['intensityScaling'], v)} />
    </>
  );
}

function Matrix({ cfg, set, sounds, upload }: { cfg: Config; set: Set; sounds: Asset[]; upload: (f: File) => Promise<Asset> }) {
  const cats = cfg.categories;
  const [sel, setSel] = React.useState<string | null>(null);
  const key = sel && cfg.audio.pairs[sel] ? sel : null;
  return (
    <div>
      <table className="matrix">
        <thead><tr><th></th>{cats.map((c) => <th key={c.id}><span className="cat-swatch" style={{ background: c.color }} /> {c.name}</th>)}</tr></thead>
        <tbody>
          {cats.map((a, i) => <tr key={a.id}>
            <th><span className="cat-swatch" style={{ background: a.color }} /> {a.name}</th>
            {cats.map((b, j) => {
              if (j < i) return <td key={b.id} style={{ background: 'var(--panel2)' }} />;
              const k = pairKey(a.id, b.id); const slot = cfg.audio.pairs[k];
              return <td key={b.id} style={{ outline: key === k ? '2px solid var(--accent2)' : undefined }}>
                <select value={slot?.assetId ?? ''} onChange={(e) => set(['audio', 'pairs', k, 'assetId'], e.target.value || null)} onFocus={() => setSel(k)}>
                  <option value="">— none —</option>
                  {sounds.length ? <optgroup label="Uploaded">{sounds.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup> : null}
                  <optgroup label="Built-in">{BUILTIN_SOUNDS.map((id) => <option key={id} value={id}>{BUILTIN_LABELS[id]}</option>)}</optgroup>
                </select>
                <button className="btn btn-sm" style={{ marginTop: 3 }} onClick={() => setSel(key === k ? null : k)}>{key === k ? 'close' : 'edit'}</button>
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
      {key ? <div className="slot">
        <div className="slot-head"><span>{cats.find((c) => c.id === key.split('|')[0])?.name} vs {cats.find((c) => c.id === key.split('|')[1])?.name}</span>
          <FileBtn label="Upload sound for this pair" className="btn-sm" accept="audio/*,.mp3,.wav,.ogg" onFile={async (f) => { const a = await upload(f); set(['audio', 'pairs', key, 'assetId'], a.id); }} /></div>
        <SlotFields slot={cfg.audio.pairs[key]} onChange={(path, v) => set(['audio', 'pairs', key, ...path], v)} />
      </div> : <p className="hint">Pick a cell to upload a sound for that pair or tune volume, pitch and cooldown.</p>}
    </div>
  );
}
