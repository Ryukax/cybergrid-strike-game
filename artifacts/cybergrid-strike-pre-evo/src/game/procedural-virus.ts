import type { EnemyBaseElement, EnemyGenome } from './types';

const CACHE_LIMIT = 192;
const SPRITE_SIZE = 48;
const QUANTIZED_SIZE = 40;
const OUTPUT_WIDTH = 240;
const OUTPUT_HEIGHT = 160;
const spriteCache = new Map<string, HTMLCanvasElement>();
const sourceCache = new Map<EnemyBaseElement, HTMLImageElement>();
const BASES: EnemyBaseElement[] = [
  'robot', 'insect', 'beast', 'plant', 'crystal', 'golem', 'drone',
  'cephalopod', 'skeleton', 'avian', 'serpent', 'vehicle', 'fungus',
  'cyborg', 'mech', 'nanite', 'data-wraith',
  'crab', 'owl', 'fox', 'snail', 'fish', 'mole', 'turret',
];
const CHARACTER_BASES = new Set<EnemyBaseElement>(['crab', 'owl', 'fox', 'snail', 'fish', 'mole', 'turret']);

type BodyType =
  | 'biped' | 'quadruped' | 'arthropod' | 'flier'
  | 'hover' | 'serpentine' | 'tentacled' | 'rooted'
  | 'colony' | 'aquatic' | 'burrower' | 'vehicle' | 'fortress' | 'spectral';

const BODY_TYPE: Record<EnemyBaseElement, BodyType> = {
  robot: 'biped', skeleton: 'biped', cyborg: 'biped',
  beast: 'quadruped', fox: 'quadruped',
  insect: 'arthropod', crab: 'arthropod',
  avian: 'flier', owl: 'flier',
  drone: 'hover',
  serpent: 'serpentine', snail: 'serpentine',
  cephalopod: 'tentacled',
  plant: 'rooted', fungus: 'colony', nanite: 'colony',
  fish: 'aquatic', mole: 'burrower',
  vehicle: 'vehicle',
  golem: 'fortress', crystal: 'fortress', mech: 'fortress', turret: 'fortress',
  'data-wraith': 'spectral',
};

const COMPATIBLE_HEADS: Record<BodyType, EnemyBaseElement[]> = {
  biped: ['robot', 'skeleton', 'cyborg', 'golem', 'mech', 'owl'],
  quadruped: ['beast', 'fox', 'serpent', 'cyborg', 'owl'],
  arthropod: ['insect', 'crab', 'drone', 'crystal', 'nanite'],
  flier: ['avian', 'owl', 'drone', 'insect', 'data-wraith'],
  hover: ['drone', 'robot', 'nanite', 'crystal', 'data-wraith'],
  serpentine: ['serpent', 'snail', 'cephalopod', 'drone', 'data-wraith'],
  tentacled: ['cephalopod', 'fungus', 'plant', 'nanite', 'data-wraith'],
  rooted: ['plant', 'fungus', 'crystal', 'cephalopod', 'golem'],
  colony: ['fungus', 'nanite', 'plant', 'insect', 'crystal'],
  aquatic: ['fish', 'cephalopod', 'serpent', 'drone', 'crystal'],
  burrower: ['mole', 'beast', 'crab', 'golem', 'cyborg'],
  vehicle: ['vehicle', 'robot', 'drone', 'mech', 'crab'],
  fortress: ['golem', 'crystal', 'mech', 'turret', 'robot', 'crab'],
  spectral: ['data-wraith', 'skeleton', 'cephalopod', 'owl', 'nanite'],
};

