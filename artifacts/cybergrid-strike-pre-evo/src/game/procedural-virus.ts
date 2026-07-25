import type { EnemyBaseElement, EnemyGenome } from './types';

const CACHE_LIMIT = 192;
const spriteCache = new Map<string, HTMLCanvasElement>();
const BASES: EnemyBaseElement[] = [
  'robot', 'insect', 'beast', 'plant', 'crystal', 'golem', 'drone',
  'cephalopod', 'skeleton', 'avian', 'serpent', 'vehicle', 'fungus',
];

function gene(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 91.731) * 43758.5453;
  return value - Math.floor(value);
}

function palette(genome: EnemyGenome, seed: number): [string, string, string, string] {
  const hues: Record<string, number> = {
    scout: 188, bulwark: 42, hunter: 350, swarm: 92,
    regenerator: 142, phase: 276, symbiote: 320, opportunist: 24,
  };
  const hue = (hues[genome.niche] + (gene(seed, 2) - 0.5) * 30 + 360) % 360;
  return [
    `hsl(${hue} 68% 40%)`,
    `hsl(${(hue + 36) % 360} 88% 65%)`,
    `hsl(${hue} 55% 14%)`,
    `hsl(${(hue + 175) % 360} 76% 58%)`,
  ];
}

function poly(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, fill: string, stroke: string): void {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.4;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke: string): void {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function limb(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, width: number, fill: string, stroke: string): void {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [color, w] of [[stroke, width + 2], [fill, width]] as Array<[string, number]>) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  }
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, accent: string, outline: string): void {
  oval(ctx, x, y, 1.7, 1.4, accent, outline);
  ctx.fillStyle = outline; ctx.fillRect(x, y - 0.5, 1, 1);
}

