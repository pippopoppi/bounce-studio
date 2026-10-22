// Orchestrates physics, audio, effects and rendering with a fixed physics step.
// The simulation clock is either the wall clock (preview) or the AudioContext clock (export) so that
// sounds and frames stay locked together.
import type { Config, SimEvent } from '../types';
import { pairKey } from '../types';
import { PhysicsWorld } from '../physics/world';
import { AudioEngine } from '../audio/engine';
import { Renderer, Effects } from '../render/renderer';

export type SimState = 'idle' | 'playing' | 'paused' | 'finished';
export interface SimStatus { state: SimState; time: number; counts: Record<string, number>; winner: string | null; alive: number }

export class Simulation {
  private world: PhysicsWorld;
  private renderer: Renderer;
  private fx = new Effects();
  private cfg: Config;
  private state: SimState = 'idle';
  private winner: string | null = null;
  private raf = 0;
  private clockMode: 'wall' | 'audio' = 'wall';
  private anchorClock = 0;   // clock value when play started
  private anchorSim = 0;     // simulation time when play started
  private nextImpulse = 0;
  private finishResolvers: (() => void)[] = [];
  onStatus: (s: SimStatus) => void = () => {};

  constructor(canvas: HTMLCanvasElement, private audio: AudioEngine, cfg: Config) {
    this.renderer = new Renderer(canvas);
    this.cfg = cfg;
    this.world = new PhysicsWorld(cfg);
    this.renderer.setAssets(cfg.assets);
    this.draw();
  }

  get status(): SimStatus { return { state: this.state, time: this.world.time, counts: this.world.counts(), winner: this.winner, alive: this.world.balls.size }; }
  get config(): Config { return this.cfg; }

  // Rebuild the world from a configuration (physics/arena/characters changed).
  load(cfg: Config): void {
    this.stopLoop();
    this.audio.stopMusic();
    this.cfg = cfg;
    this.world = new PhysicsWorld(cfg);
    this.fx.reset();
    this.state = 'idle'; this.winner = null;
    this.nextImpulse = cfg.physics.periodicImpulse.every;
    this.renderer.setAssets(cfg.assets);
    this.audio.applyConfig(cfg.audio, cfg.assets);
    this.audio.resetCooldowns();
    this.draw(); this.emit();
  }

  // Settings that do not change the physics result (visuals, audio levels, export) apply without a rebuild.
  applyLive(cfg: Config): void {
    this.cfg = { ...this.world.cfg, render: cfg.render, audio: cfg.audio, export: cfg.export, assets: cfg.assets, name: cfg.name, speed: cfg.speed, duration: cfg.duration, autoStop: cfg.autoStop };
    (this.world as unknown as { cfg: Config }).cfg = this.cfg;
    this.renderer.setAssets(cfg.assets);
    this.audio.applyConfig(cfg.audio, cfg.assets);
    if (this.state === 'playing') { this.audio.setRate(cfg.speed); this.reanchor(); }
    this.draw();
  }

  reset(): void { this.load(this.cfg); }

  async play(clock: 'wall' | 'audio' = 'wall'): Promise<void> {
    if (this.state === 'playing') return;
    if (this.state === 'finished') this.load(this.cfg);
    await this.audio.ensure();
    this.clockMode = clock;
    this.state = 'playing';
    this.reanchor();
    this.audio.startMusic(this.world.time, this.cfg.speed);
    this.emit();
    this.startLoop();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.stopLoop();
    this.audio.stopMusic();
    this.emit();
  }

  // Advance exactly one physics step (works from idle or paused).
  stepOnce(): void {
    if (this.state === 'playing') this.pause();
    if (this.state === 'finished') return;
    this.state = 'paused';
    this.advance(1);
    this.draw(); this.emit();
  }

  whenFinished(): Promise<void> { return new Promise((res) => this.finishResolvers.push(res)); }

  private reanchor(): void { this.anchorClock = this.now(); this.anchorSim = this.world.time; }
  private now(): number {
    if (this.clockMode === 'audio' && this.audio.context) return this.audio.context.currentTime;
    return performance.now() / 1000;
  }

  private startLoop(): void {
    const tick = () => {
      if (this.state !== 'playing') return;
      const target = this.anchorSim + (this.now() - this.anchorClock) * this.cfg.speed;
      const dt = 1 / this.cfg.physics.timeStep;
      let steps = Math.floor((target - this.world.time) / dt + 1e-9);
      if (this.clockMode === 'wall' && steps > 12) { steps = 12; this.reanchor(); } // too slow: drop time, never spiral
      if (steps > 0) this.advance(steps);
      this.draw();
      if (this.state === 'playing') this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  private stopLoop(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private advance(steps: number): void {
    const dt = 1 / this.cfg.physics.timeStep;
    for (let i = 0; i < steps; i++) {
      const p = this.cfg.physics.periodicImpulse;
      if (p.enabled && this.world.time + 1e-9 >= this.nextImpulse) { this.world.kick(p.strength); this.nextImpulse += Math.max(0.1, p.every); }
      const events = this.world.step(dt);
      this.handleEvents(events);
      this.fx.update(dt, this.world, this.cfg);
      if (this.checkEnd()) break;
    }
    this.emit();
  }

  private handleEvents(events: SimEvent[]): void {
    const a = this.cfg.audio;
    const simT = this.world.time;
    const when = this.audio.context ? this.audio.context.currentTime + Math.max(0, (simT - this.anchorSim) / this.cfg.speed - (this.now() - this.anchorClock)) : 0;
    for (const e of events) {
      if (e.type === 'pair') { const k = pairKey(e.a, e.b); this.audio.play('pair:' + k, a.pairs[k], when, e.intensity, simT); }
      else if (e.type === 'wall') this.audio.play('wall', a.wall, when, e.intensity, simT);
      else if (e.type === 'obstacle') this.audio.play('obstacle', a.obstacle, when, e.intensity, simT);
      else if (e.type === 'escape') this.audio.play('escape', a.escape, when, 1500, simT);
      else if (e.type === 'eliminate') this.audio.play('eliminate', a.eliminate, when, 1500, simT);
    }
    this.fx.onEvents(events, this.cfg, (cat) => this.cfg.categories.find((k) => k.id === cat)?.color ?? '#fff');
  }

  private checkEnd(): boolean {
    const counts = this.world.counts();
    const aliveCats = Object.keys(counts).filter((k) => counts[k] > 0);
    const alive = this.world.balls.size;
    let done = this.world.time >= this.cfg.duration - 1e-9;
    if (this.cfg.autoStop === 'lastCharacter' && alive <= 1) done = true;
    if (this.cfg.autoStop === 'lastCategory' && aliveCats.length <= 1) done = true;
    if (!done) return false;
    this.winner = aliveCats.length === 1 ? aliveCats[0] : null;
    if (aliveCats.length > 1 && this.cfg.autoStop !== 'never') { // most survivors wins
      const best = aliveCats.reduce((p, k) => (counts[k] > counts[p] ? k : p), aliveCats[0]);
      if (aliveCats.filter((k) => counts[k] === counts[best]).length === 1) this.winner = best;
    }
    this.state = 'finished';
    this.stopLoop();
    if (this.audio.context) this.audio.play('victory', this.cfg.audio.victory, this.audio.context.currentTime, 1500, this.world.time);
    this.audio.stopMusic();
    const rs = this.finishResolvers; this.finishResolvers = []; rs.forEach((r) => r());
    return true;
  }

  draw(): void {
    this.renderer.draw(this.world, this.cfg, this.fx, this.world.time, this.state, this.winner);
  }

  private emit(): void { this.onStatus(this.status); }
}