const COMPATIBLE_LOCOMOTION: Record<BodyType, EnemyBaseElement[]> = {
  biped: ['robot', 'skeleton', 'cyborg', 'golem', 'mech'],
  quadruped: ['beast', 'fox', 'insect', 'cyborg', 'golem'],
  arthropod: ['insect', 'crab', 'nanite', 'vehicle'],
  flier: ['avian', 'owl', 'drone', 'insect'],
  hover: ['drone', 'nanite', 'data-wraith', 'vehicle'],
  serpentine: ['serpent', 'snail', 'cephalopod', 'nanite'],
  tentacled: ['cephalopod', 'plant', 'fungus', 'nanite'],
  rooted: ['plant', 'fungus', 'crystal', 'cephalopod'],
  colony: ['fungus', 'nanite', 'insect', 'plant'],
  aquatic: ['fish', 'serpent', 'cephalopod', 'drone'],
  burrower: ['mole', 'crab', 'beast', 'golem'],
  vehicle: ['vehicle', 'mech', 'drone', 'crab'],
  fortress: ['golem', 'crystal', 'mech', 'turret', 'vehicle'],
  spectral: ['data-wraith', 'skeleton', 'cephalopod', 'nanite'],
};

const BODY_PROFILES: Record<BodyType, Array<[number, number]>> = {
  biped: [[0.82, 1.12], [0.92, 1.06], [0.76, 1.16]],
  quadruped: [[1.18, 0.84], [1.28, 0.78], [1.08, 0.92]],
  arthropod: [[1.24, 0.8], [1.1, 0.9], [1.32, 0.74]],
  flier: [[1.3, 0.82], [1.16, 0.94], [1.38, 0.76]],
  hover: [[1.08, 0.9], [0.94, 1], [1.2, 0.82]],
  serpentine: [[1.22, 0.78], [1.32, 0.72], [1.08, 0.9]],
  tentacled: [[1.04, 1], [0.9, 1.12], [1.16, 0.94]],
  rooted: [[0.92, 1.12], [1.08, 1.02], [0.84, 1.18]],
  colony: [[1.18, 0.9], [1.3, 0.82], [1.04, 1]],
  aquatic: [[1.32, 0.76], [1.2, 0.84], [1.38, 0.7]],
  burrower: [[1.26, 0.78], [1.14, 0.86], [1.34, 0.72]],
  vehicle: [[1.3, 0.76], [1.18, 0.84], [1.36, 0.7]],
  fortress: [[1.08, 1.06], [1.2, 0.96], [0.98, 1.14]],
  spectral: [[0.88, 1.14], [1.02, 1.04], [0.8, 1.2]],
};

const VISUAL_SCALE: Record<EnemyBaseElement, number> = {
  insect: 0.82, drone: 0.86, fungus: 0.9, nanite: 0.94,
  crab: 0.92, owl: 0.9, fox: 0.94, snail: 0.9,
  fish: 1.04, mole: 1.08, turret: 1.16,
  plant: 0.96, skeleton: 0.98, serpent: 1, cephalopod: 1,
  avian: 1.02, robot: 1.04, crystal: 1.06, cyborg: 1.08,
  beast: 1.1, vehicle: 1.13, golem: 1.18, mech: 1.2,
  'data-wraith': 1.05,
};

export function getBaseVisualScale(base: EnemyBaseElement): number {
  return VISUAL_SCALE[base];
}

export interface EntityMotion {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  glow: number;
}

