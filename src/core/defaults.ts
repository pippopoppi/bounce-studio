import type { ArenaConfig, Category, Config, Obstacle, SoundSlot, SpawnConfig } from '../types';
import { pairKey } from '../types';

export const BUILTIN_SOUNDS = [
  'builtin:blip-low', 'builtin:blip-mid', 'builtin:blip-high', 'builtin:pop', 'builtin:knock',
  'builtin:tick', 'builtin:whoosh', 'builtin:chime', 'builtin:buzz', 'builtin:fanfare'
] as const;
export const BUILTIN_MUSIC = 'builtin:demo-music';

export function soundSlot(assetId: string | null = null, volume = 0.8): SoundSlot {
  return { assetId, volume, pitch: 0, cooldown: 40, intensityScaling: true };
}

export function defaultSpawn(): SpawnConfig {
  return { mode: 'random', positions: [], velocityMode: 'random', speed: 700, angle: 0, speedJitter: 0.4 };
}

// Locally generated character picture (SVG face) so the demo needs no external files.
export function faceSvg(color: string, mouth: 'smile' | 'flat' | 'o' = 'smile'): string {
  const m = mouth === 'smile' ? '<path d="M34 62 Q50 78 66 62" stroke="#1b1b1b" stroke-width="6" fill="none" stroke-linecap="round"/>'
    : mouth === 'flat' ? '<path d="M36 66 L64 66" stroke="#1b1b1b" stroke-width="6" stroke-linecap="round"/>'
    : '<circle cx="50" cy="67" r="8" fill="#1b1b1b"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${color}"/><circle cx="35" cy="42" r="7" fill="#1b1b1b"/><circle cx="65" cy="42" r="7" fill="#1b1b1b"/>${m}</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

export function newCategory(partial: Partial<Category> & { id: string; name: string; color: string }): Category {
  return {
    imageAssetId: null, radius: 60, mass: 1, restitution: 0.95, friction: 0.02, frictionAir: 0,
    count: 4, spawn: defaultSpawn(), rotate: true, lives: 0, loseLifeOn: 'never', minImpact: 300,
    ...partial
  };
}

export function newObstacle(kind: Obstacle['kind'], id: string): Obstacle {
  return {
    id, kind, x: 0, y: 0, w: kind === 'segment' ? 500 : 200, h: kind === 'segment' ? 24 : 60, r: 90, angle: 0,
    angularVelocity: kind === 'segment' ? 60 : 0, motion: { type: 'none', ax: 0, ay: 0, period: 4 },
    restitution: 0.9, friction: 0.05, color: '#f2f2f2'
  };
}

export function defaultArena(): ArenaConfig {
  return {
    type: 'circle', radius: 480, width: 900, height: 1500, sides: 6, gapAngle: 90, gapWidth: 40,
    rotationSpeed: 0, restitution: 0.98, friction: 0.01, wallThickness: 40, color: '#ffffff'
  };
}

export function defaultConfig(): Config {
  const ids = { a: 'cat_red', b: 'cat_blue', c: 'cat_yellow' };
  const assets = [
    { id: 'img_red', kind: 'image' as const, name: 'red-face.svg', dataUrl: faceSvg('#ff4d4d', 'smile') },
    { id: 'img_blue', kind: 'image' as const, name: 'blue-face.svg', dataUrl: faceSvg('#4da6ff', 'o') },
    { id: 'img_yellow', kind: 'image' as const, name: 'yellow-face.svg', dataUrl: faceSvg('#ffd93d', 'flat') }
  ];
  const categories: Category[] = [
    newCategory({ id: ids.a, name: 'Red', color: '#ff4d4d', imageAssetId: 'img_red', count: 4 }),
    newCategory({ id: ids.b, name: 'Blue', color: '#4da6ff', imageAssetId: 'img_blue', count: 4 }),
    newCategory({ id: ids.c, name: 'Yellow', color: '#ffd93d', imageAssetId: 'img_yellow', count: 4 })
  ];
  const pairs: Record<string, SoundSlot> = {};
  const tones = ['builtin:blip-low', 'builtin:blip-mid', 'builtin:blip-high', 'builtin:pop', 'builtin:tick', 'builtin:chime'];
  let i = 0;
  const list = [ids.a, ids.b, ids.c];
  for (let x = 0; x < list.length; x++) for (let y = x; y < list.length; y++) pairs[pairKey(list[x], list[y])] = soundSlot(tones[i++ % tones.length]);
  return {
    version: 1,
    name: 'Demo: three faces',
    seed: 12345,
    duration: 30,
    speed: 1,
    autoStop: 'never',
    physics: {
      gravityEnabled: true, gravityX: 0, gravityY: 1, timeStep: 120, substeps: 2, airDamping: 0,
      velocityIterations: 6, positionIterations: 8, maxSpeed: 4000,
      initialImpulse: { enabled: false, strength: 800 },
      periodicImpulse: { enabled: false, every: 5, strength: 600 }
    },
    arena: defaultArena(),
    obstacles: [],
    categories,
    audio: {
      masterVolume: 0.9, maxVoices: 12,
      music: { assetId: BUILTIN_MUSIC, volume: 0.5, loop: true },
      pairs,
      wall: soundSlot('builtin:knock', 0.5),
      obstacle: soundSlot('builtin:knock', 0.6),
      escape: soundSlot('builtin:whoosh', 0.8),
      eliminate: soundSlot('builtin:buzz', 0.8),
      victory: soundSlot('builtin:fanfare', 0.9)
    },
    render: {
      background: '#101418', arenaFill: '#1a2129', outlineWidth: 6, outlineColor: '',
      trails: { enabled: true, length: 14, width: 0.5 },
      particles: { enabled: true, amount: 6 },
      squash: { enabled: true, amount: 0.18 },
      labels: false, counter: true, title: ''
    },
    export: { format: 'auto', fps: 60, bitrateMbps: 12 },
    assets
  };
}

// Predefined arenas built for frequent collisions. Each returns the arena + obstacles + physics tweaks.
export interface ArenaPreset { name: string; description: string; apply: (c: Config) => Config }
export const ARENA_PRESETS: ArenaPreset[] = [
  {
    name: 'Pinball circle',
    description: 'Circular arena, gravity on, three spinning bars in the middle.',
    apply: (c) => ({
      ...c,
      arena: { ...defaultArena(), type: 'circle', radius: 500 },
      physics: { ...c.physics, gravityEnabled: true, gravityX: 0, gravityY: 1 },
      obstacles: [
        { ...newObstacle('segment', 'ob_bar1'), x: 0, y: -120, w: 420, h: 22, angularVelocity: 90 },
        { ...newObstacle('segment', 'ob_bar2'), x: -230, y: 220, w: 300, h: 22, angularVelocity: -120 },
        { ...newObstacle('segment', 'ob_bar3'), x: 230, y: 220, w: 300, h: 22, angularVelocity: 120 },
        { ...newObstacle('circle', 'ob_bumper'), x: 0, y: 320, r: 60, restitution: 1.2, color: '#ff8a65' }
      ]
    })
  },
  {
    name: 'Zero-G chaos',
    description: 'No gravity, fast balls in a hexagon, two orbiting bumpers.',
    apply: (c) => ({
      ...c,
      arena: { ...defaultArena(), type: 'polygon', sides: 6, radius: 520, rotationSpeed: 10 },
      physics: { ...c.physics, gravityEnabled: false, initialImpulse: { enabled: true, strength: 900 } },
      categories: c.categories.map((k) => ({ ...k, restitution: 1, friction: 0, frictionAir: 0, spawn: { ...k.spawn, velocityMode: 'random', speed: 900 } })),
      obstacles: [
        { ...newObstacle('circle', 'ob_orb1'), x: 0, y: 0, r: 70, motion: { type: 'orbit', ax: 260, ay: 0, period: 6 }, restitution: 1.1, color: '#80deea' },
        { ...newObstacle('circle', 'ob_orb2'), x: 0, y: 0, r: 70, motion: { type: 'orbit', ax: -260, ay: 0, period: 6 }, restitution: 1.1, color: '#ce93d8' }
      ]
    })
  },
  {
    name: 'Escape ring',
    description: 'Circle with a rotating opening: the last ones inside win. Elimination on escape.',
    apply: (c) => ({
      ...c,
      arena: { ...defaultArena(), type: 'circleGap', radius: 500, gapAngle: 90, gapWidth: 34, rotationSpeed: 25 },
      physics: { ...c.physics, gravityEnabled: true, gravityX: 0, gravityY: 1 },
      autoStop: 'lastCharacter',
      obstacles: [
        { ...newObstacle('rect', 'ob_plat'), x: 0, y: 60, w: 320, h: 26, angularVelocity: 45, color: '#ffffff' },
        { ...newObstacle('rect', 'ob_plat2'), x: 0, y: -300, w: 420, h: 26, motion: { type: 'linear', ax: 180, ay: 0, period: 3 }, color: '#ffffff' }
      ]
    })
  }
];
