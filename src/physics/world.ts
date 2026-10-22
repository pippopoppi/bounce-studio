// Matter.js world built from a Config. Fixed-step, seeded, emits SimEvents. No rendering here.
import Matter from 'matter-js';
import type { ArenaConfig, Category, Config, Obstacle, SimEvent, Vec } from '../types';
import { CANVAS_W, CANVAS_H } from '../types';
import { Rng } from '../core/rng';

const { Engine, Bodies, Body, Composite, Events, Common } = Matter;
// Matter's velocity unit is px per 16.67 ms (one 60 Hz tick): px/s ÷ 60.
const DEG = Math.PI / 180;
// Matter 0.20 accepts an `updateVelocity` flag (so moving static bodies push balls); the typings lag behind.
const setPos = Body.setPosition as unknown as (b: Matter.Body, p: Vec, updateVelocity?: boolean) => void;
const setAng = Body.setAngle as unknown as (b: Matter.Body, a: number, updateVelocity?: boolean) => void;
const rotateAbout = Body.rotate as unknown as (b: Matter.Body, r: number, p?: Vec, updateVelocity?: boolean) => void;

export const CENTER: Vec = { x: CANVAS_W / 2, y: CANVAS_H / 2 };

export interface Ball { id: number; cat: string; lives: number; body: Matter.Body; radius: number; spawnIndex: number }
interface ObstacleRt { cfg: Obstacle; body: Matter.Body }

// Pre-impact relative speed along the contact normal, px/s.
function impactSpeed(pair: Matter.Pair): number {
  const n = pair.collision.normal;
  const va = pair.bodyA.velocity, vb = pair.bodyB.velocity;
  return Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y) * 60;
}

export class PhysicsWorld {
  readonly engine: Matter.Engine;
  readonly balls = new Map<number, Ball>();
  readonly cfg: Config;
  time = 0;
  private walls: Matter.Body | null = null;
  private wallAngle = 0;
  private obstacles: ObstacleRt[] = [];
  private pending: Matter.Pair[] = [];
  private rng: Rng;
  private ballId = 1;