export function getEntityMotion(base: EnemyBaseElement, now: number, seed: number): EntityMotion {
  const phase = seed * 0.173;
  const bodyType = BODY_TYPE[base];
  const wave = (speed: number) => Math.sin(now * speed + phase);
  const pulse = (speed: number) => (Math.sin(now * speed + phase) + 1) / 2;

  if (base === 'crab') {
    return { x: wave(0.012) * 2.2, y: Math.abs(wave(0.024)) * -1.2, scaleX: 1.02, scaleY: 0.98, glow: pulse(0.006) };
  }
  if (base === 'owl') {
    return { x: wave(0.003) * 0.6, y: wave(0.006) * 3.2 - 2, scaleX: 1 + wave(0.012) * 0.025, scaleY: 1 - wave(0.012) * 0.02, glow: pulse(0.008) };
  }
  if (base === 'fox') {
    return { x: wave(0.008) * 1.3, y: -Math.abs(wave(0.008)) * 3, scaleX: 1 + pulse(0.008) * 0.035, scaleY: 0.98, glow: pulse(0.01) };
  }
  if (base === 'snail') {
    return { x: wave(0.002) * 1.4, y: wave(0.004) * 0.45, scaleX: 1 + wave(0.004) * 0.018, scaleY: 1 - wave(0.004) * 0.012, glow: pulse(0.003) };
  }
  if (bodyType === 'aquatic') {
    return { x: wave(0.006) * 2.6, y: wave(0.009) * 1.5, scaleX: 1 + wave(0.01) * 0.025, scaleY: 1 - wave(0.01) * 0.018, glow: pulse(0.007) };
  }
  if (bodyType === 'burrower') {
    return { x: wave(0.013) * 1.4, y: -Math.abs(wave(0.026)) * 0.75, scaleX: 1.02, scaleY: 0.98, glow: pulse(0.009) };
  }
  if (bodyType === 'flier') {
    return { x: wave(0.004) * 0.8, y: wave(0.007) * 3, scaleX: 1 + wave(0.014) * 0.025, scaleY: 1 - wave(0.014) * 0.02, glow: pulse(0.008) };
  }
  if (bodyType === 'hover') {
    return { x: wave(0.005) * 1.2, y: wave(0.009) * 2.2 - 1, scaleX: 1.01, scaleY: 0.99, glow: pulse(0.012) };
  }
  if (bodyType === 'quadruped') {
    return { x: wave(0.009) * 1.1, y: -Math.abs(wave(0.018)) * 1.8, scaleX: 1.015, scaleY: 0.985, glow: pulse(0.005) };
  }
  if (bodyType === 'serpentine') {
    return { x: wave(0.006) * 2.1, y: wave(0.012) * 0.7, scaleX: 1 + wave(0.006) * 0.025, scaleY: 1, glow: pulse(0.007) };
  }
  if (bodyType === 'arthropod') {
    return { x: wave(0.016) * 1.7, y: -Math.abs(wave(0.032)) * 0.9, scaleX: 1.02, scaleY: 0.98, glow: pulse(0.01) };
  }
  if (bodyType === 'tentacled') {
    return { x: wave(0.005) * 1.5, y: wave(0.008) * 1.1, scaleX: 1 + wave(0.01) * 0.025, scaleY: 1 - wave(0.01) * 0.02, glow: pulse(0.006) };
  }
  if (bodyType === 'rooted') {
    return { x: 0, y: wave(0.003) * 0.7, scaleX: 1 - wave(0.003) * 0.018, scaleY: 1 + wave(0.003) * 0.025, glow: pulse(0.004) };
  }
  if (bodyType === 'vehicle') {
    return { x: wave(0.028) * 0.7, y: Math.abs(wave(0.028)) * -0.5, scaleX: 1, scaleY: 1, glow: pulse(0.012) };
  }
  if (bodyType === 'colony') {
    return { x: wave(0.01) * 0.6, y: wave(0.015) * 0.6, scaleX: 1 + wave(0.007) * 0.035, scaleY: 1 - wave(0.007) * 0.025, glow: pulse(0.009) };
  }
  if (bodyType === 'fortress') {
    return { x: wave(0.022) * 0.28, y: -Math.abs(wave(0.011)) * 0.45, scaleX: 1 + wave(0.004) * 0.01, scaleY: 1, glow: pulse(0.004) };
  }
  if (bodyType === 'spectral') {
    return { x: wave(0.004) * 2.4, y: wave(0.006) * 2.1, scaleX: 1 + wave(0.008) * 0.035, scaleY: 1 - wave(0.008) * 0.025, glow: pulse(0.014) };
  }
  return { x: wave(0.007) * 0.45, y: -Math.abs(wave(0.014)) * 1.5, scaleX: 1, scaleY: 1, glow: pulse(0.006) };
}

