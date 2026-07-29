import type { GameState, BoardMetrics, Enemy, EnemyGenome } from './types';
import { drawVirus } from './virus-morphology';
import type { EntityDrawContext } from './virus-morphology';
import { getBaseVisualScale, getEntityMotion, getProceduralVirusSprite } from './procedural-virus';
import { ENEMY_ABILITY_WINDUP } from './constants';

const NICHE_COLORS: Record<string, string> = {
  scout: '#67e8f9',
  bulwark: '#fbbf24',
  hunter: '#fb7185',
  swarm: '#a3e635',
  regenerator: '#4ade80',
  phase: '#c084fc',
  symbiote: '#f472b6',
  opportunist: '#fb923c',
};

// Combat value is intentionally coarse and repeats frequently. Give every
// spawned object a stable visual identity so repeated values and formations do
// not repeatedly select the same donor head, chassis, and locomotion sockets.
const enemyVisualIdentity = new WeakMap<Enemy, number>();
let nextEnemyVisualIdentity = 1;

function getEnemyVisualSeed(enemy: Enemy): number {
  const existing = enemyVisualIdentity.get(enemy);
  if (existing !== undefined) return existing;
  const identity = nextEnemyVisualIdentity++;
  const seed = (enemy.value ?? 6) * 131
    + (enemy.formationId ?? 0) * 257
    + identity * 104729;
  enemyVisualIdentity.set(enemy, seed);
  return seed;
}

function visualGene(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 91.731) * 43758.5453;
  return value - Math.floor(value);
}

