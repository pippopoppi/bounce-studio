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
// Wall piece in arena-local coordinates (relative to CENTER): inner edge p0→p1, thickened along the outward normal n.
interface Seg { p0: Vec; p1: Vec; n: Vec }
// Pipe frame: d points from the centre along the pipe, u is perpendicular. v/u are coordinates in that frame.
export interface PipeGeometry { d: Vec; u: Vec; halfWidth: number; vLeft: number; vRight: number; vMin: number; vEnd: number; closed: boolean }
interface Queued { cat: Category; index: number; at: number }
type WallOpts = Matter.IChamferableBodyDefinition;

function dot(a: Vec, b: Vec): number { return a.x * b.x + a.y * b.y; }
function shuffle<T>(list: T[], rnd: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

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
  private pipeBody: Matter.Body | null = null;
  private pipeGeo: PipeGeometry | null = null;
  private queue: Queued[] = [];
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
    this.buildArena(cfg.arena, cfg.arena.pipe.enabled || cfg.categories.some((k) => k.spawn.mode === 'pipe' && k.count > 0));
    this.buildObstacles(cfg.obstacles);
    this.spawnAll(cfg.categories);
    this.queueAll(cfg.categories);
    if (p.initialImpulse.enabled) this.kick(p.initialImpulse.strength);
    Events.on(this.engine, 'collisionStart', (e) => { for (const pair of e.pairs) this.pending.push(pair); });
  }

  // ---- building -----------------------------------------------------------
  private buildArena(a: ArenaConfig, withPipe: boolean): void {
    const t = a.wallThickness;
    const opts = { isStatic: true, restitution: a.restitution, friction: a.friction, frictionStatic: 0, label: 'wall' };
    let segs = this.arenaSegments(a);
    if (withPipe) {
      this.pipeGeo = this.pipeGeometry(a, segs);
      segs = segs.flatMap((sg) => this.cutForPipe(sg, this.pipeGeo as PipeGeometry));
      this.pipeBody = Body.create({ parts: this.buildPipeParts(a, this.pipeGeo, opts), ...opts });
      Composite.add(this.engine.world, this.pipeBody);
    }
    const parts = segs.map((sg) => this.segmentBody(sg, t, opts));
    this.walls = Body.create({ parts, ...opts });
    Composite.add(this.engine.world, this.walls);
  }

  // Inner edges of the wall, before any pipe cut.
  private arenaSegments(a: ArenaConfig): Seg[] {
    const t = a.wallThickness, segs: Seg[] = [];
    if (a.type === 'rect') {
      const hw = a.width / 2, hh = a.height / 2;
      segs.push({ p0: { x: -hw - t, y: -hh }, p1: { x: hw + t, y: -hh }, n: { x: 0, y: -1 } });
      segs.push({ p0: { x: -hw - t, y: hh }, p1: { x: hw + t, y: hh }, n: { x: 0, y: 1 } });
      segs.push({ p0: { x: -hw, y: -hh - t }, p1: { x: -hw, y: hh + t }, n: { x: -1, y: 0 } });
      segs.push({ p0: { x: hw, y: -hh - t }, p1: { x: hw, y: hh + t }, n: { x: 1, y: 0 } });
      return segs;
    }
    const n = a.type === 'polygon' ? Math.max(3, Math.round(a.sides)) : Math.max(24, Math.round(a.radius / 10));
    const R = a.radius, step = (2 * Math.PI) / n;
    const ext = a.type === 'polygon' ? 0 : 3; // chords overlap a little so the ring has no cracks
    for (let i = 0; i < n; i++) {
      const mid = (i + 0.5) * step;
      if (a.type === 'circleGap') {
        const d = ((mid / DEG - a.gapAngle) % 360 + 540) % 360 - 180;
        if (Math.abs(d) < a.gapWidth / 2) continue;
      }
      const a0 = i * step, a1 = (i + 1) * step;
      let p0 = { x: Math.cos(a0) * R, y: Math.sin(a0) * R }, p1 = { x: Math.cos(a1) * R, y: Math.sin(a1) * R };
      if (ext) {
        const len = Math.hypot(p1.x - p0.x, p1.y - p0.y), dx = (p1.x - p0.x) / len, dy = (p1.y - p0.y) / len;
        p0 = { x: p0.x - dx * ext, y: p0.y - dy * ext }; p1 = { x: p1.x + dx * ext, y: p1.y + dy * ext };
      }
      segs.push({ p0, p1, n: { x: Math.cos(mid), y: Math.sin(mid) } });
    }
    return segs;
  }

  private segmentBody(sg: Seg, t: number, opts: WallOpts): Matter.Body {
    const len = Math.hypot(sg.p1.x - sg.p0.x, sg.p1.y - sg.p0.y);
    const cx = CENTER.x + (sg.p0.x + sg.p1.x) / 2 + sg.n.x * (t / 2), cy = CENTER.y + (sg.p0.y + sg.p1.y) / 2 + sg.n.y * (t / 2);
    return Bodies.rectangle(cx, cy, len, t, { ...opts, angle: Math.atan2(sg.p1.y - sg.p0.y, sg.p1.x - sg.p0.x) });
  }

  // Where the pipe meets the wall: cast two rays parallel to the pipe axis at its inner edges.
  private pipeGeometry(a: ArenaConfig, segs: Seg[]): PipeGeometry {
    const p = a.pipe, th = p.angle * DEG;
    const d = { x: Math.cos(th), y: Math.sin(th) }, u = { x: -Math.sin(th), y: Math.cos(th) };
    const halfWidth = Math.max(10, p.width / 2);
    const hit = (off: number): number => {
      let best = Infinity;
      for (const sg of segs) {
        // segment p0 + s*(p1-p0), s in [0,1]; ray: off*u + v*d, v > 0
        const ex = sg.p1.x - sg.p0.x, ey = sg.p1.y - sg.p0.y;
        const det = ex * (-d.y) - ey * (-d.x); // solve p0 + s*e = off*u + v*d
        if (Math.abs(det) < 1e-9) continue;
        const rx = off * u.x - sg.p0.x, ry = off * u.y - sg.p0.y;
        const s = (rx * (-d.y) - ry * (-d.x)) / det, v = (ex * ry - ey * rx) / det;
        if (s >= -1e-6 && s <= 1 + 1e-6 && v > 0 && v < best) best = v;
      }
      return best;
    };
    const fallback = a.type === 'rect' ? Math.min(a.width, a.height) / 2 : a.radius;
    let vLeft = hit(-halfWidth), vRight = hit(halfWidth);
    if (!Number.isFinite(vLeft)) vLeft = fallback;
    if (!Number.isFinite(vRight)) vRight = fallback;
    const vMin = Math.min(vLeft, vRight);
    return { d, u, halfWidth, vLeft, vRight, vMin, vEnd: Math.max(vLeft, vRight) + Math.max(40, p.length), closed: p.closed };
  }

  // Remove the part of a wall piece that lies inside the pipe channel (on the pipe side of the centre).
  private cutForPipe(sg: Seg, g: PipeGeometry): Seg[] {
    const u0 = dot(sg.p0, g.u), u1 = dot(sg.p1, g.u), hw = g.halfWidth;
    const lerp = (s: number): Vec => ({ x: sg.p0.x + (sg.p1.x - sg.p0.x) * s, y: sg.p0.y + (sg.p1.y - sg.p0.y) * s });
    let lo: number, hi: number;
    if (Math.abs(u1 - u0) < 1e-9) { if (Math.abs(u0) >= hw) return [sg]; lo = 0; hi = 1; }
    else { const ta = (-hw - u0) / (u1 - u0), tb = (hw - u0) / (u1 - u0); lo = Math.max(0, Math.min(ta, tb)); hi = Math.min(1, Math.max(ta, tb)); }
    if (hi <= lo) return [sg];
    if (dot(lerp((lo + hi) / 2), g.d) <= 0) return [sg]; // opposite side of the arena
    const len = Math.hypot(sg.p1.x - sg.p0.x, sg.p1.y - sg.p0.y), out: Seg[] = [];
    if (lo * len > 2) out.push({ p0: sg.p0, p1: lerp(lo), n: sg.n });
    if ((1 - hi) * len > 2) out.push({ p0: lerp(hi), p1: sg.p1, n: sg.n });
    return out;
  }

  private buildPipeParts(a: ArenaConfig, g: PipeGeometry, opts: WallOpts): Matter.Body[] {
    const t = a.wallThickness, th = Math.atan2(g.d.y, g.d.x);
    const at = (v: number, u: number): Vec => ({ x: CENTER.x + g.d.x * v + g.u.x * u, y: CENTER.y + g.d.y * v + g.u.y * u });
    const parts: Matter.Body[] = [];
    for (const [vStart, side] of [[g.vLeft, -1], [g.vRight, 1]] as const) {
      const v0 = vStart - 1, len = g.vEnd + t - v0;
      const c = at(v0 + len / 2, side * (g.halfWidth + t / 2));
      parts.push(Bodies.rectangle(c.x, c.y, len, t, { ...opts, angle: th }));
    }
    if (g.closed) {
      const c = at(g.vEnd + t / 2, 0);
      parts.push(Bodies.rectangle(c.x, c.y, 2 * g.halfWidth + 2 * t, t, { ...opts, angle: th + Math.PI / 2 }));
    }
    return parts;
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
      const s = cat.spawn;
      if (s.mode === 'pipe') continue; // queued, see queueAll
      const r = Math.max(4, cat.radius);
      for (let i = 0; i < Math.max(0, Math.floor(cat.count)); i++) {
        let p: Vec;
        if (s.mode === 'manual' && s.positions.length) p = s.positions[i % s.positions.length];
        else if (s.mode === 'ring') { const R = Math.max(0, this.innerRadius() - r - 10) * 0.65; const ang = (ringIndex++ / Math.max(1, ringTotal)) * Math.PI * 2 - Math.PI / 2; p = { x: Math.cos(ang) * R, y: Math.sin(ang) * R }; }
        else p = this.randomInside(r);
        let vx = 0, vy = 0;
        if (s.velocityMode === 'random') { const ang = this.rng.range(0, Math.PI * 2), sp = s.speed * (1 + this.rng.range(-s.speedJitter, s.speedJitter)); vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp; }
        else if (s.velocityMode === 'fixed') { vx = Math.cos(s.angle * DEG) * s.speed; vy = Math.sin(s.angle * DEG) * s.speed; }
        this.addBall(cat, i, p, { x: vx, y: vy });
      }
    }
  }

  private addBall(cat: Category, index: number, p: Vec, vel: Vec): Ball {
    const r = Math.max(4, cat.radius);
    const body = Bodies.circle(CENTER.x + p.x, CENTER.y + p.y, r, {
      restitution: cat.restitution, friction: cat.friction, frictionStatic: 0,
      frictionAir: Math.max(0, cat.frictionAir + this.cfg.physics.airDamping), label: 'ball'
    });
    Body.setMass(body, Math.max(0.01, cat.mass));
    Body.setVelocity(body, { x: vel.x / 60, y: vel.y / 60 });
    const id = this.ballId++;
    const ball: Ball = { id, cat: cat.id, lives: cat.lives, body, radius: r, spawnIndex: index };
    this.balls.set(id, ball);
    (body as unknown as { ballId: number }).ballId = id;
    Composite.add(this.engine.world, body);
    return ball;
  }

  // Characters in pipe mode get an entry time each; the order is seeded so it is part of the determinism.
  private queueAll(cats: Category[]): void {
    const p = this.cfg.arena.pipe;
    const lists = cats.filter((c) => c.spawn.mode === 'pipe').map((cat) =>
      Array.from({ length: Math.max(0, Math.floor(cat.count)) }, (_, index) => ({ cat, index, at: 0 })));
    let order: Queued[] = [];
    if (p.order === 'sequence') order = lists.flat();
    else {
      const max = Math.max(0, ...lists.map((l) => l.length));
      for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) order.push(l[i]);
      if (p.order === 'shuffle') shuffle(order, () => this.rng.next());
    }
    const every = Math.max(0.02, p.interval), delay = Math.max(0, p.startDelay);
    order.forEach((q, i) => { q.at = delay + i * every; });
    this.queue = order;
  }

  // Release queued characters whose time has come. A blocked mouth (previous ball still there) just waits.
  private releaseQueued(): void {
    const g = this.pipeGeo; if (!g) { this.queue = []; return; }
    while (this.queue.length && this.queue[0].at <= this.time + 1e-9) {
      const q = this.queue[0], r = Math.max(4, q.cat.radius);
      const v = g.vEnd - r - 6, u = this.rng.range(-1, 1) * Math.max(0, g.halfWidth - r - 4) * 0.5;
      const p = { x: g.d.x * v + g.u.x * u, y: g.d.y * v + g.u.y * u };
      if (this.overlaps(p, r)) return;
      const s = q.cat.spawn;
      const sp = s.speed * (1 + this.rng.range(-s.speedJitter, s.speedJitter));
      this.queue.shift();
      this.addBall(q.cat, q.index, p, { x: -g.d.x * sp, y: -g.d.y * sp });
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
    if (this.queue.length) this.releaseQueued();
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
    if (this.walls && a.rotationSpeed && !this.pipeGeo) { // the ring cannot turn while a pipe is attached
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
      let out = a.type === 'circleGap' ? d > a.radius + b.radius * 1.5
        : p.x < -300 || p.x > CANVAS_W + 300 || p.y < -300 || p.y > CANVAS_H + 300;
      if (out && this.inPipe(p, b.radius)) out = false;
      if (out) { events.push({ type: 'escape', cat: b.cat, x: p.x, y: p.y, body: b.id }); this.remove(b.id); }
    }
  }

  private inPipe(p: Vec, r: number): boolean {
    const g = this.pipeGeo; if (!g) return false;
    const l = { x: p.x - CENTER.x, y: p.y - CENTER.y };
    const v = dot(l, g.d), u = dot(l, g.u);
    return v > g.vMin - r && v < g.vEnd + r * 4 && Math.abs(u) < g.halfWidth + r;
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
    for (const q of this.queue) out[q.cat.id] = (out[q.cat.id] ?? 0) + 1;
    return out;
  }
  // Characters still in play: in the arena or waiting in the pipe.
  alive(): number { return this.balls.size + this.queue.length; }
  waiting(): number { return this.queue.length; }

  // Geometry for the renderer (static shapes are drawn from the bodies so visuals match physics exactly).
  wallParts(): Matter.Body[] { return this.walls ? this.walls.parts.slice(1) : []; }
  pipeParts(): Matter.Body[] { return this.pipeBody ? this.pipeBody.parts.slice(1) : []; }
  pipe(): PipeGeometry | null { return this.pipeGeo; }
  obstacleBodies(): { cfg: Obstacle; body: Matter.Body }[] { return this.obstacles; }
}
