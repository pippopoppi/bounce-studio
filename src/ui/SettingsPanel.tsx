import { useRef, useState } from 'react';
import type { Config, Obstacle } from '../types';
import { ARENA_PRESETS, newObstacle } from '../core/defaults';
import { parseConfig, serializeConfig } from '../core/configio';
import { randomSeed } from '../core/rng';
import { uid } from '../core/id';
import { Check, Color, Num, Row, Sel, Section, Text, FileBtn } from './fields';

type Set = (path: (string | number)[], value: unknown) => void;
type Patch = (fn: (d: Config) => void) => void;

export function SettingsPanel({ cfg, set, patch, replace }: { cfg: Config; set: Set; patch: Patch; replace: (c: Config) => void }) {
  const [err, setErr] = useState('');
  const p = cfg.physics, a = cfg.arena, r = cfg.render;
  const saveJson = () => {
    const blob = new Blob([serializeConfig(cfg)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const el = document.createElement('a');
    el.href = url; el.download = (cfg.name || 'simulation').replace(/[^\w-]+/g, '_') + '.json'; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const loadJson = async (f: File) => {
    try { replace(parseConfig(await f.text())); setErr(''); } catch (e) { setErr('Could not load: ' + (e as Error).message); }
  };
  return (
    <div>
      <h2>Simulation</h2>
      <Section title="Run" open>
        <Text label="Name" value={cfg.name} onChange={(v) => set(['name'], v)} />
        <Row>
          <Num label="Seed" value={cfg.seed} onChange={(v) => set(['seed'], Math.floor(v))} min={0} />
          <div className="field"><span className="field-label">&nbsp;</span><button className="btn" onClick={() => set(['seed'], randomSeed())}>🎲 New seed</button></div>
        </Row>
        <Row>
          <Num label="Duration" unit="s" value={cfg.duration} onChange={(v) => set(['duration'], Math.max(1, v))} min={1} max={600} />
          <Num label="Playback speed" unit="×" value={cfg.speed} onChange={(v) => set(['speed'], Math.min(8, Math.max(0.05, v)))} min={0.05} max={8} step={0.05} />
        </Row>
        <Sel label="Stop automatically" value={cfg.autoStop} onChange={(v) => set(['autoStop'], v)} options={[
          { value: 'never', label: 'At the end of the duration' },
          { value: 'lastCharacter', label: 'When one character is left' },
          { value: 'lastCategory', label: 'When one category is left' }
        ]} />
        <div className="toolbar">
          <button className="btn" onClick={saveJson}>💾 Save JSON</button>
          <FileBtn label="📂 Load JSON" accept="application/json,.json" onFile={loadJson} />
        </div>
        {err ? <p className="hint" style={{ color: 'var(--danger)' }}>{err}</p> : null}
        <p className="hint">Same seed + same settings = same video. Change the seed for a new variation.</p>
      </Section>

      <Section title="Physics">
        <Check label="Gravity" checked={p.gravityEnabled} onChange={(v) => set(['physics', 'gravityEnabled'], v)} />
        <Row>
          <Num label="Gravity X" value={p.gravityX} onChange={(v) => set(['physics', 'gravityX'], v)} step={0.1} />
          <Num label="Gravity Y" value={p.gravityY} onChange={(v) => set(['physics', 'gravityY'], v)} step={0.1} />
        </Row>
        <Row>
          <Num label="Physics rate" unit="Hz" value={p.timeStep} onChange={(v) => set(['physics', 'timeStep'], Math.min(480, Math.max(30, Math.round(v))))} min={30} max={480} />
          <Num label="Substeps" value={p.substeps} onChange={(v) => set(['physics', 'substeps'], Math.min(8, Math.max(1, Math.round(v))))} min={1} max={8} />
        </Row>
        <Row>
          <Num label="Air damping" value={p.airDamping} onChange={(v) => set(['physics', 'airDamping'], Math.max(0, v))} min={0} max={0.5} step={0.001} />
          <Num label="Max speed" unit="px/s" value={p.maxSpeed} onChange={(v) => set(['physics', 'maxSpeed'], Math.max(0, v))} min={0} step={100} />
        </Row>
        <Row>
          <Num label="Velocity iterations" value={p.velocityIterations} onChange={(v) => set(['physics', 'velocityIterations'], Math.max(1, Math.round(v)))} min={1} max={30} />
          <Num label="Position iterations" value={p.positionIterations} onChange={(v) => set(['physics', 'positionIterations'], Math.max(1, Math.round(v)))} min={1} max={30} />
        </Row>
        <Check label="Random kick at start" checked={p.initialImpulse.enabled} onChange={(v) => set(['physics', 'initialImpulse', 'enabled'], v)} />
        {p.initialImpulse.enabled ? <Num label="Kick strength" unit="px/s" value={p.initialImpulse.strength} onChange={(v) => set(['physics', 'initialImpulse', 'strength'], v)} min={0} step={50} /> : null}
        <Check label="Periodic kick" checked={p.periodicImpulse.enabled} onChange={(v) => set(['physics', 'periodicImpulse', 'enabled'], v)} />
        {p.periodicImpulse.enabled ? <Row>
          <Num label="Every" unit="s" value={p.periodicImpulse.every} onChange={(v) => set(['physics', 'periodicImpulse', 'every'], Math.max(0.1, v))} min={0.1} step={0.5} />
          <Num label="Strength" unit="px/s" value={p.periodicImpulse.strength} onChange={(v) => set(['physics', 'periodicImpulse', 'strength'], v)} min={0} step={50} />
        </Row> : null}
        <p className="hint">Gravity 1 ≈ 1000 px/s². Higher physics rate and substeps = more stable fast collisions, more CPU.</p>
      </Section>

      <Section title="Arena">
        <div className="toolbar">
          {ARENA_PRESETS.map((pr) => <button key={pr.name} className="btn btn-sm" title={pr.description} onClick={() => replace(pr.apply(cfg))}>{pr.name}</button>)}
        </div>
        <Sel label="Shape" value={a.type} onChange={(v) => set(['arena', 'type'], v)} options={[
          { value: 'circle', label: 'Circle' }, { value: 'circleGap', label: 'Circle with opening' }, { value: 'rect', label: 'Rectangle' }, { value: 'polygon', label: 'Polygon' }
        ]} />
        {a.type === 'rect' ? <Row>
          <Num label="Width" unit="px" value={a.width} onChange={(v) => set(['arena', 'width'], Math.max(100, v))} min={100} max={1080} step={10} />
          <Num label="Height" unit="px" value={a.height} onChange={(v) => set(['arena', 'height'], Math.max(100, v))} min={100} max={1920} step={10} />
        </Row> : <Num label="Radius" unit="px" value={a.radius} onChange={(v) => set(['arena', 'radius'], Math.max(60, v))} min={60} max={540} step={10} />}
        {a.type === 'polygon' ? <Num label="Sides" value={a.sides} onChange={(v) => set(['arena', 'sides'], Math.max(3, Math.round(v)))} min={3} max={24} /> : null}
        {a.type === 'circleGap' ? <Row>
          <Num label="Opening angle" unit="°" value={a.gapAngle} onChange={(v) => set(['arena', 'gapAngle'], v)} step={5} />
          <Num label="Opening width" unit="°" value={a.gapWidth} onChange={(v) => set(['arena', 'gapWidth'], Math.max(1, v))} min={1} max={180} step={1} />
        </Row> : null}
        <Row>
          <Num label="Rotation" unit="°/s" value={a.rotationSpeed} onChange={(v) => set(['arena', 'rotationSpeed'], v)} step={5} />
          <Num label="Wall thickness" unit="px" value={a.wallThickness} onChange={(v) => set(['arena', 'wallThickness'], Math.max(10, v))} min={10} max={200} step={5} />
        </Row>
        <Row>
          <Num label="Wall bounciness" value={a.restitution} onChange={(v) => set(['arena', 'restitution'], Math.max(0, v))} min={0} max={1.5} step={0.05} />
          <Num label="Wall friction" value={a.friction} onChange={(v) => set(['arena', 'friction'], Math.max(0, v))} min={0} max={1} step={0.01} />
        </Row>
        <Color label="Wall colour" value={a.color} onChange={(v) => set(['arena', 'color'], v)} />
      </Section>

      <Section title="Obstacles" badge={cfg.obstacles.length ? String(cfg.obstacles.length) : undefined}>
        <div className="toolbar">
          <button className="btn btn-sm" onClick={() => patch((d) => d.obstacles.push(newObstacle('circle', uid('ob'))))}>+ Circle</button>
          <button className="btn btn-sm" onClick={() => patch((d) => d.obstacles.push(newObstacle('rect', uid('ob'))))}>+ Platform</button>
          <button className="btn btn-sm" onClick={() => patch((d) => d.obstacles.push(newObstacle('segment', uid('ob'))))}>+ Spinning bar</button>
        </div>
        {cfg.obstacles.map((o, i) => <ObstacleEditor key={o.id} o={o} i={i} set={set} remove={() => patch((d) => { d.obstacles.splice(i, 1); })} />)}
        {!cfg.obstacles.length ? <p className="hint">No obstacles. Positions are offsets from the arena centre.</p> : null}
      </Section>

      <Section title="Look">
        <Row>
          <Color label="Background" value={r.background} onChange={(v) => set(['render', 'background'], v)} />
          <Color label="Arena fill" value={r.arenaFill} onChange={(v) => set(['render', 'arenaFill'], v)} />
        </Row>
        <Row>
          <Num label="Outline width" unit="px" value={r.outlineWidth} onChange={(v) => set(['render', 'outlineWidth'], Math.max(0, v))} min={0} max={30} />
          <Text label="Outline colour" value={r.outlineColor} placeholder="category colour" onChange={(v) => set(['render', 'outlineColor'], v)} />
        </Row>
        <Check label="Motion trails" checked={r.trails.enabled} onChange={(v) => set(['render', 'trails', 'enabled'], v)} />
        {r.trails.enabled ? <Row>
          <Num label="Trail length" unit="frames" value={r.trails.length} onChange={(v) => set(['render', 'trails', 'length'], Math.max(2, Math.round(v)))} min={2} max={120} />
          <Num label="Trail width" unit="×" value={r.trails.width} onChange={(v) => set(['render', 'trails', 'width'], Math.max(0.05, v))} min={0.05} max={1} step={0.05} />
        </Row> : null}
        <Check label="Impact particles" checked={r.particles.enabled} onChange={(v) => set(['render', 'particles', 'enabled'], v)} />
        {r.particles.enabled ? <Num label="Particles per hit" value={r.particles.amount} onChange={(v) => set(['render', 'particles', 'amount'], Math.max(1, Math.round(v)))} min={1} max={40} /> : null}
        <Check label="Squash & stretch on impact" checked={r.squash.enabled} onChange={(v) => set(['render', 'squash', 'enabled'], v)} />
        {r.squash.enabled ? <Num label="Squash amount" value={r.squash.amount} onChange={(v) => set(['render', 'squash', 'amount'], Math.min(0.6, Math.max(0, v)))} min={0} max={0.6} step={0.02} /> : null}
        <Check label="Character labels" checked={r.labels} onChange={(v) => set(['render', 'labels'], v)} />
        <Check label="Live counter" checked={r.counter} onChange={(v) => set(['render', 'counter'], v)} />
        <Text label="Title text" value={r.title} placeholder="shown at the top" onChange={(v) => set(['render', 'title'], v)} />
      </Section>
    </div>
  );
}

function ObstacleEditor({ o, i, set, remove }: { o: Obstacle; i: number; set: Set; remove: () => void }) {
  const base = ['obstacles', i];
  const ref = useRef<HTMLDetailsElement>(null);
  const kindLabel = o.kind === 'circle' ? 'Circle' : o.kind === 'rect' ? 'Platform' : 'Bar';
  return (
    <details className="section" ref={ref}>
      <summary>{kindLabel} #{i + 1}<span className="badge">{o.motion.type !== 'none' ? o.motion.type : ''} {o.angularVelocity ? `${o.angularVelocity}°/s` : ''}</span></summary>
      <div className="section-body">
        <Row>
          <Num label="X" unit="px" value={o.x} onChange={(v) => set([...base, 'x'], v)} step={10} />
          <Num label="Y" unit="px" value={o.y} onChange={(v) => set([...base, 'y'], v)} step={10} />
        </Row>
        {o.kind === 'circle' ? <Num label="Radius" unit="px" value={o.r} onChange={(v) => set([...base, 'r'], Math.max(4, v))} min={4} step={5} /> : <Row>
          <Num label="Length" unit="px" value={o.w} onChange={(v) => set([...base, 'w'], Math.max(4, v))} min={4} step={10} />
          <Num label="Thickness" unit="px" value={o.h} onChange={(v) => set([...base, 'h'], Math.max(4, v))} min={4} step={2} />
        </Row>}
        <Row>
          <Num label="Angle" unit="°" value={o.angle} onChange={(v) => set([...base, 'angle'], v)} step={5} />
          <Num label="Spin" unit="°/s" value={o.angularVelocity} onChange={(v) => set([...base, 'angularVelocity'], v)} step={10} />
        </Row>
        <Sel label="Movement" value={o.motion.type} onChange={(v) => set([...base, 'motion', 'type'], v)} options={[
          { value: 'none', label: 'Static' }, { value: 'linear', label: 'Back and forth' }, { value: 'orbit', label: 'Orbit around X,Y' }
        ]} />
        {o.motion.type !== 'none' ? <div className="row-3">
          <Num label={o.motion.type === 'orbit' ? 'Orbit radius' : 'Amplitude X'} unit="px" value={o.motion.ax} onChange={(v) => set([...base, 'motion', 'ax'], v)} step={10} />
          <Num label={o.motion.type === 'orbit' ? 'Phase' : 'Amplitude Y'} unit={o.motion.type === 'orbit' ? '°' : 'px'} value={o.motion.ay} onChange={(v) => set([...base, 'motion', 'ay'], v)} step={10} />
          <Num label="Period" unit="s" value={o.motion.period} onChange={(v) => set([...base, 'motion', 'period'], Math.max(0.1, v))} min={0.1} step={0.5} />
        </div> : null}
        <Row>
          <Num label="Bounciness" value={o.restitution} onChange={(v) => set([...base, 'restitution'], Math.max(0, v))} min={0} max={2} step={0.05} />
          <Num label="Friction" value={o.friction} onChange={(v) => set([...base, 'friction'], Math.max(0, v))} min={0} max={1} step={0.01} />
        </Row>
        <Row>
          <Color label="Colour" value={o.color} onChange={(v) => set([...base, 'color'], v)} />
          <div className="field"><span className="field-label">&nbsp;</span><button className="btn btn-sm btn-danger" onClick={remove}>Remove</button></div>
        </Row>
      </div>
    </details>
  );
}