function drawGeneratedAppendages(
  ctx: CanvasRenderingContext2D,
  seed: number,
  radius: number,
  color: string,
): void {
  const count = 2 + Math.floor(visualGene(seed, 30) * 6);
  const mode = Math.floor(visualGene(seed, 31) * 4);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.72;
  ctx.lineCap = 'round';
  for (let index = 0; index < count; index++) {
    const baseAngle = (index / count) * Math.PI * 2;
    const angle = baseAngle + (visualGene(seed, 40 + index) - 0.5) * 0.38;
    const inner = radius * (0.2 + visualGene(seed, 60 + index) * 0.08);
    const length = radius * (0.18 + visualGene(seed, 80 + index) * 0.32);
    const x1 = Math.cos(angle) * inner;
    const y1 = Math.sin(angle) * inner;
    const x2 = Math.cos(angle) * (inner + length);
    const y2 = Math.sin(angle) * (inner + length);
    ctx.lineWidth = 1.2 + visualGene(seed, 100 + index) * 2.2;
    if (mode === 0) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(
        x1 + (visualGene(seed, 120 + index) - 0.5) * radius * 0.35,
        y1 + (visualGene(seed, 140 + index) - 0.5) * radius * 0.35,
        x2,
        y2,
      );
      ctx.stroke();
    } else if (mode === 1) {
      const wing = 2 + visualGene(seed, 160 + index) * 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - Math.sin(angle) * wing, y2 + Math.cos(angle) * wing);
      ctx.lineTo(x2 + Math.sin(angle) * wing, y2 - Math.cos(angle) * wing);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (mode === 3) {
        ctx.beginPath();
        ctx.arc(x2, y2, 1.5 + visualGene(seed, 180 + index) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawModularEntity(
  ctx: CanvasRenderingContext2D,
  seed: number,
  cell: number,
  accent: string,
  flash: boolean,
  now: number,
  hpFrac: number,
): void {
  const topology = Math.floor(visualGene(seed, 200) * 8);
  const complexity = 3 + Math.floor(visualGene(seed, 201) * 7);
  const radius = cell * (0.19 + visualGene(seed, 202) * 0.1);
  const pulse = 1 + Math.sin(now * (0.0014 + visualGene(seed, 203) * 0.0018) + seed) * 0.045;
  const hue = Math.floor(visualGene(seed, 204) * 360);
  const fill = flash ? '#fff' : `hsl(${hue} 72% ${42 + Math.floor(visualGene(seed, 205) * 24)}%)`;
  const secondary = `hsl(${(hue + 55 + Math.floor(visualGene(seed, 206) * 120)) % 360} 78% 64%)`;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.shadowColor = accent;
  ctx.shadowBlur = 7 + visualGene(seed, 207) * 9;
  ctx.fillStyle = fill;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.2 + visualGene(seed, 208) * 1.8;

  if (topology === 0 || topology === 6) {
    ctx.beginPath();
    for (let point = 0; point < complexity; point++) {
      const angle = point / complexity * Math.PI * 2;
      const noise = topology === 6 ? 0.55 + visualGene(seed, 220 + point) * 0.75 : 0.82 + visualGene(seed, 220 + point) * 0.28;
      const x = Math.cos(angle) * radius * noise;
      const y = Math.sin(angle) * radius * noise;
      if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (topology === 1) {
    const lobes = 2 + Math.floor(visualGene(seed, 240) * 6);
    for (let lobe = 0; lobe < lobes; lobe++) {
      const angle = lobe / lobes * Math.PI * 2;
      const distance = radius * (0.25 + visualGene(seed, 250 + lobe) * 0.3);
      const size = radius * (0.35 + visualGene(seed, 260 + lobe) * 0.35);
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * distance, Math.sin(angle) * distance, size, size * (0.6 + visualGene(seed, 270 + lobe) * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (topology === 2) {
    const segments = 3 + Math.floor(visualGene(seed, 280) * 5);
    for (let segment = 0; segment < segments; segment++) {
      const x = (segment - (segments - 1) / 2) * radius * 0.48;
      const y = Math.sin(segment * 1.7 + seed) * radius * 0.2;
      const size = radius * (0.34 + visualGene(seed, 290 + segment) * 0.2);
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (topology === 3) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.arc(0, 0, radius * (0.35 + visualGene(seed, 310) * 0.28), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.stroke();
  } else if (topology === 4) {
    const shards = 3 + Math.floor(visualGene(seed, 320) * 6);
    for (let shard = 0; shard < shards; shard++) {
      const angle = shard / shards * Math.PI * 2;
      const length = radius * (0.65 + visualGene(seed, 330 + shard) * 0.8);
      const width = radius * (0.12 + visualGene(seed, 340 + shard) * 0.24);
      ctx.beginPath();
      ctx.moveTo(-Math.sin(angle) * width, Math.cos(angle) * width);
      ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      ctx.lineTo(Math.sin(angle) * width, -Math.cos(angle) * width);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (topology === 5) {
    const gap = radius * (0.24 + visualGene(seed, 350) * 0.3);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * gap, 0, radius * 0.62, radius * (0.55 + visualGene(seed, 351) * 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    const arms = 3 + Math.floor(visualGene(seed, 360) * 6);
    for (let arm = 0; arm < arms; arm++) {
      const angle = arm / arms * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle - 0.22) * radius * 0.38, Math.sin(angle - 0.22) * radius * 0.38);
      ctx.lineTo(Math.cos(angle) * radius * (0.9 + visualGene(seed, 370 + arm) * 0.55), Math.sin(angle) * radius * (0.9 + visualGene(seed, 370 + arm) * 0.55));
      ctx.lineTo(Math.cos(angle + 0.22) * radius * 0.38, Math.sin(angle + 0.22) * radius * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
  const coreMode = Math.floor(visualGene(seed, 390) * 5);
  ctx.fillStyle = secondary;
  if (coreMode === 0) {
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (coreMode === 1) {
    ctx.fillRect(-radius * 0.26, -radius * 0.26, radius * 0.52, radius * 0.52);
  } else if (coreMode === 2) {
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.38); ctx.lineTo(radius * 0.34, radius * 0.28); ctx.lineTo(-radius * 0.34, radius * 0.28); ctx.closePath(); ctx.fill();
  } else if (coreMode === 3) {
    const eyes = 2 + Math.floor(visualGene(seed, 391) * 4);
    for (let eye = 0; eye < eyes; eye++) {
      const angle = eye / eyes * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(angle) * radius * 0.32, Math.sin(angle) * radius * 0.32, radius * 0.1, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = secondary;
    ctx.lineWidth = radius * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 1.5); ctx.stroke();
  }
  if (hpFrac < 0.5) {
    ctx.globalAlpha = 0.35 + hpFrac;
  }
  ctx.restore();
}

function drawCrossoverModules(
  ctx: CanvasRenderingContext2D,
  seed: number,
  radius: number,
  primary: number,
  color: string,
  now: number,
): void {
  const moduleCount = 1 + Math.floor(visualGene(seed, 700) * 3);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, radius * 0.075);
  ctx.globalAlpha = 0.84;
  for (let slot = 0; slot < moduleCount; slot++) {
    let module = Math.floor(visualGene(seed, 710 + slot) * 8);
    if (module === primary) module = (module + 1 + slot) % 8;
    const scale = 0.72 + visualGene(seed, 720 + slot) * 0.5;
    if (module === 0) {
      // Machine sensor package.
      ctx.strokeRect(-radius * 0.24 * scale, -radius * 0.3, radius * 0.48 * scale, radius * 0.22);
      ctx.beginPath(); ctx.moveTo(0, -radius * 0.3); ctx.lineTo(0, -radius * 0.62 * scale); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -radius * 0.7 * scale, radius * 0.08, 0, Math.PI * 2); ctx.fill();
    } else if (module === 1) {
      // Insect wings.
      ctx.globalAlpha = 0.34;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(radius * 0.18, side * radius * 0.48, radius * 0.52 * scale, radius * 0.18, side * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 0.84;
    } else if (module === 2) {
      // Beast horns and tail.
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(-radius * 0.34, side * radius * 0.22); ctx.lineTo(-radius * 0.72 * scale, side * radius * 0.55); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(radius * 0.42, 0); ctx.quadraticCurveTo(radius * scale, -radius * 0.5, radius * 1.15 * scale, 0); ctx.stroke();
    } else if (module === 3) {
      // Leaves and root filaments.
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(side * radius * 0.5, radius * 0.16, radius * 0.34 * scale, radius * 0.13, side * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(side * radius * 0.18, radius * 0.38); ctx.quadraticCurveTo(side * radius * 0.5, radius * 0.72, side * radius * 0.82, radius * 0.9); ctx.stroke();
      }
    } else if (module === 4) {
      // Crystal armor growths.
      const shards = 2 + Math.floor(visualGene(seed, 730 + slot) * 4);
      for (let shard = 0; shard < shards; shard++) {
        const angle = -Math.PI * 0.85 + shard / Math.max(1, shards - 1) * Math.PI * 0.7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * radius * 0.35, Math.sin(angle) * radius * 0.35);
        ctx.lineTo(Math.cos(angle) * radius * (0.8 + scale * 0.32), Math.sin(angle) * radius * (0.8 + scale * 0.32));
        ctx.lineTo(Math.cos(angle + 0.18) * radius * 0.38, Math.sin(angle + 0.18) * radius * 0.38);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (module === 5) {
      // Drone rotors or thrusters.
      for (const side of [-1, 1]) {
        const x = side * radius * 0.78 * scale;
        ctx.beginPath(); ctx.moveTo(side * radius * 0.3, 0); ctx.lineTo(x, 0); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, 0, radius * 0.3, radius * 0.07, now * 0.018, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (module === 6) {
      // Cephalopod tendrils.
      const tendrils = 2 + Math.floor(visualGene(seed, 740 + slot) * 4);
      for (let tendril = 0; tendril < tendrils; tendril++) {
        const x = (tendril - (tendrils - 1) / 2) * radius * 0.22;
        ctx.beginPath(); ctx.moveTo(x, radius * 0.3); ctx.quadraticCurveTo(x + Math.sin(now * 0.006 + tendril) * radius * 0.3, radius * 0.72, x + radius * (visualGene(seed, 750 + tendril) - 0.5), radius * scale); ctx.stroke();
      }
    } else {
      // Skeletal ribs and external spine.
      ctx.beginPath(); ctx.moveTo(-radius * 0.52, 0); ctx.lineTo(radius * 0.52, 0); ctx.stroke();
      for (let rib = 0; rib < 3; rib++) {
        const y = -radius * 0.26 + rib * radius * 0.26;
        ctx.beginPath(); ctx.arc(0, y, radius * (0.3 + rib * 0.07), 0, Math.PI); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawCreatureOrMachine(
  ctx: CanvasRenderingContext2D,
  seed: number,
  cell: number,
  accent: string,
  flash: boolean,
  now: number,
  niche: string,
  genome?: EnemyGenome,
): void {
  const nicheArchetypes: Record<string, number[]> = {
    scout: [6, 1, 2, 9],
    bulwark: [0, 4, 5, 8, 11],
    hunter: [2, 1, 8, 10],
    swarm: [1, 7, 3, 12],
    regenerator: [3, 7, 2, 12],
    phase: [8, 6, 7, 10],
    symbiote: [7, 3, 4, 5, 12],
    opportunist: [0, 6, 2, 11],
  };
  const palette: Record<string, [number, number, number]> = {
    scout: [188, 82, 58],
    bulwark: [42, 64, 42],
    hunter: [350, 76, 46],
    swarm: [88, 70, 44],
    regenerator: [142, 58, 40],
    phase: [274, 72, 62],
    symbiote: [322, 68, 54],
    opportunist: [24, 78, 48],
  };
  const pool = nicheArchetypes[niche] ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const baseElementIds: Record<string, number> = {
    robot: 0, insect: 1, beast: 2, plant: 3, crystal: 4, golem: 5,
    drone: 6, cephalopod: 7, skeleton: 8, avian: 9, serpent: 10,
    vehicle: 11, fungus: 12,
  };
  const archetype = genome?.baseElement
    ? baseElementIds[genome.baseElement]
    : pool[Math.floor(visualGene(seed, 500) * pool.length)];
  const r = cell * (0.3 + visualGene(seed, 501) * 0.075);
  const [baseHue, saturation, lightness] = palette[niche] ?? [Math.floor(visualGene(seed, 502) * 360), 68, 48];
  const hue = (baseHue + (visualGene(seed, 502) - 0.5) * 28 + 360) % 360;
  const body = flash ? '#fff' : `hsl(${hue} ${saturation}% ${lightness + Math.floor(visualGene(seed, 503) * 12)}%)`;
  const detail = flash ? '#fff' : `hsl(${(hue + 38 + visualGene(seed, 504) * 34) % 360} ${Math.min(96, saturation + 12)}% ${Math.min(82, lightness + 28)}%)`;
  const gait = Math.sin(now * 0.007 + seed) * r * 0.08;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = niche === 'phase' ? accent : '#0f172a';
  ctx.fillStyle = body;
  ctx.lineWidth = niche === 'bulwark' ? Math.max(2.5, r * 0.16) : niche === 'scout' ? Math.max(0.8, r * 0.055) : Math.max(1.2, r * 0.09);
  ctx.shadowColor = accent;
  ctx.shadowBlur = niche === 'phase' ? 7 : 0;
  ctx.globalAlpha = niche === 'phase' ? 0.62 : 1;
  if (niche === 'phase') ctx.setLineDash([4, 3]);
  ctx.fillStyle = 'rgba(2,6,23,0.34)';
  ctx.beginPath(); ctx.ellipse(r * 0.08, r * 0.74, r * 0.72, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = body;

  if (archetype === 0) {
    // Robot: chassis, head, articulated legs, antenna and sensor array.
    const legs = 2 + Math.floor(visualGene(seed, 510) * 3);
    ctx.beginPath(); ctx.roundRect(-r * 0.65, -r * 0.42, r * 1.3, r * 0.85, r * 0.16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = detail;
    ctx.fillRect(-r * 0.45, -r * 0.25, r * 0.28, r * 0.18);
    ctx.fillRect(r * 0.08, -r * 0.25, r * 0.28, r * 0.18);
    for (let leg = 0; leg < legs; leg++) {
      const x = -r * 0.5 + leg * r / Math.max(1, legs - 1);
      ctx.beginPath(); ctx.moveTo(x, r * 0.38); ctx.lineTo(x + (leg % 2 ? gait : -gait), r * 0.78); ctx.lineTo(x - r * 0.16, r); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, -r * 0.42); ctx.lineTo(0, -r * 0.78); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -r * 0.88, r * 0.1, 0, Math.PI * 2); ctx.fill();
  } else if (archetype === 1) {
    // Insect: three body segments, six legs, optional wings and mandibles.
    ctx.beginPath(); ctx.ellipse(r * 0.38, 0, r * 0.48, r * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-r * 0.12, 0, r * 0.34, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 0.52, 0, r * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let leg = 0; leg < 3; leg++) {
      const x = -r * 0.2 + leg * r * 0.3;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x, side * r * 0.18); ctx.lineTo(x - r * 0.08, side * r * 0.58); ctx.lineTo(x + gait, side * r * 0.82); ctx.stroke();
      }
    }
    if (visualGene(seed, 520) > 0.35) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = detail;
      ctx.beginPath(); ctx.ellipse(r * 0.1, -r * 0.38, r * 0.5, r * 0.22, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.38, r * 0.5, r * 0.22, 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (archetype === 2) {
    // Beast: torso, directional head, ears/horns, four legs and tail.
    ctx.beginPath(); ctx.ellipse(r * 0.12, 0, r * 0.72, r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 0.62, -r * 0.08, r * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.arc(-r * 0.72, -r * 0.14, r * 0.08, 0, Math.PI * 2); ctx.fill();
    for (const x of [-r * 0.3, r * 0.42]) for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x, side * r * 0.25); ctx.lineTo(x + gait, side * r * 0.78); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(r * 0.72, -r * 0.04); ctx.quadraticCurveTo(r * 1.15, -r * 0.55, r * 1.28, -r * 0.16); ctx.stroke();
    const horns = visualGene(seed, 530) > 0.5;
    if (horns) {
      ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.3); ctx.lineTo(-r * 0.9, -r * 0.72); ctx.stroke();
    }
  } else if (archetype === 3) {
    // Carnivorous plant: rooted stem, leaves and a toothed trap.
    ctx.beginPath(); ctx.moveTo(0, r * 0.8); ctx.quadraticCurveTo(-r * 0.18, r * 0.2, 0, -r * 0.25); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(side * r * 0.38, r * 0.25, r * 0.35, r * 0.16, side * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, r * 0.72); ctx.lineTo(side * r * 0.48, r); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, -r * 0.38, r * 0.48, Math.PI * 0.12, Math.PI * 0.88); ctx.lineTo(0, -r * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.48, Math.PI * 1.12, Math.PI * 1.88); ctx.lineTo(0, -r * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = detail;
    const teeth = 3 + Math.floor(visualGene(seed, 540) * 4);
    for (let tooth = 0; tooth < teeth; tooth++) ctx.fillRect(-r * 0.3 + tooth * r * 0.6 / Math.max(1, teeth - 1), -r * 0.38, r * 0.05, r * 0.18);
  } else if (archetype === 4) {
    // Crystal: a single mineral growth without implied limbs or creature anatomy.
    const shards = 4 + Math.floor(visualGene(seed, 544) * 4);
    for (let shard = 0; shard < shards; shard++) {
      const angle = -Math.PI * 0.92 + shard / Math.max(1, shards - 1) * Math.PI * 0.84;
      const length = r * (0.55 + visualGene(seed, 545 + shard) * 0.65);
      ctx.beginPath(); ctx.moveTo(-r * 0.22, r * 0.5); ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length); ctx.lineTo(r * 0.22, r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.52); ctx.lineTo(r * 0.18, -r * 0.08); ctx.lineTo(0, r * 0.24); ctx.lineTo(-r * 0.18, -r * 0.08); ctx.closePath(); ctx.fill();
  } else if (archetype === 5) {
    // Golem: a stone construct; material is independent from the crystal element.
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(-r * 0.46, -r * 0.46, r * 0.92, r * 1.02, r * 0.12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-r * 0.3, -r * 0.78, r * 0.6, r * 0.38, r * 0.1); ctx.fill(); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.roundRect(side * r * 0.44 - (side < 0 ? r * 0.34 : 0), -r * 0.34, r * 0.34, r * 0.78, r * 0.1); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(side * r * 0.28 - (side < 0 ? r * 0.28 : 0), r * 0.48, r * 0.28, r * 0.48, r * 0.08); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.62, r * 0.05, 0, Math.PI * 2); ctx.arc(r * 0.12, -r * 0.62, r * 0.05, 0, Math.PI * 2); ctx.fill();
  } else if (archetype === 6) {
    // Machine drone: angular hull, rotors/thrusters and sensor core.
    ctx.beginPath(); ctx.moveTo(-r * 0.72, 0); ctx.lineTo(-r * 0.3, -r * 0.42); ctx.lineTo(r * 0.48, -r * 0.32); ctx.lineTo(r * 0.74, 0); ctx.lineTo(r * 0.48, r * 0.32); ctx.lineTo(-r * 0.3, r * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * r * 0.42, side * r * 0.24); ctx.lineTo(side * r * 0.9, side * r * 0.62); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(side * r * 0.98, side * r * 0.68, r * 0.34, r * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.arc(-r * 0.12, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (archetype === 7) {
    // Cephalopod: mantle, eyes and independently waving tentacles.
    ctx.beginPath(); ctx.ellipse(0, -r * 0.25, r * 0.62, r * 0.58, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const tentacles = 4 + Math.floor(visualGene(seed, 550) * 5);
    for (let tentacle = 0; tentacle < tentacles; tentacle++) {
      const x = -r * 0.5 + tentacle * r / Math.max(1, tentacles - 1);
      ctx.beginPath(); ctx.moveTo(x, r * 0.12); ctx.quadraticCurveTo(x + Math.sin(now * 0.006 + tentacle) * r * 0.25, r * 0.62, x + gait, r); ctx.stroke();
    }
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.3, r * 0.09, 0, Math.PI * 2); ctx.arc(r * 0.25, -r * 0.3, r * 0.09, 0, Math.PI * 2); ctx.fill();
  } else if (archetype === 8) {
    // Skeletal organism: skull, spine, ribs and articulated limbs.
    ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.25); ctx.lineTo(0, r * 0.65); ctx.stroke();
    const ribs = 3 + Math.floor(visualGene(seed, 560) * 4);
    for (let rib = 0; rib < ribs; rib++) {
      const y = -r * 0.12 + rib * r * 0.18;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(-r * 0.55, y - r * 0.08, -r * 0.42, y + r * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(r * 0.55, y - r * 0.08, r * 0.42, y + r * 0.2); ctx.stroke();
    }
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.72, r * 0.12 + gait); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, r * 0.58); ctx.lineTo(side * r * 0.48, r); ctx.stroke();
    }
    ctx.fillStyle = '#06101e';
    ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.58, r * 0.06, 0, Math.PI * 2); ctx.arc(r * 0.1, -r * 0.58, r * 0.06, 0, Math.PI * 2); ctx.fill();
  } else if (archetype === 9) {
    // Avian: feathered body, beak, tail fan and articulated wings.
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 0.52, -r * 0.14, r * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.moveTo(-r * 0.78, -r * 0.12); ctx.lineTo(-r * 1.08, 0); ctx.lineTo(-r * 0.78, r * 0.08); ctx.closePath(); ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-r * 0.05, side * r * 0.18); ctx.quadraticCurveTo(r * 0.3, side * r * (0.72 + gait / r), r * 0.72, side * r * 0.48); ctx.lineTo(r * 0.22, side * r * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (let feather = -1; feather <= 1; feather++) {
      ctx.beginPath(); ctx.moveTo(r * 0.52, feather * r * 0.12); ctx.lineTo(r * 1.0, feather * r * 0.3); ctx.stroke();
    }
  } else if (archetype === 10) {
    // Serpent: articulated body chain, directional head and dorsal fins.
    const segments = 5 + Math.floor(visualGene(seed, 565) * 4);
    for (let segment = segments - 1; segment >= 0; segment--) {
      const x = r * 0.72 - segment * r * 0.3;
      const y = Math.sin(segment * 0.9 + now * 0.004 + seed) * r * 0.24;
      const size = r * (0.2 + (segments - segment) * 0.025);
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (segment % 2 === 0) {
        ctx.fillStyle = detail;
        ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * 0.35, y - size * 1.65); ctx.lineTo(x + size * 0.55, y - size * 0.7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = body;
      }
    }
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.arc(-r * 0.62, -r * 0.08, r * 0.07, 0, Math.PI * 2); ctx.fill();
  } else if (archetype === 11) {
    // Vehicle: locomotion platform; armor is supplied only by mutation/inheritance.
    ctx.beginPath(); ctx.roundRect(-r * 0.72, -r * 0.28, r * 1.44, r * 0.62, r * 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.roundRect(-r * 0.18, -r * 0.58, r * 0.72, r * 0.34, r * 0.1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-r * 0.04, -r * 0.5, r * 0.42, r * 0.2);
    ctx.fillStyle = detail;
    for (const x of [-0.48, 0.42]) {
      ctx.beginPath(); ctx.arc(x * r, r * 0.42, r * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else {
    // Fungal: cap, layered gills, stalk, mycelial roots and spore sacs.
    ctx.beginPath(); ctx.moveTo(-r * 0.66, -r * 0.12); ctx.quadraticCurveTo(0, -r * 0.95, r * 0.66, -r * 0.12); ctx.quadraticCurveTo(0, r * 0.12, -r * 0.66, -r * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.roundRect(-r * 0.2, -r * 0.1, r * 0.4, r * 0.72, r * 0.14); ctx.fill(); ctx.stroke();
    for (let gill = -2; gill <= 2; gill++) {
      ctx.beginPath(); ctx.moveTo(0, -r * 0.08); ctx.lineTo(gill * r * 0.22, -r * 0.3); ctx.stroke();
    }
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, r * 0.58); ctx.quadraticCurveTo(side * r * 0.35, r * 0.8, side * r * 0.72, r * 0.78); ctx.stroke();
      ctx.beginPath(); ctx.arc(side * r * 0.52, r * 0.28, r * 0.12, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath(); ctx.arc(-r * 0.08, -r * 0.08, r * 0.48, Math.PI * 1.08, Math.PI * 1.72); ctx.stroke();
  ctx.fillStyle = detail;
  ctx.strokeStyle = detail;
  ctx.lineWidth = Math.max(1, r * 0.07);
  if (niche === 'bulwark') {
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.arc(side * r * 0.42, -r * 0.12, r * 0.16, Math.PI, Math.PI * 2); ctx.fill();
    }
  } else if (niche === 'regenerator') {
    ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.5);
    ctx.moveTo(0, -r * 0.15); ctx.lineTo(-r * 0.42, -r * 0.38);
    ctx.moveTo(0, r * 0.12); ctx.lineTo(r * 0.45, -r * 0.12); ctx.stroke();
  } else if (niche === 'symbiote') {
    ctx.beginPath(); ctx.arc(-r * 0.35, 0, r * 0.16, 0, Math.PI * 2); ctx.arc(r * 0.35, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.2, 0); ctx.lineTo(r * 0.2, 0); ctx.stroke();
  } else if (niche === 'swarm') {
    for (const [x, y] of [[-0.3, -0.2], [0.2, -0.28], [-0.12, 0.22], [0.34, 0.18]]) {
      ctx.beginPath(); ctx.arc(x * r, y * r, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
  } else if (niche === 'scout') {
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.15); ctx.lineTo(-r * 0.82, 0); ctx.lineTo(-r * 0.55, r * 0.15); ctx.stroke();
  } else if (niche === 'hunter') {
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-r * 0.55, side * r * 0.18); ctx.lineTo(-r * 0.92, side * r * 0.38); ctx.stroke();
    }
  } else if (niche === 'opportunist') {
    ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(0, 0); ctx.lineTo(0, -r * 0.45); ctx.moveTo(0, 0); ctx.lineTo(r * 0.5, r * 0.35); ctx.stroke();
  }
  if (genome) {
    ctx.strokeStyle = detail;
    ctx.fillStyle = detail;
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    if (genome.mutations.includes('armored')) {
      for (let plate = -1; plate <= 1; plate++) {
        const x = plate * r * 0.28;
        ctx.beginPath(); ctx.arc(x, -r * 0.28, r * 0.19, Math.PI, Math.PI * 2); ctx.fill();
      }
    }
    if (genome.mutations.includes('accelerated')) {
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(r * 0.38, side * r * 0.24); ctx.lineTo(r * 0.92, side * r * 0.42); ctx.lineTo(r * 0.62, side * r * 0.05); ctx.closePath(); ctx.fill();
      }
    }
    if (genome.mutations.includes('volatile')) {
      ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.25); ctx.lineTo(-r * 0.08, 0); ctx.lineTo(-r * 0.28, r * 0.34);
      ctx.moveTo(r * 0.08, -r * 0.4); ctx.lineTo(r * 0.22, -r * 0.08); ctx.lineTo(r * 0.5, r * 0.18); ctx.stroke();
    }
    if (genome.mutations.includes('resilient')) {
      ctx.beginPath(); ctx.moveTo(-r * 0.48, r * 0.35); ctx.quadraticCurveTo(-r * 0.1, r * 0.62, r * 0.42, r * 0.38); ctx.stroke();
    }
    const generationLayers = Math.min(3, genome.generation);
    for (let layer = 0; layer < generationLayers; layer++) {
      const x = (layer - (generationLayers - 1) / 2) * r * 0.24;
      ctx.beginPath(); ctx.moveTo(x - r * 0.1, -r * 0.4); ctx.lineTo(x, -r * (0.56 + layer * 0.04)); ctx.lineTo(x + r * 0.1, -r * 0.4); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = niche === 'phase' ? 0.62 : 1;
    if (genome.generation > 0 || genome.fusionLevel > 0) {
      // Inheritance uses base-specific attachment zones, never centered overlays.
      if ([0, 6, 11].includes(archetype)) {
        ctx.beginPath(); ctx.moveTo(0, -r * 0.36); ctx.lineTo(0, -r * 0.72); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -r * 0.8, r * 0.1, 0, Math.PI * 2); ctx.fill();
      } else if ([1, 2, 9, 10].includes(archetype)) {
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(side * r * 0.22, -r * 0.28); ctx.lineTo(side * r * 0.48, -r * 0.62); ctx.lineTo(side * r * 0.56, -r * 0.12); ctx.closePath(); ctx.fill();
        }
      } else if ([3, 7, 12].includes(archetype)) {
        ctx.beginPath(); ctx.moveTo(0, -r * 0.34); ctx.quadraticCurveTo(r * 0.24, -r * 0.62, r * 0.42, -r * 0.5); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(r * 0.48, -r * 0.48, r * 0.14, r * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
      } else {
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(side * r * 0.32, r * 0.2); ctx.quadraticCurveTo(side * r * 0.48, r * 0.5, side * r * 0.7, r * 0.55); ctx.stroke();
        }
      }
    }
    if (genome.fusionLevel > 0) {
      // Fusion is integrated into the body as a paired core and material seam.
      ctx.fillStyle = detail;
      ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.13, 0, Math.PI * 2); ctx.arc(r * 0.2, 0, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.56); ctx.lineTo(0, r * 0.56); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPixelBestiary(
  ctx: CanvasRenderingContext2D,
  seed: number,
  cell: number,
  niche: string,
  flash: boolean,
  now: number,
): void {
  const familyPools: Record<string, number[]> = {
    scout: [1, 2, 5],
    bulwark: [0, 4, 7],
    hunter: [1, 2, 7],
    swarm: [1, 3, 6],
    regenerator: [2, 3, 6],
    phase: [5, 6, 7],
    symbiote: [3, 4, 6],
    opportunist: [0, 2, 5],
  };
  const nicheHues: Record<string, number> = {
    scout: 190, bulwark: 42, hunter: 350, swarm: 92,
    regenerator: 142, phase: 276, symbiote: 320, opportunist: 24,
  };
  const pool = familyPools[niche] ?? [0, 1, 2, 3, 4, 5, 6, 7];
  const family = pool[Math.floor(visualGene(seed, 800) * pool.length)];
  const unit = Math.max(2, Math.round(cell / 18));
  const hue = (nicheHues[niche] ?? 200) + Math.floor((visualGene(seed, 801) - 0.5) * 24);
  const primary = flash ? '#fff' : `hsl(${hue} 68% 48%)`;
  const light = flash ? '#fff' : `hsl(${(hue + 34) % 360} 82% 68%)`;
  const dark = flash ? '#dbeafe' : `hsl(${hue} 58% 24%)`;
  const ink = '#07111f';
  const gait = Math.round(Math.sin(now * 0.008 + seed) * unit);
  const block = (x: number, y: number, w: number, h: number, color = primary) => {
    ctx.fillStyle = ink;
    ctx.fillRect(Math.round(x * unit) - 1, Math.round(y * unit) - 1, Math.round(w * unit) + 2, Math.round(h * unit) + 2);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * unit), Math.round(y * unit), Math.round(w * unit), Math.round(h * unit));
  };
  const pixel = (x: number, y: number, color = light, size = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * unit), Math.round(y * unit), unit * size, unit * size);
  };
  const line = (points: Array<[number, number]>, color = dark, width = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, unit * width);
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(Math.round(x * unit), Math.round(y * unit)) : ctx.moveTo(Math.round(x * unit), Math.round(y * unit)));
    ctx.stroke();
  };

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(-unit * 0.5, -unit * 0.5);

  if (family === 0) {
    // Robot kit: compatible chassis, head, legs/treads and sensor variants.
    const treaded = visualGene(seed, 810) > 0.52;
    block(-4, -2, 8, 5);
    block(-2.5, -5, 5, 3, dark);
    const eyes = 1 + Math.floor(visualGene(seed, 811) * 3);
    for (let eye = 0; eye < eyes; eye++) pixel(-1.5 + eye * 1.5, -4, light);
    block(-5, -1, 1, 3, light); block(4, -1, 1, 3, light);
    if (treaded) {
      block(-4.5, 3, 9, 2, dark);
      for (const x of [-3, -1, 1, 3]) pixel(x, 3.5, light);
    } else {
      for (const x of [-2.5, 2.5]) line([[x, 3], [x, 5 + gait / unit], [x - 1, 6 + gait / unit]], light);
    }
    line([[0, -5], [0, -7]], light); pixel(-0.5, -8, light);
  } else if (family === 1) {
    // Insect kit: segmented body with compatible wings, mandibles and six legs.
    block(-4, -2, 3, 4, dark); block(-1, -2.5, 3, 5); block(2, -2, 3, 4, primary);
    pixel(-4.5, -1, light); pixel(-4.5, 1, light);
    for (const x of [-2, 0, 2]) {
      line([[x, -1], [x - 1, -4], [x - 2, -5]], light);
      line([[x, 1], [x - 1, 4], [x - 2, 5]], light);
    }
    if (visualGene(seed, 812) > 0.3) {
      block(-0.5, -5.5, 4, 2, light);
      block(-0.5, 3.5, 4, 2, light);
    }
    line([[-4, -1], [-6, -3]], light); line([[-4, 1], [-6, 3]], light);
  } else if (family === 2) {
    // Beast kit: torso, directional head, four legs, ears/horns and tail.
    block(-3, -2.5, 7, 5);
    block(-6, -2, 3, 4, dark);
    pixel(-5.5, -1, light);
    const horned = visualGene(seed, 813) > 0.5;
    if (horned) { line([[-5, -2], [-6, -5]], light); line([[-3.5, -2], [-4, -5]], light); }
    else { block(-6, -4, 1.5, 2, light); block(-4.5, -4, 1.5, 2, light); }
    for (const x of [-2, 2.5]) {
      line([[x, 2], [x + gait / unit, 5], [x - 1, 6]], dark);
      line([[x + 1, 2], [x + 1 - gait / unit, 5], [x + 2, 6]], dark);
    }
    line([[4, -1], [6, -3], [7, -1]], light);
  } else if (family === 3) {
    // Plant kit: stem, leaf pairs, roots and one of several trap blossoms.
    line([[0, 5], [0, -1]], dark, 1.5);
    block(-3, -5, 6, 4);
    const jaw = visualGene(seed, 814) > 0.45;
    if (jaw) {
      block(-4, -5, 4, 1.5, light); block(0, -2.5, 4, 1.5, light);
      for (const x of [-3, -1, 1, 3]) pixel(x, -3.5, ink);
    } else {
      for (const [x, y] of [[-4, -5], [3, -5], [-4, -2], [3, -2]]) block(x, y, 2, 2, light);
    }
    block(-4, 0, 3, 1.5, light); block(1, 1.5, 3, 1.5, light);
    for (const x of [-3, 0, 3]) line([[0, 5], [x, 7]], dark);
  } else if (family === 4) {
    // Crystal golem kit: block torso with coherent shard armor and limbs.
    block(-3, -3, 6, 7, dark);
    block(-2, -6, 4, 3, primary);
    pixel(-1.5, -5, light); pixel(0.5, -5, light);
    block(-5, -2, 2, 5, primary); block(3, -2, 2, 5, primary);
    block(-3, 4, 2, 3, primary); block(1, 4, 2, 3, primary);
    for (const x of [-3, 0, 3]) line([[x, -3], [x, -7 - visualGene(seed, 815 + x) * 2]], light, 1.5);
    pixel(-1, -1, light, 2);
  } else if (family === 5) {
    // Drone kit: hull, coherent rotor/thruster locomotion and sensor payload.
    block(-4, -2, 8, 4, dark);
    block(-2, -3, 4, 6, primary);
    pixel(-1.5, -1, light); pixel(0.5, -1, light);
    const rotors = visualGene(seed, 820) > 0.45;
    for (const side of [-1, 1]) {
      line([[side * 4, 0], [side * 6, 0]], light);
      if (rotors) line([[side * 8, -1], [side * 4, -1]], light, 1.5);
      else block(side < 0 ? -8 : 6, -1, 2, 2, light);
    }
    block(-1, 2, 2, 2, light);
  } else if (family === 6) {
    // Cephalopod kit: mantle, eyes and coherent tentacle locomotion.
    block(-3, -5, 6, 6);
    block(-4, -3, 8, 3, primary);
    pixel(-2, -3, light); pixel(1, -3, light);
    const tentacles = 4 + Math.floor(visualGene(seed, 821) * 4);
    for (let tentacle = 0; tentacle < tentacles; tentacle++) {
      const x = -3 + tentacle * 6 / Math.max(1, tentacles - 1);
      line([[x, 1], [x + (tentacle % 2 ? gait : -gait) / unit, 4], [x + (tentacle % 2 ? 1 : -1), 6]], tentacle % 2 ? light : dark);
    }
  } else {
    // Skeleton kit: skull, spine, ribs and articulated limbs.
    block(-2, -6, 4, 3, light);
    pixel(-1.5, -5, ink); pixel(0.5, -5, ink);
    line([[0, -3], [0, 4]], light, 1.5);
    const ribs = 3 + Math.floor(visualGene(seed, 822) * 3);
    for (let rib = 0; rib < ribs; rib++) {
      const y = -2 + rib * 1.3;
      line([[0, y], [-3, y + 1], [0, y + 1]], primary);
      line([[0, y], [3, y + 1], [0, y + 1]], primary);
    }
    line([[0, -1], [-5, 1 + gait / unit]], light); line([[0, -1], [5, 1 - gait / unit]], light);
    line([[0, 4], [-3, 7]], light); line([[0, 4], [3, 7]], light);
  }

  ctx.restore();
}

export function getBoardMetrics(w: number, h: number): BoardMetrics {
  const cell = Math.min(w / 6.8, h / 8.2);
  const boardW = cell * 6;
  const boardH = cell * 3;
  const x = (w - boardW) * 0.5;
  // Portrait needs the grid/card stack high enough to leave a dedicated
  // control lane for Rotate above Skill. Landscape retains its wider spacing.
  const y = Math.max(h * (h > w ? 0.18 : 0.24), 90);
  return { cell, boardW, boardH, x, y };
}

type Ctx2D = CanvasRenderingContext2D & {
  roundRect: (x: number, y: number, w: number, h: number, r: number) => void;
};

const PROJECTILE_EFFECTS: Record<string, { color: string; accent: string; motif: number }> = {
  assembly: { color: '#67e8f9', accent: '#facc15', motif: 0 },
  chrono: { color: '#93c5fd', accent: '#e9d5ff', motif: 1 },
  singularity: { color: '#a78bfa', accent: '#111827', motif: 2 },
  override: { color: '#c084fc', accent: '#22d3ee', motif: 3 },
  architect: { color: '#60a5fa', accent: '#f8fafc', motif: 4 },
  apex: { color: '#84cc16', accent: '#f0abfc', motif: 0 },
  counter: { color: '#f0abfc', accent: '#f8fafc', motif: 1 },
  phase: { color: '#818cf8', accent: '#e9d5ff', motif: 5 },
  phoenix: { color: '#fb923c', accent: '#fde047', motif: 0 },
  rift: { color: '#22d3ee', accent: '#8b5cf6', motif: 2 },
  vector: { color: '#5eead4', accent: '#f8fafc', motif: 5 },
  gridshift: { color: '#38bdf8', accent: '#a7f3d0', motif: 4 },
  resonance: { color: '#f0abfc', accent: '#67e8f9', motif: 1 },
  exchange: { color: '#4ade80', accent: '#f472b6', motif: 3 },
  causality: { color: '#c4b5fd', accent: '#f8fafc', motif: 1 },
  arsenal: { color: '#f59e0b', accent: '#f8fafc', motif: 0 },
  assimilation: { color: '#34d399', accent: '#fb923c', motif: 3 },
  null: { color: '#6366f1', accent: '#030712', motif: 4 },
  polarity: { color: '#38bdf8', accent: '#fb7185', motif: 2 },
  colossus: { color: '#fbbf24', accent: '#94a3b8', motif: 0 },
  predator: { color: '#fb7185', accent: '#f8fafc', motif: 5 },
  orbital: { color: '#fde047', accent: '#60a5fa', motif: 4 },
  hijack: { color: '#c084fc', accent: '#2dd4bf', motif: 3 },
  sovereign: { color: '#f43f5e', accent: '#facc15', motif: 2 },
};

function drawSkinProjectileEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  direction: number,
  skin?: string,
): boolean {
  const config = skin ? PROJECTILE_EFFECTS[skin] : undefined;
  if (!config) return false;
  const sheet = getAdvancedProjectileSheet(skin);
  if (!sheet?.complete || sheet.naturalWidth <= 0) return false;
  const now = performance.now();
  const skinPhase = [...skin].reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.017;
  // A projectile crosses the board in less than the old one-second animation
  // cycle. Combine a faster clock with distance travelled so even short-lived
  // shots visibly traverse every authored pose before impact.
  const travelPhase = (x / Math.max(radius, 1)) * 0.085 * direction;
  const cycle = (
    now * (0.016 + config.motif * 0.00045)
    + travelPhase
    + skinPhase
  ) % (Math.PI * 2);
  // Keep one coherent illustrated source throughout the shot. All animation
  // below is continuous; swapping authored cells made the art read as a flipbook.
  const frame = 0;
  const sourceWidth = sheet.naturalWidth / 4;
  const sourceHeight = sheet.naturalHeight;
  const baseSize = radius * (skin === 'orbital' || skin === 'colossus' ? 7.2 : 6.3);
  const pulse = 1 + Math.sin(cycle) * (config.motif === 2 ? 0.2 : 0.09);
  const stretch = config.motif === 0 ? 1.08 + Math.sin(cycle * 2) * 0.18 : 1;
  const bob = config.motif === 5 ? Math.sin(cycle * 1.5) * radius * 0.9 : 0;
  const jitterX = config.motif === 3 ? Math.sin(cycle * 5) * radius * 0.32 : 0;
  const jitterY = config.motif === 3 ? Math.cos(cycle * 7) * radius * 0.24 : 0;
  const rotation = config.motif === 1
    ? cycle
    : config.motif === 4
      ? cycle * 0.65
      : config.motif === 2
        ? -cycle * 0.45
        : Math.sin(cycle) * 0.08;
  const size = baseSize * pulse;
  const drawFrame = (drawX: number, alpha: number, scale = 1, frameOffset = 0) => {
    const drawFrameIndex = (frame + frameOffset + 4) % 4;
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      sheet,
      drawFrameIndex * sourceWidth,
      0,
      sourceWidth,
      sourceHeight,
      drawX - size * 0.5 * scale,
      -size * 0.5 * scale,
      size * scale,
      size * scale,
    );
  };

  ctx.save();
  ctx.translate(x + jitterX, y + bob + jitterY);
  ctx.scale(direction, 1);
  ctx.rotate(rotation);
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowColor = config.color;
  ctx.shadowBlur = Math.max(4, radius * 2.4);
  ctx.imageSmoothingEnabled = false;

  // Every generated sheet gets readable motion at gameplay scale. Motifs use
  // different physical languages instead of relying on subtle sprite changes.
  if (config.motif === 0 || config.motif === 5) {
    drawFrame(-radius * 2.7, 0.16, 0.68);
    drawFrame(-radius * 1.45, 0.32, 0.82);
  } else if (config.motif === 3) {
    drawFrame(-radius * 0.7, 0.24, 0.9, -1);
  } else if (config.motif === 1) {
    // A counter-rotating exposure of the generated art creates the temporal
    // sweep without drawing generic clock hands or rings over it.
    ctx.save();
    ctx.rotate(-cycle * 1.8);
    drawFrame(0, 0.28, 1.16, -1);
    ctx.restore();
  } else if (config.motif === 2) {
    // The artwork itself contracts inward and blooms back out.
    drawFrame(0, 0.24 + Math.abs(Math.sin(cycle)) * 0.14, 0.55, -1);
    drawFrame(0, 0.18, 1.28, 1);
  } else if (config.motif === 4) {
    // Successive generated construction states lock together as image echoes.
    drawFrame(0, 0.22, 1.22, -1);
    drawFrame(0, 0.3, 0.78, 1);
  }
  ctx.scale(stretch, 1 / Math.sqrt(stretch));
  // The generated artwork itself remains stable while its motion is expressed
  // through continuous rotation, deformation, translation, pulse and exposure.
  ctx.globalCompositeOperation = 'source-over';
  drawFrame(0, 1);
  ctx.restore();
  return true;
}

const advancedProjectileSheets = new Map<string, HTMLImageElement>();
function getAdvancedProjectileSheet(skin: string): HTMLImageElement | null {
  const cached = advancedProjectileSheets.get(skin);
  if (cached) return cached;
  if (typeof Image === 'undefined') return null;
  const sheet = new Image();
  sheet.src = `${import.meta.env.BASE_URL}effects/advanced-projectiles/${skin}.png?v=1`;
  advancedProjectileSheets.set(skin, sheet);
  return sheet;
}


export function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: GameState,
  hasOverlay?: boolean,
  npcHasOverlay?: boolean,
) {
  const nodeIntegrity = state.systemIntegrity?.node ?? 100;
  const corruption = Math.max(0, Math.min(1, (72 - nodeIntegrity) / 72));
  const timeSlice = Math.floor(performance.now() / 180);
  // Opaque base — covers any DOM elements behind the canvas (e.g. keeper img)
  ctx.fillStyle = corruption > 0.55 ? '#090713' : '#06101e';
  ctx.fillRect(0, 0, w, h);

  const m = getBoardMetrics(w, h);
  const splitX = m.x + m.cell * 3;
  const vs = state.gameMode === 'vs';

  // Subtle frame overlay
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(8, 20, 40, 0.16)');
  bg.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Scanlines
  for (let i = 0; i < 28; i++) {
    const yy = (i * 47 + (performance.now() * 0.03)) % (h + 60) - 30;
    ctx.fillStyle = corruption > 0.45
      ? `rgba(244,63,94,${0.025 + corruption * 0.075})`
      : `rgba(56,189,248,${0.035 + (1 - corruption) * 0.025})`;
    ctx.fillRect(0, yy, w, 1);
  }

  // Grid cells
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      const cx = m.x + c * m.cell;
      const cy = m.y + r * m.cell;
      const fractured = corruption > 0.28 && (r * 6 + c + timeSlice) % 7 === 0;
      const fractureX = fractured ? (c % 2 === 0 ? -1 : 1) * corruption * 5 : 0;
      const fractureY = fractured ? (r % 2 === 0 ? 1 : -1) * corruption * 3 : 0;
      const playerSide = c < 3;
      const npcSide = !playerSide && vs;

      // NPC movement remains highlighted; Player movement uses only the avatar animation.
      const npcFlash = npcSide && (3 + state.npc.col) === c && state.npc.row === r;

      if (playerSide) {
        ctx.fillStyle = 'rgba(59,130,246,0.12)';
      } else if (npcFlash) {
        ctx.fillStyle = 'rgba(52,211,153,0.28)';
      } else if (npcSide) {
        ctx.fillStyle = 'rgba(52,211,153,0.10)';
      } else {
        ctx.fillStyle = 'rgba(244,63,94,0.10)';
      }

      ctx.fillRect(cx + 2 + fractureX, cy + 2 + fractureY, m.cell - 4, m.cell - 4);

      if (playerSide) {
        ctx.strokeStyle = 'rgba(125,211,252,0.55)';
      } else if (npcSide) {
        ctx.strokeStyle = 'rgba(52,211,153,0.45)';
      } else {
        ctx.strokeStyle = 'rgba(251,113,133,0.45)';
      }
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 2 + fractureX, cy + 2 + fractureY, m.cell - 4, m.cell - 4);
    }
  }

  // Center divider
  ctx.strokeStyle = 'rgba(253,224,71,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(splitX, m.y + 4);
  ctx.lineTo(splitX, m.y + m.boardH - 4);
  ctx.stroke();

  // Player ghost aura + shield ring
  const playerX = m.x + (state.player.col + 0.5) * m.cell;
  const playerY = m.y + (state.player.row + 0.5) * m.cell;

  if (state.ghostTimer > 0) {
    // Pulsing cyan ghost aura
    const pulse = 0.45 + 0.2 * Math.sin(performance.now() * 0.008);
    ctx.strokeStyle = `rgba(125,211,252,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(playerX, playerY, m.cell * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.shieldCharges > 0) {
    ctx.strokeStyle = 'rgba(134,239,172,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(playerX, playerY, m.cell * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Player body — skipped when a DOM sprite overlay is active
  // Artifex cannons retain their deployment coordinates independently.
  for (const cannon of state.architectCannons) {
    const cannonX = m.x + (cannon.col + 0.5) * m.cell;
    const cannonY = m.y + (cannon.row + 0.5) * m.cell;
    const firing = cannon.fireCooldown > 0.58;
    ctx.save();
    ctx.translate(cannonX, cannonY + m.cell * 0.2);
    ctx.fillStyle = 'rgba(15,23,42,0.94)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = Math.max(1.5, m.cell * 0.025);
    ctx.beginPath();
    (ctx as Ctx2D).roundRect(-m.cell * 0.19, -m.cell * 0.12, m.cell * 0.31, m.cell * 0.24, m.cell * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    (ctx as Ctx2D).roundRect(-m.cell * 0.02, -m.cell * 0.07, m.cell * (firing ? 0.34 : 0.29), m.cell * 0.11, m.cell * 0.025);
    ctx.fill();
    ctx.fillStyle = firing ? '#f8fafc' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(m.cell * (firing ? 0.34 : 0.29), -m.cell * 0.015, m.cell * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(96,165,250,0.75)';
    ctx.beginPath();
    ctx.moveTo(-m.cell * 0.13, m.cell * 0.12);
    ctx.lineTo(-m.cell * 0.2, m.cell * 0.23);
    ctx.moveTo(m.cell * 0.05, m.cell * 0.12);
    ctx.lineTo(m.cell * 0.12, m.cell * 0.23);
    ctx.stroke();
    ctx.restore();
  }

  if (!hasOverlay) {
    ctx.globalAlpha = state.ghostTimer > 0 ? 0.4 : 1.0;
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    (ctx as Ctx2D).roundRect(playerX - m.cell * 0.22, playerY - m.cell * 0.26, m.cell * 0.44, m.cell * 0.52, 10);
    ctx.fill();
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(playerX + m.cell * 0.05, playerY - m.cell * 0.06, m.cell * 0.18, m.cell * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(playerX - m.cell * 0.12, playerY - m.cell * 0.16, m.cell * 0.18, m.cell * 0.08);
    ctx.globalAlpha = 1.0;
  }

  // NPC (VS mode only — faces left, green, at col 3+npc.col)
  if (vs) {
    const npcActualCol = 3 + state.npc.col;
    const npcX = m.x + (npcActualCol + 0.5) * m.cell;
    const npcY = m.y + (state.npc.row + 0.5) * m.cell;

    // NPC shield ring
    if (state.npc.shieldCharges > 0) {
      ctx.strokeStyle = 'rgba(134,239,172,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(npcX, npcY, m.cell * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!npcHasOverlay) {
      // NPC body (mirror of player, gun faces LEFT)
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      (ctx as Ctx2D).roundRect(npcX - m.cell * 0.22, npcY - m.cell * 0.26, m.cell * 0.44, m.cell * 0.52, 10);
      ctx.fill();
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(npcX - m.cell * 0.23, npcY - m.cell * 0.06, m.cell * 0.18, m.cell * 0.12); // gun LEFT
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(npcX - m.cell * 0.06, npcY - m.cell * 0.16, m.cell * 0.18, m.cell * 0.08);
    }
  }

  // Player bullets
  for (const b of state.bullets) {
    const bx = m.x + b.colPos * m.cell;
    const by = m.y + (b.row + 0.5) * m.cell;
    const radius = b.big ? m.cell * 0.12 : m.cell * 0.08;
    const direction = Math.sign(b.speed) || 1;
    const attackStyle = b.attackStyle ?? 'physical';
    const skinProjectileDrawn = drawSkinProjectileEffect(ctx, bx, by, radius, direction, b.effectSkin);
    if (!skinProjectileDrawn) {
      ctx.save();
      if (attackStyle === 'melee') {
      // The collision carrier still crosses the lane, but reads as its user
      // advancing through a sword combination rather than as a detached orb.
      const stride = (performance.now() * 0.014 + b.colPos * 1.7) % (Math.PI * 2);
      ctx.translate(bx, by);
      ctx.scale(direction, 1);
      ctx.strokeStyle = b.pierce ? '#e9d5ff' : '#f8fafc';
      ctx.lineWidth = Math.max(2, m.cell * 0.035);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 2.25, -1.05 + Math.sin(stride) * 0.18, 1.05);
      ctx.stroke();
      ctx.strokeStyle = b.pierce ? 'rgba(192,132,252,0.55)' : 'rgba(96,165,250,0.55)';
      ctx.lineWidth *= 2.2;
      ctx.beginPath();
      ctx.arc(-radius * 0.3, 0, radius * 2.65, -0.9, 0.78);
      ctx.stroke();
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(-radius * 1.65, -radius * 0.22, radius * 2.35, radius * 0.44);
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(-radius * 1.2, -radius * 0.65, radius * 0.28, radius * 1.3);
      } else if (attackStyle === 'swarm') {
      ctx.translate(bx, by);
      ctx.scale(direction, 1);
      for (let i = 0; i < 5; i++) {
        const phase = performance.now() * 0.012 + i * 1.7 + b.colPos;
        const x = (i - 2) * radius * 0.72;
        const y = Math.sin(phase) * radius * 1.25;
        ctx.fillStyle = i % 2 ? '#67e8f9' : '#c084fc';
        ctx.beginPath();
        ctx.moveTo(x + radius * 0.6, y);
        ctx.lineTo(x - radius * 0.35, y - radius * 0.42);
        ctx.lineTo(x - radius * 0.35, y + radius * 0.42);
        ctx.closePath();
        ctx.fill();
      }
      } else if (attackStyle === 'temporal') {
      const phase = performance.now() * 0.006;
      ctx.strokeStyle = b.pierce ? '#e9d5ff' : '#93c5fd';
      ctx.lineWidth = Math.max(1.4, radius * 0.24);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 1 - i * 0.25;
        ctx.beginPath();
        ctx.arc(
          bx - direction * i * radius * 1.45,
          by,
          radius * (1.25 + i * 0.22),
          phase + i,
          phase + i + Math.PI * 1.45,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx - radius * 0.15, by - radius * 1.05, radius * 0.3, radius * 1.05);
      ctx.fillRect(bx, by - radius * 0.15, direction * radius * 0.75, radius * 0.3);
      } else if (
      attackStyle === 'gravity' || attackStyle === 'portal'
      || attackStyle === 'vector' || attackStyle === 'grid'
      || attackStyle === 'resonance' || attackStyle === 'polarity'
      ) {
      const spatialColors = {
        gravity: ['#111827', '#a78bfa'],
        portal: ['#312e81', '#22d3ee'],
        vector: ['#0f766e', '#5eead4'],
        grid: ['#172554', '#60a5fa'],
        resonance: ['#4c1d95', '#f0abfc'],
        polarity: ['#be123c', '#38bdf8'],
      } as const;
      const [core, edge] = spatialColors[attackStyle];
      const spin = performance.now() * 0.008 * direction;
      ctx.translate(bx, by);
      ctx.rotate(spin);
      ctx.fillStyle = core;
      ctx.strokeStyle = edge;
      ctx.lineWidth = Math.max(1.5, radius * 0.28);
      ctx.beginPath();
      if (attackStyle === 'grid') {
        ctx.rect(-radius, -radius, radius * 2, radius * 2);
      } else if (attackStyle === 'vector') {
        ctx.moveTo(radius * 1.5, 0);
        ctx.lineTo(-radius, -radius);
        ctx.lineTo(-radius * 0.35, 0);
        ctx.lineTo(-radius, radius);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, radius * 1.25, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 2.05, 0.3, Math.PI * 1.35);
      ctx.stroke();
      } else if (
      attackStyle === 'adaptive' || attackStyle === 'reflective'
      || attackStyle === 'suppression' || attackStyle === 'orbital'
      ) {
      const effectColor = attackStyle === 'suppression' ? '#a5b4fc'
        : attackStyle === 'orbital' ? '#fbbf24'
          : attackStyle === 'reflective' ? '#f0abfc' : '#4ade80';
      ctx.translate(bx, by);
      ctx.scale(direction, 1);
      ctx.strokeStyle = effectColor;
      ctx.fillStyle = attackStyle === 'suppression' ? '#111827' : effectColor;
      ctx.lineWidth = Math.max(1.4, radius * 0.25);
      ctx.beginPath();
      const points = attackStyle === 'adaptive' ? 6 : 4;
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const distance = i % 2 ? radius * 0.7 : radius * 1.55;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (attackStyle === 'orbital') {
        ctx.beginPath();
        ctx.moveTo(0, -radius * 3.2);
        ctx.lineTo(0, radius * 2.2);
        ctx.stroke();
      }
      } else if (attackStyle === 'energy') {
      const pulse = 0.88 + Math.sin(performance.now() * 0.018 + b.colPos) * 0.16;
      const energyRadius = radius * pulse;
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, energyRadius * 2.8);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.22, b.pierce ? '#e879f9' : '#67e8f9');
      glow.addColorStop(1, 'rgba(59,130,246,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, energyRadius * 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = b.pierce ? '#c084fc' : '#22d3ee';
      ctx.lineWidth = Math.max(1.5, radius * 0.3);
      ctx.beginPath();
      ctx.arc(bx, by, energyRadius * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      } else {
      // A compact physical projectile with a metal nose, casing and tracer.
      ctx.translate(bx, by);
      ctx.scale(direction, 1);
      ctx.fillStyle = b.pierce ? '#d8b4fe' : '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(-radius * 1.45, -radius * 0.46, radius * 2.3, radius * 0.92, radius * 0.4);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(radius * 0.85, -radius * 0.46);
      ctx.lineTo(radius * 1.55, 0);
      ctx.lineTo(radius * 0.85, radius * 0.46);
      ctx.closePath();
      ctx.fill();
      }
      ctx.restore();
    }
  }

  // NPC bullets (VS mode — cyan, moving left, trail on right side)
  if (vs) {
    for (const b of state.npcBullets) {
      const bx = m.x + b.colPos * m.cell;
      const by = m.y + (b.row + 0.5) * m.cell;
      const radius = m.cell * 0.08;
      const skinProjectileDrawn = drawSkinProjectileEffect(ctx, bx, by, radius, -1, b.effectSkin);
      if (!skinProjectileDrawn) {
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(103,232,249,0.22)';
        ctx.beginPath();
        ctx.arc(bx + m.cell * 0.09, by, radius * 1.5, 0, Math.PI * 2); // trail on right
        ctx.fill();
      }
    }
  }

  // Red enemies (classic + VS)
  const now = performance.now();

  // Formation links make coordinated squads legible without obscuring morphology.
  const formations = new Map<number, typeof state.enemies>();
  for (const enemy of state.enemies) {
    if (enemy.formationId === undefined || enemy.colPos < -1) continue;
    const members = formations.get(enemy.formationId) ?? [];
    members.push(enemy);
    formations.set(enemy.formationId, members);
  }
  for (const members of formations.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.colPos - b.colPos);
    ctx.save();
    ctx.strokeStyle = 'rgba(251,113,133,0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    members.forEach((enemy, index) => {
      const x = m.x + (enemy.colPos + 0.5) * m.cell;
      const y = m.y + (enemy.row + 0.5) * m.cell;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  for (const e of state.enemies) {
    const ex = m.x + (e.colPos + 0.5) * m.cell;
    const ey = m.y + (e.row + 0.5) * m.cell;
    const ectx: EntityDrawContext = {
      hpFrac: Math.min(1, e.hp / 5),
      row: e.row,
      colPos: e.colPos,
      playerRow: state.player.row,
      playerDist: Math.abs(e.colPos - state.player.col),
    };
    const genome = e.genome;
    const drawCell = m.cell * (genome?.sizeScale ?? 1) * (genome ? getBaseVisualScale(genome.baseElement) : 1);
    // Bodies are assembled from independent procedural modules; no finite base
    // sprite or morphology catalog is used for hostile entities.
    ctx.save();
    ctx.translate(ex, ey);
    if (genome) {
      const visualSeed = getEnemyVisualSeed(e);
      const sprite = getProceduralVirusSprite(visualSeed, genome);
      const motion = getEntityMotion(genome.baseElement, now, visualSeed);
      const spriteWidth = drawCell * 1.48;
      const spriteHeight = drawCell * 0.99;
      ctx.save();
      ctx.translate(motion.x, motion.y);
      ctx.scale(motion.scaleX, motion.scaleY);
      ctx.imageSmoothingEnabled = false;
      // Phase is communicated by its aura, never by making portions of the
      // authored body difficult to see against the board.
      ctx.globalAlpha = 1;
      if (e.flash > 0) ctx.filter = 'brightness(1.8)';
      ctx.shadowColor = genome.niche === 'phase'
        ? `rgba(192, 132, 252, ${0.3 + motion.glow * 0.28})`
        : `rgba(95, 220, 255, ${0.08 + motion.glow * 0.16})`;
      ctx.shadowBlur = genome.niche === 'phase'
        ? 5 + motion.glow * 7
        : 2 + motion.glow * 5;
      ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
      ctx.restore();
    } else {
      drawCreatureOrMachine(
        ctx,
        e.value ?? 6,
        drawCell,
        '#fb7185',
        e.flash > 0,
        now,
        'hunter',
        undefined,
      );
    }
    if ((e.abilityWindup ?? 0) > 0 && e.ability) {
      const telegraphColors = {
        momentumCharge: '#fb923c',
        phaseLeap: '#c084fc',
        mendingPulse: '#4ade80',
        laneShift: '#67e8f9',
        arcArmor: '#facc15',
      };
      const progress = 1 - Math.min(1, (e.abilityWindup ?? 0) / ENEMY_ABILITY_WINDUP);
      const radius = drawCell * (0.45 + progress * 0.08);
      ctx.save();
      ctx.strokeStyle = telegraphColors[e.ability];
      ctx.fillStyle = telegraphColors[e.ability];
      ctx.lineWidth = Math.max(2, m.cell * 0.035);
      ctx.shadowColor = telegraphColors[e.ability];
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.6 + Math.sin(now * 0.025) * 0.22;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      if (e.ability === 'momentumCharge') {
        ctx.moveTo(-radius * 0.3, -radius * 0.3);
        ctx.lineTo(radius * 0.35, 0);
        ctx.lineTo(-radius * 0.3, radius * 0.3);
      } else if (e.ability === 'phaseLeap') {
        ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
      } else if (e.ability === 'mendingPulse') {
        ctx.moveTo(-radius * 0.25, 0); ctx.lineTo(radius * 0.25, 0);
        ctx.moveTo(0, -radius * 0.25); ctx.lineTo(0, radius * 0.25);
      } else if (e.ability === 'laneShift') {
        ctx.moveTo(-radius * 0.3, 0); ctx.lineTo(0, -radius * 0.25); ctx.lineTo(radius * 0.3, 0);
      } else {
        ctx.rect(-radius * 0.22, -radius * 0.22, radius * 0.44, radius * 0.44);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (e.hp > 1) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex - 6, ey - m.cell * 0.43, 12, 3);
    }
  }

  // Green enemies (VS mode — moving right, threatening NPC)
  if (vs) {
    for (const e of state.npcEnemies) {
      const ex = m.x + (e.colPos + 0.5) * m.cell;
      const ey = m.y + (e.row + 0.5) * m.cell;
      const ectxG: EntityDrawContext = {
        hpFrac: Math.min(1, e.hp / 5),
        row: e.row,
        colPos: e.colPos,
        playerRow: state.player.row,
        playerDist: Math.abs(e.colPos - state.player.col),
      };
      drawVirus(ctx, ex, ey, e.value ?? 6, m.cell, e.flash > 0, true, now, ectxG);
      if (e.hp > 1) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 5, ey - m.cell * 0.32, 10, 3);
      }
    }
  }

  // Particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  // Board border
  ctx.strokeStyle = 'rgba(125,211,252,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(m.x, m.y, m.boardW, m.boardH);
}