  constructor(cfg: Config) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    (Common as unknown as { _seed: number })._seed = cfg.seed;
    const p = cfg.physics;
    this.engine = Engine.create({
      gravity: { x: p.gravityEnabled ? p.gravityX : 0, y: p.gravityEnabled ? p.gravityY : 0, scale: 0.001 },
      positionIterations: p.positionIterations,
      velocityIterations: p.velocityIterations,
      enableSleeping: false
    });
    this.buildArena(cfg.arena);
    this.buildObstacles(cfg.obstacles);
    this.spawnAll(cfg.categories);
    if (p.initialImpulse.enabled) this.kick(p.initialImpulse.strength);
    Events.on(this.engine, 'collisionStart', (e) => { for (const pair of e.pairs) this.pending.push(pair); });
  }

  // ---- building -----------------------------------------------------------
  private buildArena(a: ArenaConfig): void {
    const parts: Matter.Body[] = [];
    const opts = { isStatic: true, restitution: a.restitution, friction: a.friction, frictionStatic: 0, label: 'wall' };
    const t = a.wallThickness;
    if (a.type === 'rect') {
      const hw = a.width / 2, hh = a.height / 2;
      parts.push(Bodies.rectangle(CENTER.x, CENTER.y - hh - t / 2, a.width + 2 * t, t, opts));
      parts.push(Bodies.rectangle(CENTER.x, CENTER.y + hh + t / 2, a.width + 2 * t, t, opts));
      parts.push(Bodies.rectangle(CENTER.x - hw - t / 2, CENTER.y, t, a.height + 2 * t, opts));
      parts.push(Bodies.rectangle(CENTER.x + hw + t / 2, CENTER.y, t, a.height + 2 * t, opts));
    } else {
      const n = a.type === 'polygon' ? Math.max(3, Math.round(a.sides)) : Math.max(24, Math.round(a.radius / 10));
      const R = a.radius;
      const step = (2 * Math.PI) / n;
      const len = 2 * R * Math.sin(step / 2) + (a.type === 'polygon' ? 0 : 6);
      const apothem = R * Math.cos(step / 2);
      for (let i = 0; i < n; i++) {
        const mid = (i + 0.5) * step; // angle of the segment centre
        if (a.type === 'circleGap') {
          let d = ((mid / DEG - a.gapAngle) % 360 + 540) % 360 - 180;
          if (Math.abs(d) < a.gapWidth / 2) continue;
        }
        const cx = CENTER.x + Math.cos(mid) * (apothem + t / 2), cy = CENTER.y + Math.sin(mid) * (apothem + t / 2);
        const seg = Bodies.rectangle(cx, cy, len, t, { ...opts, angle: mid + Math.PI / 2 });
        parts.push(seg);
      }
    }
    this.walls = Body.create({ parts, ...opts });
    Composite.add(this.engine.world, this.walls);
  }

  private buildObstacles(list: Obstacle[]): void {
    for (const o of list) {
      const opts = { isStatic: true, restitution: o.restitution, friction: o.friction, frictionStatic: 0, label: 'obstacle', angle: o.angle * DEG };
      const x = CENTER.x + o.x, y = CENTER.y + o.y;
      const body = o.kind === 'circle' ? Bodies.circle(x, y, Math.max(4, o.r), opts) : Bodies.rectangle(x, y, Math.max(4, o.w), Math.max(4, o.h), opts);
      this.obstacles.push({ cfg: o, body });
      Composite.add(this.engine.world, body);
    }
    this.placeObstacles(0);
  }

  private obstaclePose(o: Obstacle, t: number): { x: number; y: number; angle: number } {
    let x = CENTER.x + o.x, y = CENTER.y + o.y;
    const m = o.motion, period = Math.max(0.05, m.period);
    if (m.type === 'linear') { const s = Math.sin((2 * Math.PI * t) / period); x += m.ax * s; y += m.ay * s; }
    else if (m.type === 'orbit') { const ph = (2 * Math.PI * t) / period + m.ay * DEG; x += m.ax * Math.cos(ph); y += m.ax * Math.sin(ph); }
    return { x, y, angle: (o.angle + o.angularVelocity * t) * DEG };
  }

  private placeObstacles(t: number): void {
    for (const ob of this.obstacles) {
      const pose = this.obstaclePose(ob.cfg, t);
      setPos(ob.body, { x: pose.x, y: pose.y }, true);
      setAng(ob.body, pose.angle, true);
    }
  }

  // Largest radius a ball centre may have from the centre and still be inside the arena.
  private innerRadius(): number {
    const a = this.cfg.arena;
    if (a.type === 'rect') return Math.min(a.width, a.height) / 2;
    if (a.type === 'polygon') return a.radius * Math.cos(Math.PI / Math.max(3, a.sides));
    return a.radius;
  }

  private randomInside(r: number): Vec {
    const a = this.cfg.arena;
    for (let i = 0; i < 200; i++) {
      let p: Vec;
      if (a.type === 'rect') p = { x: this.rng.range(-a.width / 2 + r, a.width / 2 - r), y: this.rng.range(-a.height / 2 + r, a.height / 2 - r) };
      else { const R = this.innerRadius() - r - 2; const ang = this.rng.range(0, Math.PI * 2), d = Math.sqrt(this.rng.next()) * R; p = { x: Math.cos(ang) * d, y: Math.sin(ang) * d }; }
      if (!this.overlaps(p, r)) return p;
    }
    return { x: 0, y: 0 };
  }

  private overlaps(p: Vec, r: number): boolean {
    for (const b of this.balls.values()) {
      const dx = b.body.position.x - CENTER.x - p.x, dy = b.body.position.y - CENTER.y - p.y;
      if (dx * dx + dy * dy < (r + b.radius + 6) ** 2) return true;
    }
    for (const o of this.obstacles) {
      const dx = o.body.position.x - CENTER.x - p.x, dy = o.body.position.y - CENTER.y - p.y;
      const reach = o.cfg.kind === 'circle' ? o.cfg.r : Math.hypot(o.cfg.w, o.cfg.h) / 2;
      if (dx * dx + dy * dy < (r + reach + 6) ** 2) return true;
    }
    return false;
  }

  private spawnAll(cats: Category[]): void {
    const ringTotal = cats.reduce((n, c) => n + (c.spawn.mode === 'ring' ? Math.max(0, c.count) : 0), 0);
    let ringIndex = 0;
    for (const cat of cats) {
      const r = Math.max(4, cat.radius);
      for (let i = 0; i < Math.max(0, Math.floor(cat.count)); i++) {
        let p: Vec;
        const s = cat.spawn;
        if (s.mode === 'manual' && s.positions.length) p = s.positions[i % s.positions.length];
        else if (s.mode === 'ring') { const R = Math.max(0, this.innerRadius() - r - 10) * 0.65; const ang = (ringIndex++ / Math.max(1, ringTotal)) * Math.PI * 2 - Math.PI / 2; p = { x: Math.cos(ang) * R, y: Math.sin(ang) * R }; }
        else p = this.randomInside(r);
        const body = Bodies.circle(CENTER.x + p.x, CENTER.y + p.y, r, {
          restitution: cat.restitution, friction: cat.friction, frictionStatic: 0,
          frictionAir: Math.max(0, cat.frictionAir + this.cfg.physics.airDamping), label: 'ball'
        });
        Body.setMass(body, Math.max(0.01, cat.mass));
        let vx = 0, vy = 0;
        if (s.velocityMode === 'random') { const ang = this.rng.range(0, Math.PI * 2), sp = s.speed * (1 + this.rng.range(-s.speedJitter, s.speedJitter)); vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp; }
        else if (s.velocityMode === 'fixed') { vx = Math.cos(s.angle * DEG) * s.speed; vy = Math.sin(s.angle * DEG) * s.speed; }
        Body.setVelocity(body, { x: vx / 60, y: vy / 60 });
        const id = this.ballId++;
        this.balls.set(id, { id, cat: cat.id, lives: cat.lives, body, radius: r, spawnIndex: i });
        (body as unknown as { ballId: number }).ballId = id;
        Composite.add(this.engine.world, body);
      }
    }
  }

  // ---- running ------------------------------------------------------------
  kick(strength: number): void {
    for (const b of this.balls.values()) {
      const ang = this.rng.range(0, Math.PI * 2);
      const v = b.body.velocity;
      Body.setVelocity(b.body, { x: v.x + (Math.cos(ang) * strength) / 60, y: v.y + (Math.sin(ang) * strength) / 60 });
    }
  }

  // One fixed step of dt seconds. Returns the events of this step.
  step(dt: number): SimEvent[] {
    const events: SimEvent[] = [];
    const sub = Math.max(1, Math.round(this.cfg.physics.substeps));
    const ms = (dt * 1000) / sub;
    for (let s = 0; s < sub; s++) {
      const t = this.time + (dt * (s + 1)) / sub;
      this.moveStatics(t, dt / sub);
      this.clampSpeeds();
      Engine.update(this.engine, ms);
      this.collectCollisions(events);
    }
    this.time += dt;
    this.checkEscapes(events);
    return events;
  }

  private moveStatics(t: number, dt: number): void {
    const a = this.cfg.arena;
    if (this.walls && a.rotationSpeed) {
      const target = a.rotationSpeed * DEG * t;
      rotateAbout(this.walls, target - this.wallAngle, CENTER, true);
      this.wallAngle = target;
    }
    if (this.obstacles.length) this.placeObstacles(t);
    void dt;
  }

  private clampSpeeds(): void {
    const max = this.cfg.physics.maxSpeed;
    if (!max) return;
    const m = max / 60;
    for (const b of this.balls.values()) {
      const v = b.body.velocity, sp = Math.hypot(v.x, v.y);
      if (sp > m) Body.setVelocity(b.body, { x: (v.x / sp) * m, y: (v.y / sp) * m });
    }
  }

  private ballOf(body: Matter.Body): Ball | undefined {
    const id = (body as unknown as { ballId?: number }).ballId;
    return id === undefined ? undefined : this.balls.get(id);
  }

  private collectCollisions(events: SimEvent[]): void {
    const pairs = this.pending; this.pending = [];
    const dead = new Set<number>();
    for (const pair of pairs) {
      const A = pair.bodyA.parent ?? pair.bodyA, B = pair.bodyB.parent ?? pair.bodyB;
      const ba = this.ballOf(A), bb = this.ballOf(B);
      if (!ba && !bb) continue;
      const intensity = impactSpeed(pair);
      const sup = pair.collision.supports[0] ?? { x: (A.position.x + B.position.x) / 2, y: (A.position.y + B.position.y) / 2 };
      const n = pair.collision.normal;
      if (ba && bb) {
        events.push({ type: 'pair', a: ba.cat, b: bb.cat, intensity, x: sup.x, y: sup.y, nx: n.x, ny: n.y, bodies: [ba.id, bb.id] });
        this.hit(ba, bb.cat === ba.cat ? 'anyCharacter' : 'otherCategory', intensity, dead);
        this.hit(bb, bb.cat === ba.cat ? 'anyCharacter' : 'otherCategory', intensity, dead);
      } else {
        const ball = (ba ?? bb) as Ball, other = ba ? B : A;
        const kind = other.label === 'obstacle' ? 'obstacle' : 'wall';
        events.push({ type: kind, cat: ball.cat, intensity, x: sup.x, y: sup.y, nx: n.x, ny: n.y, body: ball.id });
        this.hit(ball, kind, intensity, dead);
      }
    }
    for (const id of dead) {
      const b = this.balls.get(id); if (!b) continue;
      events.push({ type: 'eliminate', cat: b.cat, x: b.body.position.x, y: b.body.position.y, body: id });
      this.remove(id);
    }
  }

  private hit(b: Ball, kind: 'anyCharacter' | 'otherCategory' | 'wall' | 'obstacle', intensity: number, dead: Set<number>): void {
    const cat = this.cfg.categories.find((c) => c.id === b.cat);
    if (!cat || cat.lives <= 0 || b.lives <= 0) return;
    const rule = cat.loseLifeOn;
    const applies = rule === 'anyCharacter' ? (kind === 'anyCharacter' || kind === 'otherCategory') : rule === kind;
    if (!applies || intensity < cat.minImpact) return;
    b.lives -= 1;
    if (b.lives <= 0) dead.add(b.id);
  }

  private checkEscapes(events: SimEvent[]): void {
    const a = this.cfg.arena;
    for (const b of Array.from(this.balls.values())) {
      const p = b.body.position;
      const d = Math.hypot(p.x - CENTER.x, p.y - CENTER.y);
      const out = a.type === 'circleGap' ? d > a.radius + b.radius * 1.5
        : p.x < -300 || p.x > CANVAS_W + 300 || p.y < -300 || p.y > CANVAS_H + 300;
      if (out) { events.push({ type: 'escape', cat: b.cat, x: p.x, y: p.y, body: b.id }); this.remove(b.id); }
    }
  }

  private remove(id: number): void {
    const b = this.balls.get(id); if (!b) return;
    Composite.remove(this.engine.world, b.body);
    this.balls.delete(id);
  }

  counts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of this.cfg.categories) out[c.id] = 0;
    for (const b of this.balls.values()) out[b.cat] = (out[b.cat] ?? 0) + 1;
    return out;
  }

  // Geometry for the renderer (static shapes are drawn from the bodies so visuals match physics exactly).
  wallParts(): Matter.Body[] { return this.walls ? this.walls.parts.slice(1) : []; }
  obstacleBodies(): { cfg: Obstacle; body: Matter.Body }[] { return this.obstacles; }
}