function gene(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 91.731) * 43758.5453;
  return value - Math.floor(value);
}

function selectDifferent(pool: EnemyBaseElement[], primary: EnemyBaseElement, value: number): EnemyBaseElement {
  const choices = pool.filter((candidate) => candidate !== primary);
  return choices[Math.floor(value * choices.length)] ?? primary;
}

function source(base: EnemyBaseElement, onReady: () => void): HTMLImageElement {
  const cached = sourceCache.get(base);
  if (cached) {
    if (!cached.complete) cached.addEventListener('load', onReady, { once: true });
    return cached;
  }
  const image = new Image();
  image.decoding = 'async';
  image.src = `${import.meta.env.BASE_URL}enemies/${base}.png`;
  image.addEventListener('load', onReady, { once: true });
  sourceCache.set(base, image);
  return image;
}

function ready(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  seed: number,
  genome: EnemyGenome,
): void {
  const bodyType = BODY_TYPE[genome.baseElement];
  const variantPool = CHARACTER_BASES.has(genome.baseElement)
    ? BODY_PROFILES[bodyType].slice(0, 2)
    : BODY_PROFILES[bodyType];
  const [widthProfile, heightProfile] = variantPool[Math.floor(gene(seed, 30) * variantPool.length)];
  const width = 40 * widthProfile;
  const height = 43 * heightProfile;
  const x = (SPRITE_SIZE - width) / 2 + (gene(seed, 33) - 0.5) * 1.5;
  const y = SPRITE_SIZE - height - 1;
  ctx.filter = genomeFilter(genome, seed);
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, x, y, width, height);
  ctx.filter = 'none';
}

function genomeFilter(genome: EnemyGenome, seed: number): string {
  const generationShift = Math.min(18, genome.generation * 5);
  const nicheShift: Record<string, number> = {
    scout: 8, bulwark: -5, hunter: 0, swarm: 12,
    regenerator: 16, phase: 24, symbiote: -18, opportunist: -9,
  };
  const materialOptions = CHARACTER_BASES.has(genome.baseElement) ? [
    'brightness(1)',
    'saturate(0.84) contrast(1.08)',
    'hue-rotate(12deg) saturate(1.06)',
  ] : [
    'brightness(1)',
    'saturate(0.7) contrast(1.14) brightness(0.94)',
    'sepia(0.3) saturate(1.08) brightness(0.92)',
    'saturate(0.58) contrast(1.3) brightness(0.76)',
    'hue-rotate(34deg) saturate(1.24)',
    'saturate(0.5) contrast(1.08) brightness(1.14)',
  ];
  const materialFilter = materialOptions[Math.floor(gene(seed, 205) * materialOptions.length)];
  return [
    `hue-rotate(${(nicheShift[genome.niche] ?? 0) + generationShift}deg)`,
    `saturate(${0.9 + Math.min(0.25, genome.generation * 0.06)})`,
    `contrast(${1.08 + Math.min(0.2, genome.fusionLevel * 0.05)})`,
    materialFilter,
  ].join(' ');
}

type MatrixRegion = 'head' | 'locomotion' | 'flank';

