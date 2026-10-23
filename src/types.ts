// All configuration types. A Config is plain JSON (assets embedded as data URLs) so it can be saved/loaded.

export type AssetKind = 'image' | 'audio';
export interface Asset { id: string; kind: AssetKind; name: string; dataUrl: string }

export interface Vec { x: number; y: number }

export interface SpawnConfig {
  mode: 'random' | 'ring' | 'manual' | 'pipe';
  positions: Vec[];            // manual mode: offsets from the arena centre, canvas pixels
                               // pipe mode: the characters queue up and drop in one at a time through the arena pipe
  velocityMode: 'random' | 'fixed' | 'zero';
  speed: number;               // px/s
  angle: number;               // degrees (fixed mode)
  speedJitter: number;         // 0..1, random mode
}

export type LoseLifeOn = 'never' | 'otherCategory' | 'anyCharacter' | 'wall' | 'obstacle';

export interface Category {
  id: string;
  name: string;
  color: string;
  imageAssetId: string | null;
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
  frictionAir: number;
  count: number;
  spawn: SpawnConfig;
  rotate: boolean;             // visual rotation of the texture with the body
  lives: number;               // 0 = never eliminated
  loseLifeOn: LoseLifeOn;
  minImpact: number;           // px/s: weaker hits do not count
}

export type ArenaType = 'circle' | 'rect' | 'polygon' | 'circleGap';
// A chute attached to the wall: characters in 'pipe' spawn mode enter the arena through it, one after the other.
export interface PipeConfig {
  enabled: boolean;
  width: number;               // inner width, px
  length: number;              // px from the wall outwards
  angle: number;               // degrees, direction from the centre (-90 = top)
  closed: boolean;             // cap at the far end so nothing bounces out
  interval: number;            // seconds between two entries
  startDelay: number;          // seconds before the first entry
  order: 'interleave' | 'sequence' | 'shuffle';
}
export interface ArenaConfig {
  type: ArenaType;
  radius: number;
  width: number;
  height: number;
  sides: number;
  gapAngle: number;            // degrees, centre of the opening (0 = right, 90 = down)
  gapWidth: number;            // degrees
  rotationSpeed: number;       // deg/s, rotates the whole wall ring
  restitution: number;
  friction: number;
  wallThickness: number;
  color: string;
  pipe: PipeConfig;
}

export type ObstacleKind = 'circle' | 'rect' | 'segment';
export interface ObstacleMotion { type: 'none' | 'linear' | 'orbit'; ax: number; ay: number; period: number }
export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  x: number; y: number;        // offsets from the arena centre
  w: number; h: number;        // rect / segment length & thickness
  r: number;                   // circle radius
  angle: number;               // degrees
  angularVelocity: number;     // deg/s
  motion: ObstacleMotion;      // linear: oscillates ±(ax,ay) over period s; orbit: circles radius ax around (x,y)
  restitution: number;
  friction: number;
  color: string;
}

export interface PhysicsConfig {
  gravityEnabled: boolean;
  gravityX: number;            // Matter units, 1 = default earth-like
  gravityY: number;
  timeStep: number;            // Hz
  substeps: number;
  airDamping: number;          // added to every body's frictionAir
  velocityIterations: number;
  positionIterations: number;
  maxSpeed: number;            // px/s clamp, 0 = none
  initialImpulse: { enabled: boolean; strength: number };          // px/s, random direction at start
  periodicImpulse: { enabled: boolean; every: number; strength: number }; // seconds, px/s
}

export interface SoundSlot {
  assetId: string | null;      // uploaded asset id, 'builtin:<name>' or null (silent)
  volume: number;              // 0..1
  pitch: number;               // semitones
  cooldown: number;            // ms between two plays of this slot
  intensityScaling: boolean;
}

export interface AudioConfig {
  masterVolume: number;
  maxVoices: number;
  music: { assetId: string | null; volume: number; loop: boolean };
  pairs: Record<string, SoundSlot>;   // key = pairKey(idA, idB)
  wall: SoundSlot;
  obstacle: SoundSlot;
  escape: SoundSlot;
  eliminate: SoundSlot;
  victory: SoundSlot;
}

export interface RenderConfig {
  background: string;
  arenaFill: string;
  wallStyle: 'solid' | 'rainbow';
  outlineWidth: number;
  outlineColor: string;        // '' = use the category colour
  trails: { enabled: boolean; length: number; width: number };
  particles: { enabled: boolean; amount: number };
  squash: { enabled: boolean; amount: number };
  labels: boolean;
  counter: boolean;
  title: string;
  hudPosition: 'top' | 'bottom'; // counter and title at the top or below the arena (e.g. when a pipe is at the top)
}

export interface ExportConfig { format: 'auto' | 'webm' | 'mp4'; fps: number; bitrateMbps: number }

export interface Config {
  version: 1;
  name: string;
  seed: number;
  duration: number;            // seconds
  speed: number;               // playback speed multiplier
  autoStop: 'never' | 'lastCharacter' | 'lastCategory';
  physics: PhysicsConfig;
  arena: ArenaConfig;
  obstacles: Obstacle[];
  categories: Category[];
  audio: AudioConfig;
  render: RenderConfig;
  export: ExportConfig;
  assets: Asset[];
}

// Events emitted by the physics world, consumed by audio + visual effects.
export type SimEvent =
  | { type: 'pair'; a: string; b: string; intensity: number; x: number; y: number; nx: number; ny: number; bodies: [number, number] }
  | { type: 'wall'; cat: string; intensity: number; x: number; y: number; nx: number; ny: number; body: number }
  | { type: 'obstacle'; cat: string; intensity: number; x: number; y: number; nx: number; ny: number; body: number }
  | { type: 'escape'; cat: string; x: number; y: number; body: number }
  | { type: 'eliminate'; cat: string; x: number; y: number; body: number }
  | { type: 'victory'; cat: string | null };

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

export function pairKey(a: string, b: string): string { return a < b ? a + '|' + b : b + '|' + a; }
