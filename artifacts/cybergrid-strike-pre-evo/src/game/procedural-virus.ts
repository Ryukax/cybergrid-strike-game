import type { EnemyBaseElement, EnemyGenome } from './types';

const CACHE_LIMIT = 192;
const SOURCE_SIZE = 256;
const SPRITE_SIZE = 48;
const QUANTIZED_SIZE = 40;
const OUTPUT_WIDTH = 240;
const OUTPUT_HEIGHT = 160;
const spriteCache = new Map<string, HTMLCanvasElement>();
const sourceCache = new Map<EnemyBaseElement, HTMLImageElement>();
const BASES: EnemyBaseElement[] = [
  'robot', 'insect', 'beast', 'plant', 'crystal', 'golem', 'drone',
  'cephalopod', 'skeleton', 'avian', 'serpent', 'vehicle', 'fungus',
];

function gene(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 91.731) * 43758.5453;
  return value - Math.floor(value);
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
  const narrow = 0.91 + gene(seed, 31) * 0.12;
  const tall = 0.92 + gene(seed, 32) * 0.1;
  const width = 45 * narrow;
  const height = 45 * tall;
  const x = (SPRITE_SIZE - width) / 2 + (gene(seed, 33) - 0.5) * 1.5;
  const y = SPRITE_SIZE - height - 1;
  const generationShift = Math.min(18, genome.generation * 5);
  const nicheShift: Record<string, number> = {
    scout: 8, bulwark: -5, hunter: 0, swarm: 12,
    regenerator: 16, phase: 24, symbiote: -18, opportunist: -9,
  };
  ctx.filter = [
    `hue-rotate(${(nicheShift[genome.niche] ?? 0) + generationShift}deg)`,
    `saturate(${0.9 + Math.min(0.25, genome.generation * 0.06)})`,
    `contrast(${1.05 + Math.min(0.18, genome.fusionLevel * 0.05)})`,
  ].join(' ');
  ctx.drawImage(image, 0, 0, SOURCE_SIZE, SOURCE_SIZE, x, y, width, height);
  ctx.filter = 'none';
}

function genomeFilter(genome: EnemyGenome): string {
  const generationShift = Math.min(18, genome.generation * 5);
  const nicheShift: Record<string, number> = {
    scout: 8, bulwark: -5, hunter: 0, swarm: 12,
    regenerator: 16, phase: 24, symbiote: -18, opportunist: -9,
  };
  return [
    `hue-rotate(${(nicheShift[genome.niche] ?? 0) + generationShift}deg)`,
    `saturate(${0.9 + Math.min(0.25, genome.generation * 0.06)})`,
    `contrast(${1.08 + Math.min(0.2, genome.fusionLevel * 0.05)})`,
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
  ctx.filter = genomeFilter(genome);
  if (region === 'head') {
    // Normalize every donor's head/sensor mass into a shared upper socket.
    ctx.drawImage(image, 0, 0, SOURCE_SIZE, 150, 3, 0, 42, 25);
  } else if (region === 'locomotion') {
    // Feet, roots, wheels, tails and tentacles occupy a stable lower socket.
    ctx.drawImage(image, 0, 112, SOURCE_SIZE, 144, 1, 21, 46, 27);
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
  const headPool: EnemyBaseElement[] = [
    'robot', 'insect', 'beast', 'plant', 'crystal', 'golem', 'drone',
    'cephalopod', 'skeleton', 'avian', 'serpent', 'vehicle', 'fungus',
  ];
  const locomotionPool: EnemyBaseElement[] = [
    'robot', 'insect', 'beast', 'plant', 'golem',
    'drone', 'cephalopod', 'avian', 'serpent', 'vehicle',
  ];
  const headBase = headPool[Math.floor(gene(seed, 160) * headPool.length)];
  const locomotionBase = locomotionPool[Math.floor(gene(seed, 165) * locomotionPool.length)];
  const flankBase = BASES[Math.floor(gene(seed, 170) * BASES.length)];
  const head = source(headBase, () => render(canvas, seed, genome));
  const locomotion = source(locomotionBase, () => render(canvas, seed, genome));
  const flank = source(flankBase, () => render(canvas, seed, genome));

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
  if (headBase !== genome.baseElement) {
    graft(ctx, head, seed + 31, genome, 'head', 0.96);
  }
  if (locomotionBase !== genome.baseElement) {
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
