// Web Audio engine: music timeline, collision sounds with cooldown/pitch/intensity scaling, voice limiting,
// and a MediaStream destination so exports carry the same audio.
import type { Asset, AudioConfig, SoundSlot } from '../types';
import { builtinSound } from './builtins';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private music: AudioBufferSourceNode | null = null;
  private lastPlay = new Map<string, number>();
  private voices = 0;
  private cfg: AudioConfig;
  private assets: Asset[];
  muted = false;

  constructor(cfg: AudioConfig, assets: Asset[]) { this.cfg = cfg; this.assets = assets; }

  get context(): AudioContext | null { return this.ctx; }
  get stream(): MediaStream | null { return this.streamDest ? this.streamDest.stream : null; }

  // Must be called from a user gesture the first time (autoplay policy).
  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.streamDest = this.ctx.createMediaStreamDestination();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -6; this.limiter.knee.value = 6; this.limiter.ratio.value = 12; this.limiter.attack.value = 0.002; this.limiter.release.value = 0.12;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      this.limiter.connect(this.streamDest);
      this.musicGain.connect(this.master);
      this.applyConfig(this.cfg, this.assets);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  applyConfig(cfg: AudioConfig, assets: Asset[]): void {
    this.cfg = cfg; this.assets = assets;
    if (this.master) this.master.gain.value = this.muted ? 0 : cfg.masterVolume;
    if (this.musicGain) this.musicGain.gain.value = cfg.music.volume;
    void this.preload();
  }

  setMuted(m: boolean): void { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.cfg.masterVolume; }

  // Decode every referenced sound up front so playback never waits on decoding.
  async preload(): Promise<void> {
    if (!this.ctx) return;
    const ids = new Set<string>();
    const add = (s: SoundSlot) => { if (s.assetId) ids.add(s.assetId); };
    Object.values(this.cfg.pairs).forEach(add);
    [this.cfg.wall, this.cfg.obstacle, this.cfg.escape, this.cfg.eliminate, this.cfg.victory].forEach(add);
    if (this.cfg.music.assetId) ids.add(this.cfg.music.assetId);
    await Promise.all(Array.from(ids).map((id) => this.buffer(id)));
  }

  private buffer(id: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have) return Promise.resolve(have);
    const inflight = this.loading.get(id);
    if (inflight) return inflight;
    const p = (async () => {
      if (!this.ctx) return null;
      let buf: AudioBuffer | null = null;
      try {
        if (id.startsWith('builtin:')) buf = await builtinSound(id, this.ctx.sampleRate);
        else {
          const a = this.assets.find((x) => x.id === id);
          if (a) { const bytes = await (await fetch(a.dataUrl)).arrayBuffer(); buf = await this.ctx.decodeAudioData(bytes); }
        }
      } catch (e) { console.warn('audio decode failed', id, e); }
      if (buf) this.buffers.set(id, buf);
      this.loading.delete(id);
      return buf;
    })();
    this.loading.set(id, p);
    return p;
  }

  // ---- music timeline -----------------------------------------------------
  // Start (or restart) the music so that audio position == simulation time `simTime`, at playback `rate`.
  startMusic(simTime: number, rate: number): void {
    this.stopMusic();
    const id = this.cfg.music.assetId;
    if (!this.ctx || !this.musicGain || !id) return;
    const buf = this.buffers.get(id);
    if (!buf) { void this.buffer(id).then(() => { if (this.music === null) this.startMusic(simTime, rate); }); return; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = this.cfg.music.loop; src.playbackRate.value = rate;
    src.connect(this.musicGain);
    const offset = this.cfg.music.loop ? simTime % buf.duration : simTime;
    if (!this.cfg.music.loop && offset >= buf.duration) return;
    src.start(this.ctx.currentTime, offset);
    this.music = src;
  }
  stopMusic(): void { if (this.music) { try { this.music.stop(); } catch { /* already stopped */ } this.music.disconnect(); this.music = null; } }
  setRate(rate: number): void { if (this.music) this.music.playbackRate.value = rate; }

  // ---- one-shot sounds ----------------------------------------------------
  // `when` is an AudioContext time; `intensity` px/s impact speed; `simTime` for cooldowns in simulation seconds.
  play(key: string, slot: SoundSlot | undefined, when: number, intensity: number, simTime: number): void {
    if (!slot || !slot.assetId || !this.ctx || !this.master) return;
    const last = this.lastPlay.get(key);
    if (last !== undefined && (simTime - last) * 1000 < slot.cooldown) return;
    if (this.voices >= this.cfg.maxVoices) return;
    const buf = this.buffers.get(slot.assetId);
    if (!buf) { void this.buffer(slot.assetId); return; }
    this.lastPlay.set(key, simTime);
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = Math.pow(2, slot.pitch / 12);
    const g = this.ctx.createGain();
    const scale = slot.intensityScaling ? Math.min(1, 0.25 + intensity / 1500) : 1;
    g.gain.value = slot.volume * scale;
    src.connect(g).connect(this.master);
    this.voices += 1;
    src.onended = () => { this.voices -= 1; src.disconnect(); g.disconnect(); };
    src.start(Math.max(when, this.ctx.currentTime));
  }

  resetCooldowns(): void { this.lastPlay.clear(); }

  async decodeForPreview(id: string): Promise<number> {
    await this.ensure();
    const b = await this.buffer(id);
    return b ? b.duration : 0;
  }
}
