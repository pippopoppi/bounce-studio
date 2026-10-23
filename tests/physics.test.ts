import { describe, it, expect } from 'vitest';
import { defaultConfig, ARENA_PRESETS } from '../src/core/defaults';
import { PhysicsWorld, CENTER } from '../src/physics/world';
import type { Config } from '../src/types';

function run(cfg: Config, seconds: number) {
  const w = new PhysicsWorld(cfg);
  const dt = 1 / cfg.physics.timeStep;
  let events = 0;
  for (let i = 0; i < seconds * cfg.physics.timeStep; i++) events += w.step(dt).length;
  return { w, events };
}
const snapshot = (w: PhysicsWorld) => Array.from(w.balls.values()).map((b) => [Math.round(b.body.position.x * 1000), Math.round(b.body.position.y * 1000)]);

describe('physics world', () => {
  it('is deterministic for the same seed and differs for another seed', () => {
    const a = run(defaultConfig(), 5).w, b = run(defaultConfig(), 5).w;
    expect(snapshot(a)).toEqual(snapshot(b));
    const c = run({ ...defaultConfig(), seed: 999 }, 5).w;
    expect(snapshot(c)).not.toEqual(snapshot(a));
  });
  it('keeps every ball inside the circular arena at high speed', () => {
    const cfg = defaultConfig();
    cfg.categories.forEach((k) => { k.spawn.speed = 2500; k.restitution = 1; });
    const { w, events } = run(cfg, 20);
    expect(w.balls.size).toBe(12);
    for (const b of w.balls.values()) {
      const d = Math.hypot(b.body.position.x - CENTER.x, b.body.position.y - CENTER.y);
      expect(d).toBeLessThan(cfg.arena.radius - b.radius + 8);
    }
    expect(events).toBeGreaterThan(50);
  });
  it('keeps balls inside a rectangle and a polygon too', () => {
    for (const type of ['rect', 'polygon'] as const) {
      const cfg = defaultConfig(); cfg.arena.type = type;
      const { w } = run(cfg, 10);
      expect(w.balls.size).toBe(12);
      for (const b of w.balls.values()) {
        const dx = Math.abs(b.body.position.x - CENTER.x), dy = Math.abs(b.body.position.y - CENTER.y);
        if (type === 'rect') { expect(dx).toBeLessThan(cfg.arena.width / 2); expect(dy).toBeLessThan(cfg.arena.height / 2); }
        else expect(Math.hypot(dx, dy)).toBeLessThan(cfg.arena.radius);
      }
    }
  });
  it('lets balls escape through the opening and eliminates on hits', () => {
    const cfg = ARENA_PRESETS.find((p) => p.name === 'Escape ring')!.apply(defaultConfig());
    cfg.categories.forEach((k) => { k.count = 6; k.spawn.speed = 1500; });
    const { w } = run(cfg, 40);
    expect(w.balls.size).toBeLessThan(18);
    const cfg2 = defaultConfig();
    cfg2.categories[0].lives = 1; cfg2.categories[0].loseLifeOn = 'anyCharacter'; cfg2.categories[0].minImpact = 0;
    const { w: w2 } = run(cfg2, 10);
    expect(w2.counts()[cfg2.categories[0].id]).toBeLessThan(4);
    expect(w2.counts()[cfg2.categories[1].id]).toBe(4);
  });
  it('emits pair events with both categories and an impact speed', () => {
    const cfg = defaultConfig(); cfg.physics.gravityEnabled = false;
    const w = new PhysicsWorld(cfg);
    const dt = 1 / cfg.physics.timeStep; let pair: any = null;
    for (let i = 0; i < 1200 && !pair; i++) pair = w.step(dt).find((e) => e.type === 'pair');
    expect(pair).toBeTruthy();
    expect(pair.intensity).toBeGreaterThan(0);
    expect(cfg.categories.map((k) => k.id)).toContain(pair.a);
  });
  it('moves obstacles and rotates arenas without losing balls', () => {
    const cfg = ARENA_PRESETS.find((p) => p.name === 'Pinball circle')!.apply(defaultConfig());
    const { w, events } = run(cfg, 15);
    expect(w.balls.size).toBe(12);
    expect(events).toBeGreaterThan(100);
    const z = ARENA_PRESETS.find((p) => p.name === 'Zero-G chaos')!.apply(defaultConfig());
    const r = run(z, 15);
    expect(r.w.balls.size).toBe(12);
  });

  it('pipe mode: characters enter one at a time and stay inside the arena or the pipe', () => {
    const cfg = ARENA_PRESETS.find((p) => p.name === 'Pipe drop')!.apply(defaultConfig());
    const total = cfg.categories.reduce((n, k) => n + k.count, 0);
    const w = new PhysicsWorld(cfg), dt = 1 / cfg.physics.timeStep;
    expect(w.balls.size).toBe(0);
    expect(w.alive()).toBe(total);
    expect(Object.values(w.counts()).reduce((a, b) => a + b, 0)).toBe(total);
    let escapes = 0;
    const seen: number[] = [];
    for (let i = 0; i < 30 * cfg.physics.timeStep; i++) {
      for (const e of w.step(dt)) if (e.type === 'escape') escapes++;
      if (i % cfg.physics.timeStep === 0) seen.push(w.balls.size);
    }
    expect(escapes).toBe(0);
    expect(w.waiting()).toBe(0);
    expect(w.balls.size).toBe(total);
    expect(seen[1]).toBeGreaterThan(0);
    expect(seen[1]).toBeLessThan(total); // staggered, not all at once
    const g = w.pipe()!;
    for (const b of w.balls.values()) {
      const lx = b.body.position.x - CENTER.x, ly = b.body.position.y - CENTER.y;
      const inRing = Math.hypot(lx, ly) < cfg.arena.radius - b.radius + 8;
      const v = lx * g.d.x + ly * g.d.y, u = lx * g.u.x + ly * g.u.y;
      const inPipe = v > g.vMin - b.radius && v < g.vEnd && Math.abs(u) < g.halfWidth;
      expect(inRing || inPipe).toBe(true);
    }
  });
  it('pipe mode is deterministic and works on a rectangle too', () => {
    const cfg = ARENA_PRESETS.find((p) => p.name === 'Pipe drop')!.apply(defaultConfig());
    cfg.arena.type = 'rect';
    const a = run(cfg, 12).w, b = run(cfg, 12).w;
    expect(a.balls.size).toBe(15);
    expect(snapshot(a)).toEqual(snapshot(b));
    for (const ball of a.balls.values()) {
      const p = ball.body.position;
      expect(Math.abs(p.x - CENTER.x)).toBeLessThan(cfg.arena.width / 2);
      expect(p.y - CENTER.y).toBeLessThan(cfg.arena.height / 2);
      expect(p.y).toBeGreaterThan(-400);
    }
  });
});