function graftMask(ctx: CanvasRenderingContext2D, seed: number, region: MatrixRegion): void {
  ctx.beginPath();
  if (region === 'head') {
    // Head and shoulders.
    ctx.moveTo(5, 2); ctx.lineTo(45, 2); ctx.lineTo(39, 19);
    ctx.lineTo(27, 17); ctx.lineTo(20, 21); ctx.lineTo(7, 17);
  } else if (region === 'locomotion') {
    // Lower locomotion assembly.
    ctx.moveTo(4, 27); ctx.lineTo(17, 24); ctx.lineTo(25, 28);
    ctx.lineTo(43, 24); ctx.lineTo(47, 47); ctx.lineTo(2, 47);
  } else {
    // A side/flank graft, varied without obscuring the primary silhouette.
    const right = gene(seed, 71) > 0.5;
    if (right) {
      ctx.moveTo(29, 5); ctx.lineTo(47, 3); ctx.lineTo(47, 45);
      ctx.lineTo(27, 43); ctx.lineTo(30, 32); ctx.lineTo(26, 21);
    } else {
      ctx.moveTo(1, 4); ctx.lineTo(18, 6); ctx.lineTo(21, 20);
      ctx.lineTo(17, 31); ctx.lineTo(20, 44); ctx.lineTo(1, 46);
    }
  }
  ctx.closePath();
}

function graft(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  seed: number,
  genome: EnemyGenome,
  region: MatrixRegion,
  alpha: number,
): void {
  if (!ready(image)) return;
  ctx.save();
  graftMask(ctx, seed, region);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.filter = genomeFilter(genome, seed);
  if (region === 'head') {
    // Normalize every donor's head/sensor mass into a shared upper socket.
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight * 0.58, 3, 0, 42, 25);
  } else if (region === 'locomotion') {
    // Feet, roots, wheels, tails and tentacles occupy a stable lower socket.
    const cropY = image.naturalHeight * 0.44;
    ctx.drawImage(image, 0, cropY, image.naturalWidth, image.naturalHeight - cropY, 1, 21, 46, 27);
  } else {
    drawFitted(ctx, image, seed, genome);
  }
  ctx.filter = 'none';
  ctx.restore();
}

function outlineSilhouette(ctx: CanvasRenderingContext2D): void {
  const snapshot = document.createElement('canvas');
  snapshot.width = SPRITE_SIZE; snapshot.height = SPRITE_SIZE;
  snapshot.getContext('2d')!.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.globalAlpha = 0.72;
  ctx.filter = 'brightness(0.12) saturate(0.4)';
  for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
    ctx.drawImage(snapshot, x, y);
  }
  ctx.restore();
}