function drawBase(
  ctx: CanvasRenderingContext2D,
  base: EnemyBaseElement,
  seed: number,
  body: string,
  accent: string,
  outline: string,
  secondary: string,
  hybrid = false,
): void {
  const wobble = gene(seed, 21) > 0.5 ? 1 : -1;
  ctx.globalAlpha = hybrid ? 0.88 : 1;

  if (base === 'robot') {
    limb(ctx, [[12, 18], [9, 24], [9, 29]], 3, body, outline);
    limb(ctx, [[19, 18], [22, 24], [23, 29]], 3, body, outline);
    limb(ctx, [[11, 13], [6, 17], [4, 22]], 3, body, outline);
    limb(ctx, [[21, 13], [26, 16], [29, 14]], 3, body, outline);
    poly(ctx, [[10, 9], [22, 9], [24, 20], [8, 20]], body, outline);
    poly(ctx, [[12, 3], [21, 4], [21, 10], [11, 9]], accent, outline);
    ctx.fillStyle = secondary; ctx.fillRect(14, 6, 5, 2);
  } else if (base === 'insect') {
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      limb(ctx, [[13 + i * 2, 14 + side * 2], [9 + i * 3, 16 + side * (5 + i)], [6 + i * 4, 17 + side * 10]], 1.8, body, outline);
    }
    oval(ctx, 17, 17, 7, 8, body, outline); oval(ctx, 10, 15, 4, 5, accent, outline);
    poly(ctx, [[17, 10], [25, 6], [23, 15]], secondary, outline);
    eye(ctx, 8, 14, secondary, outline);
  } else if (base === 'beast') {
    limb(ctx, [[11, 19], [9, 25], [7, 29]], 3.5, body, outline);
    limb(ctx, [[20, 19], [22, 25], [25, 29]], 3.5, body, outline);
    oval(ctx, 15, 17, 9, 6, body, outline); oval(ctx, 24, 13, 5, 5, accent, outline);
    poly(ctx, [[22, 9], [23, 4], [26, 9]], accent, outline);
    poly(ctx, [[26, 9], [29, 6], [28, 12]], accent, outline);
    limb(ctx, [[7, 15], [3, 11], [2, 7 + wobble]], 2, body, outline); eye(ctx, 26, 12, secondary, outline);
  } else if (base === 'plant') {
    limb(ctx, [[16, 27], [15, 19], [16, 10]], 5, body, outline);
    poly(ctx, [[14, 21], [5, 16], [8, 24]], accent, outline);
    poly(ctx, [[17, 17], [27, 11], [24, 21]], accent, outline);
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      oval(ctx, 16 + Math.cos(angle) * 5, 9 + Math.sin(angle) * 4, 4, 2.4, i % 2 ? accent : secondary, outline);
    }
    oval(ctx, 16, 9, 3, 3, body, outline);
    limb(ctx, [[15, 27], [9, 29]], 2, body, outline); limb(ctx, [[17, 27], [24, 29]], 2, body, outline);
  } else if (base === 'crystal') {
    poly(ctx, [[7, 26], [10, 8], [15, 18], [18, 3], [21, 18], [27, 10], [25, 27]], body, outline);
    poly(ctx, [[10, 25], [15, 18], [18, 25]], accent, outline);
    poly(ctx, [[18, 23], [21, 18], [24, 25]], secondary, outline);
  } else if (base === 'golem') {
    limb(ctx, [[10, 15], [5, 20], [4, 26]], 5, body, outline);
    limb(ctx, [[22, 15], [27, 20], [28, 26]], 5, body, outline);
    limb(ctx, [[13, 21], [11, 28]], 5, body, outline); limb(ctx, [[19, 21], [21, 28]], 5, body, outline);
    poly(ctx, [[10, 9], [22, 8], [24, 21], [8, 21]], body, outline);
    poly(ctx, [[12, 3], [21, 4], [23, 10], [10, 9]], accent, outline);
    ctx.strokeStyle = secondary; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(13, 12); ctx.lineTo(17, 15); ctx.lineTo(15, 19); ctx.stroke();
  } else if (base === 'drone') {
    poly(ctx, [[9, 12], [15, 7], [23, 10], [26, 17], [19, 22], [10, 20], [6, 16]], body, outline);
    poly(ctx, [[9, 12], [2, 8], [5, 16]], accent, outline);
    poly(ctx, [[23, 11], [30, 7], [27, 16]], accent, outline);
    oval(ctx, 16, 15, 4, 3, secondary, outline);
    limb(ctx, [[11, 21], [9, 27]], 2.5, body, outline); limb(ctx, [[21, 21], [23, 27]], 2.5, body, outline);
  } else if (base === 'cephalopod') {
    oval(ctx, 16, 10, 8, 7, body, outline);
    for (let i = 0; i < 5; i++) {
      const x = 9 + i * 3.5;
      limb(ctx, [[x, 15], [x + wobble * (i % 2 ? 3 : -3), 22], [x + (i - 2) * 1.5, 29]], 2.5, i % 2 ? accent : body, outline);
    }
    eye(ctx, 13, 9, secondary, outline); eye(ctx, 20, 9, secondary, outline);
  } else if (base === 'skeleton') {
    oval(ctx, 16, 6, 5, 4, accent, outline); eye(ctx, 14, 6, outline, outline); eye(ctx, 18, 6, outline, outline);
    limb(ctx, [[16, 10], [16, 21]], 2, accent, outline);
    for (let y = 12; y < 20; y += 3) limb(ctx, [[11, y], [21, y]], 1.4, accent, outline);
    limb(ctx, [[12, 12], [6, 19], [5, 25]], 2, accent, outline); limb(ctx, [[20, 12], [26, 18], [28, 23]], 2, accent, outline);
    limb(ctx, [[16, 21], [11, 28]], 2.5, accent, outline); limb(ctx, [[16, 21], [22, 28]], 2.5, accent, outline);
  } else if (base === 'avian') {
    poly(ctx, [[13, 12], [4, 5], [7, 17], [2, 23], [14, 19]], body, outline);
    poly(ctx, [[19, 12], [28, 5], [25, 17], [30, 23], [18, 19]], body, outline);
    oval(ctx, 16, 16, 5, 7, accent, outline); oval(ctx, 16, 8, 4, 4, body, outline);
    poly(ctx, [[20, 8], [27, 10], [20, 12]], secondary, outline);
    limb(ctx, [[14, 22], [12, 29]], 2, body, outline); limb(ctx, [[18, 22], [21, 29]], 2, body, outline); eye(ctx, 18, 7, secondary, outline);
  } else if (base === 'serpent') {
    limb(ctx, [[7, 26], [4, 20], [12, 18], [22, 22], [25, 15], [19, 11]], 6, body, outline);
    oval(ctx, 20, 9, 6, 4, accent, outline);
    poly(ctx, [[25, 9], [30, 12], [25, 13]], secondary, outline); eye(ctx, 21, 8, secondary, outline);
  } else if (base === 'vehicle') {
    poly(ctx, [[4, 14], [10, 8], [22, 8], [28, 14], [27, 23], [5, 23]], body, outline);
    poly(ctx, [[11, 8], [14, 4], [21, 4], [23, 9]], accent, outline);
    limb(ctx, [[7, 24], [25, 24]], 5, outline, outline);
    for (let x = 8; x < 26; x += 5) oval(ctx, x, 24, 2, 2, accent, outline);
    ctx.fillStyle = secondary; ctx.fillRect(4, 15, 4, 3);
  } else {
    limb(ctx, [[16, 14], [16, 28]], 5, body, outline);
    oval(ctx, 16, 12, 11, 6, accent, outline);
    poly(ctx, [[7, 11], [11, 4], [15, 10]], body, outline);
    poly(ctx, [[17, 10], [22, 3], [25, 12]], secondary, outline);
    for (const x of [11, 16, 21]) oval(ctx, x, 19, 1.2, 2, secondary, outline);
    limb(ctx, [[15, 27], [10, 29]], 2, body, outline); limb(ctx, [[17, 27], [23, 29]], 2, body, outline);
  }
  ctx.globalAlpha = 1;
}

