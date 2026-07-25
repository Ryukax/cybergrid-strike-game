import type { EnemyBaseElement, EnemyGenome } from './types';

const CACHE_LIMIT = 192;
const SOURCE_SIZE = 256;
const SPRITE_SIZE = 48;
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

function graftMask(ctx: CanvasRenderingContext2D, seed: number): void {
  const mask = Math.floor(gene(seed, 70) * 4);
  ctx.beginPath();
  if (mask === 0) {
    // Head and shoulders.
    ctx.moveTo(5, 2); ctx.lineTo(45, 2); ctx.lineTo(39, 19);
    ctx.lineTo(27, 17); ctx.lineTo(20, 21); ctx.lineTo(7, 17);
  } else if (mask === 1) {
    // Rear/right anatomy.
    ctx.moveTo(27, 3); ctx.lineTo(47, 3); ctx.lineTo(47, 46);
    ctx.lineTo(25, 46); ctx.lineTo(29, 34); ctx.lineTo(24, 24);
  } else if (mask === 2) {
    // Lower locomotion assembly.
    ctx.moveTo(4, 27); ctx.lineTo(17, 24); ctx.lineTo(25, 28);
    ctx.lineTo(43, 24); ctx.lineTo(47, 47); ctx.lineTo(2, 47);
  } else {
    // Diagonal biomechanical graft.
    ctx.moveTo(31, 1); ctx.lineTo(47, 1); ctx.lineTo(47, 47);
    ctx.lineTo(15, 47); ctx.lineTo(22, 34); ctx.lineTo(20, 22);
  }
  ctx.closePath();
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
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  ctx.imageSmoothingEnabled = true;

  const primary = source(genome.baseElement, () => render(canvas, seed, genome));
  const donorBase = BASES[Math.floor(gene(seed, 170) * BASES.length)];
  const donor = source(donorBase, () => render(canvas, seed, genome));

  if (!ready(primary)) return;

  ctx.save();
  if (genome.mutations.includes('accelerated')) {
    ctx.translate(-1.5, 1);
    ctx.scale(1.07, 0.96);
  }
  drawFitted(ctx, primary, seed, genome);
  ctx.restore();

  if (genome.fusionLevel > 0 && donorBase !== genome.baseElement && ready(donor)) {
    ctx.save();
    graftMask(ctx, seed);
    ctx.clip();
    ctx.globalAlpha = 0.92;
    drawFitted(ctx, donor, seed + 41, genome);
    ctx.restore();

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

  // Quantize through a smaller buffer to retain intentional low-resolution pixel art.
  const low = document.createElement('canvas');
  low.width = 32; low.height = 32;
  const lowCtx = low.getContext('2d')!;
  lowCtx.imageSmoothingEnabled = true;
  lowCtx.drawImage(canvas, 0, 0, 32, 32);
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, 32, 32, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
}

export function getProceduralVirusSprite(seed: number, genome: EnemyGenome): HTMLCanvasElement {
  const key = `${seed}:${genome.niche}:${genome.baseElement}:${genome.generation}:${genome.fusionLevel}:${genome.mutations.join(',')}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  render(canvas, seed, genome);
  spriteCache.set(key, canvas);
  if (spriteCache.size > CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  return canvas;
}