function shadeStructure(ctx: CanvasRenderingContext2D, seed: number, genome: EnemyGenome): void {
  // All overlays are clipped to existing opaque anatomy.
  ctx.globalCompositeOperation = 'source-atop';

  const shadow = ctx.createLinearGradient(0, 5, 45, 44);
  shadow.addColorStop(0, 'rgba(255,255,255,0.10)');
  shadow.addColorStop(0.52, 'rgba(0,0,0,0)');
  shadow.addColorStop(1, 'rgba(0,5,18,0.30)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  if (genome.mutations.includes('armored')) {
    ctx.fillStyle = 'rgba(8,14,24,0.28)';
    for (let i = 0; i < 3; i++) {
      const x = 8 + gene(seed, 90 + i) * 23;
      const y = 8 + i * 9;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 2); ctx.lineTo(x + 11, y + 4);
      ctx.lineTo(x + 4, y + 7); ctx.closePath(); ctx.fill();
    }
  }
  if (genome.mutations.includes('volatile')) {
    ctx.strokeStyle = 'rgba(255,116,45,0.82)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(13, 8); ctx.lineTo(18, 16); ctx.lineTo(15, 24);
    ctx.moveTo(31, 11); ctx.lineTo(26, 20); ctx.lineTo(32, 29);
    ctx.stroke();
  }
  if (genome.mutations.includes('resilient')) {
    ctx.fillStyle = 'rgba(70,210,130,0.13)';
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }
  if (genome.mutations.includes('accelerated')) {
    ctx.fillStyle = 'rgba(92,220,255,0.35)';
    ctx.fillRect(4, 34, 15, 1);
    ctx.fillRect(1, 38, 20, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function render(canvas: HTMLCanvasElement, seed: number, genome: EnemyGenome): void {
  const stage = document.createElement('canvas');
  stage.width = SPRITE_SIZE;
  stage.height = SPRITE_SIZE;
  const ctx = stage.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;

  const primary = source(genome.baseElement, () => render(canvas, seed, genome));
  // Composition matrix: 13 chassis × 13 head/sensor sets × 10 locomotion
  // sets × 13 fusion flanks, before niche, generation, scale and mutations.
  const bodyType = BODY_TYPE[genome.baseElement];
  const headBase = selectDifferent(COMPATIBLE_HEADS[bodyType], genome.baseElement, gene(seed, 160));
  const locomotionBase = selectDifferent(COMPATIBLE_LOCOMOTION[bodyType], genome.baseElement, gene(seed, 165));
  const fusionPool = BASES.filter((base) => !CHARACTER_BASES.has(base) && BODY_TYPE[base] !== bodyType);
  const flankBase = fusionPool[Math.floor(gene(seed, 170) * fusionPool.length)] ?? genome.baseElement;
  const head = source(headBase, () => render(canvas, seed, genome));
  const locomotion = source(locomotionBase, () => render(canvas, seed, genome));
  const flank = source(flankBase, () => render(canvas, seed, genome));
  const isAdapted = genome.generation > 0 || gene(seed, 180) < 0.24;

  if (!ready(primary)) return;

  ctx.save();
  if (genome.mutations.includes('accelerated')) {
    ctx.translate(-1.5, 1);
    ctx.scale(1.07, 0.96);
  }
  drawFitted(ctx, primary, seed, genome);
  ctx.restore();

  // Every genome may express a distinct head and locomotion package. The
  // deterministic thresholds preserve some pure base organisms in the ecology.
  const adaptHead = genome.niche === 'hunter' || genome.niche === 'phase'
    || genome.niche === 'opportunist' || gene(seed, 181) > 0.5;
  if (genome.fusionLevel === 0 && isAdapted && adaptHead) {
    graft(ctx, head, seed + 31, genome, 'head', 0.96);
  }
  if (genome.fusionLevel === 0 && isAdapted && !adaptHead) {
    graft(ctx, locomotion, seed + 37, genome, 'locomotion', 0.94);
  }
  if (genome.fusionLevel > 0 && flankBase !== genome.baseElement) {
    graft(ctx, flank, seed + 41, genome, 'flank', 0.9);

    // A restrained seam makes the graft read as connected engineered anatomy.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(128,235,255,0.48)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(24, 8); ctx.lineTo(22, 20); ctx.lineTo(26, 31); ctx.lineTo(23, 42);
    ctx.stroke();
    ctx.restore();
  }

  shadeStructure(ctx, seed, genome);
  outlineSilhouette(ctx);

  // Preserve facial/mechanical definition while retaining intentional pixel art.
  const low = document.createElement('canvas');
  low.width = QUANTIZED_SIZE; low.height = QUANTIZED_SIZE;
  const lowCtx = low.getContext('2d')!;
  lowCtx.imageSmoothingEnabled = true;
  lowCtx.drawImage(stage, 0, 0, QUANTIZED_SIZE, QUANTIZED_SIZE);
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, QUANTIZED_SIZE, QUANTIZED_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // Final sprites use a true 3:2, 240×160 surface. The square anatomical stage
  // remains undistorted in the center while the side field accommodates wings,
  // tails, weapons and later fusion extensions.
  const output = canvas.getContext('2d')!;
  output.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  output.imageSmoothingEnabled = false;
  output.drawImage(stage, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 40, 0, 160, 160);
}

export function getProceduralVirusSprite(seed: number, genome: EnemyGenome): HTMLCanvasElement {
  const key = `${seed}:${genome.niche}:${genome.baseElement}:${genome.generation}:${genome.fusionLevel}:${genome.mutations.join(',')}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  render(canvas, seed, genome);
  spriteCache.set(key, canvas);
  if (spriteCache.size > CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  return canvas;
}
