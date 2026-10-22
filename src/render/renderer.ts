// Canvas 2D renderer. Reads body positions from the physics world; never writes to it.
import type { Asset, Config, SimEvent } from '../types';
import { CANVAS_W, CANVAS_H } from '../types';
import type { PhysicsWorld } from '../physics/world';
import { CENTER } from '../physics/world';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Squash { nx: number; ny: number; t: number }

export class Effects {
  trails = new Map<number, { x: number; y: number }[]>();
  particles: Particle[] = [];
  squash = new Map<number, Squash>();
  flashes: { x: number; y: number; t: number; color: string }[] = [];

  reset(): void { this.trails.clear(); this.particles = []; this.squash.clear(); this.flashes = []; }

  onEvents(events: SimEvent[], cfg: Config, colorOf: (cat: string) => string): void {
    for (const e of events) {
      if (e.type === 'pair' || e.type === 'wall' || e.type === 'obstacle') {
        const ids = e.type === 'pair' ? e.bodies : [e.body];
        if (cfg.render.squash.enabled) for (const id of ids) this.squash.set(id, { nx: e.nx, ny: e.ny, t: 0 });
        if (cfg.render.particles.enabled && e.intensity > 150) {
          const n = Math.round(cfg.render.particles.amount * Math.min(2, e.intensity / 800));
          const color = colorOf(e.type === 'pair' ? e.a : e.cat);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 420;
            this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.3, color, size: 4 + Math.random() * 6 });
          }
        }
      } else if (e.type === 'eliminate' || e.type === 'escape') {
        const color = colorOf(e.cat);
        this.flashes.push({ x: e.x, y: e.y, t: 0, color });
        if (cfg.render.particles.enabled) for (let i = 0; i < 24; i++) {
          const a = Math.random() * Math.PI * 2, s = 200 + Math.random() * 500;
          this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.6 + Math.random() * 0.4, color, size: 6 + Math.random() * 8 });
        }
        this.trails.delete(e.body);
      }
    }
  }

  // Effects advance with simulation time, so exports and previews look identical.
  update(dt: number, world: PhysicsWorld, cfg: Config): void {
    for (const p of this.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.vx *= 0.98; }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const [id, s] of this.squash) { s.t += dt; if (s.t > 0.14) this.squash.delete(id); }
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.5);
    if (cfg.render.trails.enabled) {
      for (const b of world.balls.values()) {
        let tr = this.trails.get(b.id); if (!tr) { tr = []; this.trails.set(b.id, tr); }
        tr.push({ x: b.body.position.x, y: b.body.position.y });
        while (tr.length > cfg.render.trails.length) tr.shift();
      }
    } else if (this.trails.size) this.trails.clear();
  }
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private images = new Map<string, HTMLImageElement>();

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not available');
    this.ctx = ctx;
  }

  setAssets(assets: Asset[]): void {
    const keep = new Set<string>();
    for (const a of assets) {
      if (a.kind !== 'image') continue;
      keep.add(a.id);
      const have = this.images.get(a.id);
      if (have && have.src === a.dataUrl) continue;
      const img = new Image(); img.src = a.dataUrl; this.images.set(a.id, img);
    }
    for (const k of Array.from(this.images.keys())) if (!keep.has(k)) this.images.delete(k);
  }

  draw(world: PhysicsWorld, cfg: Config, fx: Effects, time: number, status: string, winner: string | null): void {
    const c = this.ctx, r = cfg.render;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = r.background; c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.drawArena(world, cfg);
    this.drawObstacles(world);
    this.drawTrails(world, cfg, fx);
    this.drawParticles(fx);
    this.drawBalls(world, cfg, fx);
    this.drawFlashes(fx);
    this.drawHud(world, cfg, time, status, winner);
  }

  private colorOf(cfg: Config, cat: string): string { return cfg.categories.find((k) => k.id === cat)?.color ?? '#ffffff'; }

  private drawArena(world: PhysicsWorld, cfg: Config): void {
    const c = this.ctx, a = cfg.arena;
    c.fillStyle = cfg.render.arenaFill;
    c.beginPath();
    if (a.type === 'rect') c.rect(CENTER.x - a.width / 2, CENTER.y - a.height / 2, a.width, a.height);
    else if (a.type === 'polygon') {
      const n = Math.max(3, Math.round(a.sides)), rot = (world.time * a.rotationSpeed * Math.PI) / 180;
      for (let i = 0; i < n; i++) { const t = rot + (i / n) * Math.PI * 2; const x = CENTER.x + Math.cos(t) * a.radius, y = CENTER.y + Math.sin(t) * a.radius; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.closePath();
    } else c.arc(CENTER.x, CENTER.y, a.radius, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = a.color;
    for (const part of world.wallParts()) this.fillBody(part);
  }

  private fillBody(b: Matter.Body): void {
    const c = this.ctx;
    if (b.circleRadius) { c.beginPath(); c.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2); c.fill(); return; }
    c.beginPath();
    b.vertices.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
    c.closePath(); c.fill();
  }

  private drawObstacles(world: PhysicsWorld): void {
    for (const o of world.obstacleBodies()) { this.ctx.fillStyle = o.cfg.color; this.fillBody(o.body); }
  }

  private drawTrails(world: PhysicsWorld, cfg: Config, fx: Effects): void {
    if (!cfg.render.trails.enabled) return;
    const c = this.ctx;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const b of world.balls.values()) {
      const tr = fx.trails.get(b.id); if (!tr || tr.length < 2) continue;
      const color = this.colorOf(cfg, b.cat);
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        c.strokeStyle = color; c.globalAlpha = k * 0.45; c.lineWidth = Math.max(1, b.radius * 2 * cfg.render.trails.width * k);
        c.beginPath(); c.moveTo(tr[i - 1].x, tr[i - 1].y); c.lineTo(tr[i].x, tr[i].y); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  private drawParticles(fx: Effects): void {
    const c = this.ctx;
    for (const p of fx.particles) {
      c.globalAlpha = 1 - p.life / p.max; c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.size * (1 - p.life / p.max * 0.5), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }

  private drawBalls(world: PhysicsWorld, cfg: Config, fx: Effects): void {
    const c = this.ctx, r = cfg.render;
    for (const b of world.balls.values()) {
      const cat = cfg.categories.find((k) => k.id === b.cat);
      const color = cat?.color ?? '#fff';
      const p = b.body.position, rad = b.radius;
      c.save();
      c.translate(p.x, p.y);
      const s = fx.squash.get(b.id);
      if (s && r.squash.enabled) {
        const k = Math.sin((s.t / 0.14) * Math.PI) * r.squash.amount; // in then out
        const ang = Math.atan2(s.ny, s.nx);
        c.rotate(ang); c.scale(1 - k, 1 + k); c.rotate(-ang);
      }
      if (cat?.rotate) c.rotate(b.body.angle);
      c.beginPath(); c.arc(0, 0, rad, 0, Math.PI * 2); c.closePath();
      c.fillStyle = color; c.fill();
      const img = cat?.imageAssetId ? this.images.get(cat.imageAssetId) : undefined;
      if (img && img.complete && img.naturalWidth > 0) {
        c.save(); c.clip();
        const iw = img.naturalWidth, ih = img.naturalHeight, sc = (rad * 2) / Math.min(iw, ih); // cover fit
        c.drawImage(img, (-iw * sc) / 2, (-ih * sc) / 2, iw * sc, ih * sc);
        c.restore();
      }
      if (r.outlineWidth > 0) { c.lineWidth = r.outlineWidth; c.strokeStyle = r.outlineColor || color; c.stroke(); }
      c.restore();
      if (r.labels && cat) {
        c.font = `bold ${Math.max(16, Math.round(rad * 0.5))}px system-ui, sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.fillStyle = '#fff';
        c.strokeText(cat.name, p.x, p.y + rad + 6); c.fillText(cat.name, p.x, p.y + rad + 6);
      }
    }
  }

  private drawFlashes(fx: Effects): void {
    const c = this.ctx;
    for (const f of fx.flashes) {
      const k = f.t / 0.5;
      c.globalAlpha = (1 - k) * 0.8; c.strokeStyle = f.color; c.lineWidth = 10 * (1 - k) + 2;
      c.beginPath(); c.arc(f.x, f.y, 40 + k * 260, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }

  private drawHud(world: PhysicsWorld, cfg: Config, time: number, status: string, winner: string | null): void {
    const c = this.ctx, r = cfg.render;
    c.textBaseline = 'middle';
    if (r.title) {
      c.font = 'bold 64px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffffff';
      c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.strokeText(r.title, CANVAS_W / 2, 110); c.fillText(r.title, CANVAS_W / 2, 110);
    }
    if (r.counter) {
      const counts = world.counts();
      const cats = cfg.categories;
      const w = 1080 / Math.max(1, cats.length);
      const y = r.title ? 200 : 120;
      cats.forEach((k, i) => {
        const x = w * i + w / 2;
        c.fillStyle = k.color; c.beginPath(); c.arc(x - 60, y, 26, 0, Math.PI * 2); c.fill();
        c.font = 'bold 54px system-ui, sans-serif'; c.textAlign = 'left'; c.fillStyle = '#ffffff';
        c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.5)';
        const s = String(counts[k.id] ?? 0);
        c.strokeText(s, x - 20, y); c.fillText(s, x - 20, y);
        c.font = '28px system-ui, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillText(k.name.slice(0, 12), x - 20, y + 46);
      });
    }
    if (status === 'finished') {
      const name = winner ? cfg.categories.find((k) => k.id === winner)?.name ?? '' : '';
      const text = name ? `${name} wins!` : 'Finished';
      c.font = 'bold 96px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffffff';
      c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.strokeText(text, CANVAS_W / 2, CANVAS_H - 220); c.fillText(text, CANVAS_W / 2, CANVAS_H - 220);
    }
    void time;
  }
}
