import type { EnemyGenome } from './types';

const CACHE_LIMIT = 160;
const spriteCache = new Map<string, HTMLCanvasElement>();

function gene(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 91.731) * 43758.5453;
  return value - Math.floor(value);
}

function palette(genome: EnemyGenome, seed: number): [string, string, string] {
  const nicheHue: Record<string, number> = {
    scout: 188, bulwark: 42, hunter: 350, swarm: 92,
    regenerator: 142, phase: 276, symbiote: 320, opportunist: 24,
  };
  const hue = (nicheHue[genome.niche] + (gene(seed, 2) - 0.5) * 34 + 360) % 360;
  return [
    `hsl(${hue} 70% 42%)`,
    `hsl(${(hue + 38) % 360} 84% 66%)`,
    `hsl(${hue} 58% 18%)`,
  ];
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.75, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function polygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, fill: string, stroke: string): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function thickLimb(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  bend: [number, number],
  to: [number, number],
  width: number,
  color: string,
  outline: string,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + 2;
  ctx.beginPath(); ctx.moveTo(...from); ctx.quadraticCurveTo(...bend, ...to); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(...from); ctx.quadraticCurveTo(...bend, ...to); ctx.stroke();
}

export function getProceduralVirusSprite(seed: number, genome: EnemyGenome): HTMLCanvasElement {
  const key = `${seed}:${genome.niche}:${genome.baseElement}:${genome.generation}:${genome.fusionLevel}:${genome.mutations.join(',')}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(2, 2);

  const [body, accent, outline] = palette(genome, seed);
  const plan = Math.floor(gene(seed, 10) * 7);
  const cx = 12;
  const cy = 12;
  const rx = 5 + gene(seed, 11) * 2.8;
  const ry = 4.2 + gene(seed, 12) * 3;

  // Solid locomotion is drawn before the body so attachment points remain hidden.
  const limbCount = plan === 1 ? 4 : plan === 2 ? 0 : 2 + Math.floor(gene(seed, 13) * 4);
  for (let limb = 0; limb < limbCount; limb++) {
    const side = limb % 2 ? 1 : -1;
    const rank = Math.floor(limb / 2);
    const startX = cx - 2 + rank * 2.2;
    const startY = cy + side * ry * 0.55;
    thickLimb(
      ctx,
      [startX, startY],
      [startX + (gene(seed, 30 + limb) - 0.5) * 4, cy + side * (ry + 3)],
      [startX - 2 + gene(seed, 40 + limb) * 4, cy + side * (ry + 5.5)],
      1.8 + gene(seed, 50 + limb) * 1.5,
      body,
      outline,
    );
  }

  if (plan === 0) {
    // Membrane cell: irregular but substantial, not a radial decoration.
    const vertices = 7 + Math.floor(gene(seed, 60) * 5);
    const points: Array<[number, number]> = [];
    for (let point = 0; point < vertices; point++) {
      const angle = point / vertices * Math.PI * 2;
      const noise = 0.78 + gene(seed, 61 + point) * 0.34;
      points.push([cx + Math.cos(angle) * rx * noise, cy + Math.sin(angle) * ry * noise]);
    }
    polygon(ctx, points, body, outline);
  } else if (plan === 1) {
    // Mechanical virus: coherent chassis and embedded ports.
    polygon(ctx, [[5, 9], [9, 5], [17, 6], [20, 10], [18, 17], [9, 19], [5, 15]], body, outline);
    ctx.fillStyle = accent;
    ctx.fillRect(7, 9, 3, 3);
    ctx.fillRect(14, 11, 4, 3);
  } else if (plan === 2) {
    // Crystalline virus: one connected mineral cluster.
    const shards = 4 + Math.floor(gene(seed, 70) * 4);
    for (let shard = 0; shard < shards; shard++) {
      const x = 6 + shard * 12 / Math.max(1, shards - 1);
      const top = 3 + gene(seed, 71 + shard) * 7;
      polygon(ctx, [[x - 3, 18], [x, top], [x + 3, 18]], shard % 2 ? accent : body, outline);
    }
  } else if (plan === 3) {
    // Segmented virus with a thick continuous body.
    const segments = 4 + Math.floor(gene(seed, 80) * 4);
    for (let segment = segments - 1; segment >= 0; segment--) {
      const x = 5 + segment * 14 / Math.max(1, segments - 1);
      const y = cy + Math.sin(segment * 1.2 + seed) * 2;
      circle(ctx, x, y, 2.8 + (segments - segment) * 0.24, segment % 2 ? accent : body, outline);
    }
  } else if (plan === 4) {
    // Colony virus: fused lobes share a central mass.
    circle(ctx, cx, cy, 5.4, body, outline);
    const lobes = 3 + Math.floor(gene(seed, 90) * 4);
    for (let lobe = 0; lobe < lobes; lobe++) {
      const angle = lobe / lobes * Math.PI * 2;
      circle(ctx, cx + Math.cos(angle) * 4.2, cy + Math.sin(angle) * 3.6, 2.7, lobe % 2 ? accent : body, outline);
    }
  } else if (plan === 5) {
    // Vascular virus: seed pod with broad integrated fins.
    circle(ctx, cx, cy, 5.3, body, outline);
    for (const side of [-1, 1]) {
      polygon(ctx, [[cx - 2, cy + side], [cx - 8, cy + side * 5], [cx + 1, cy + side * 3]], accent, outline);
    }
    thickLimb(ctx, [cx + 4, cy], [cx + 8, cy - 2], [cx + 9, cy], 2.5, body, outline);
  } else {
    // Caged core: an energy organism with a solid shell.
    circle(ctx, cx, cy, 6.2, body, outline);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0.2, Math.PI * 1.65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 5, cy - 3); ctx.lineTo(cx + 5, cy + 3); ctx.stroke();
  }

  // Integrated core and surface structure.
  const cores = 1 + (genome.fusionLevel > 0 ? 1 : 0);
  for (let core = 0; core < cores; core++) {
    const x = cx + (core - (cores - 1) / 2) * 4;
    circle(ctx, x, cy - 0.5, 1.5 + gene(seed, 100 + core), accent, outline);
  }

  if (genome.mutations.includes('armored')) {
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 7.2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  }
  if (genome.mutations.includes('accelerated')) {
    polygon(ctx, [[18, 8], [23, 5], [20, 11]], accent, outline);
    polygon(ctx, [[18, 16], [23, 19], [20, 13]], accent, outline);
  }
  if (genome.mutations.includes('volatile')) {
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(11, 11); ctx.lineTo(9, 15); ctx.moveTo(14, 7); ctx.lineTo(13, 11); ctx.lineTo(17, 14); ctx.stroke();
  }
  if (genome.mutations.includes('resilient')) {
    thickLimb(ctx, [8, 16], [12, 20], [17, 18], 1.6, accent, outline);
  }

  // A small top-left highlight gives depth without increasing source resolution.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 4.5, Math.PI * 1.12, Math.PI * 1.62); ctx.stroke();

  spriteCache.set(key, canvas);
  if (spriteCache.size > CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  return canvas;
}