export function getProceduralVirusSprite(seed: number, genome: EnemyGenome): HTMLCanvasElement {
  const key = `${seed}:${genome.niche}:${genome.baseElement}:${genome.generation}:${genome.fusionLevel}:${genome.mutations.join(',')}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; ctx.scale(2, 2);
  const [body, accent, outline, secondary] = palette(genome, seed);

  drawBase(ctx, genome.baseElement, seed, body, accent, outline, secondary);

  // Fusion contributes a recognizable, attached anatomical region from a second
  // species instead of laying two complete sprites over one another.
  if (genome.fusionLevel > 0) {
    const donor = BASES[Math.floor(gene(seed, 170) * BASES.length)];
    ctx.save();
    ctx.beginPath();
    const rightSide = gene(seed, 171) > 0.5;
    ctx.rect(rightSide ? 17 : 1, 4, 14, 25);
    ctx.clip();
    ctx.translate(rightSide ? 6 : -6, 2);
    ctx.scale(0.72, 0.72);
    drawBase(ctx, donor, seed + 37, secondary, accent, outline, body, true);
    ctx.restore();
  }

  // Mutations alter structural regions, keeping every feature attached.
  if (genome.mutations.includes('armored')) {
    poly(ctx, [[7, 9], [16, 3], [25, 8], [22, 11], [16, 7], [10, 12]], accent, outline);
  }
  if (genome.mutations.includes('accelerated')) {
    poly(ctx, [[5, 18], [1, 14], [2, 22]], secondary, outline);
    poly(ctx, [[25, 18], [31, 14], [29, 22]], secondary, outline);
  }
  if (genome.mutations.includes('volatile')) {
    ctx.strokeStyle = secondary; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(11, 11); ctx.lineTo(15, 15); ctx.lineTo(12, 21); ctx.moveTo(20, 9); ctx.lineTo(17, 14); ctx.lineTo(22, 19); ctx.stroke();
  }
  if (genome.mutations.includes('resilient')) {
    limb(ctx, [[10, 27], [16, 24], [23, 28]], 2, secondary, outline);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.48)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(9, 7); ctx.lineTo(14, 5); ctx.stroke();

  spriteCache.set(key, canvas);
  if (spriteCache.size > CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  return canvas;
}
