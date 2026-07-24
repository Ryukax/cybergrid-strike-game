/**
 * CyberGrid Strike — Entity Morphology v5
 *
 * SUBSTRATE-DIVERSE: 9 substrate domains across 14 topology families.
 * Mechanical entities are one family among many; no single domain dominates.
 *
 *   Domain        Slots
 *   MECHANICAL    T0 MONOCOQUE · T1 CHASSIS_FRAME · T7 CRAWLER_BED
 *   BIOLOGICAL    T2 CEPHALOPOD · T4 VERTEBRATE · T6 ARTHROPOD · T12 AVIAN_FLYER
 *   CRYSTALLINE   T5 CRYSTAL_CLUSTER
 *   COLONIAL      T3 FUNGAL_COLONY
 *   ENERGY        T8 ENERGY_FIELD
 *   PLANT/SIEGE   T9 PLANT_SIEGE
 *   SWARM         T10 SWARM_COLLECTIVE
 *   BIOMECH       T11 BIOMECH_HYBRID
 *   ALIEN         T13 ALIEN_ARCH
 *
 * Functional morphology: locomotion, weaponry, defense, sensing, and mass
 * distribution visibly follow each entity's role within its substrate.
 * The same combat role is realizable through multiple substrates.
 *
 * All legacy exports preserved with identical call signatures.
 */

export type VirusClass =
  | 'prime' | 'power-of-two' | 'perfect-square' | 'even-composite' | 'odd-composite';

export type VirusArchetype =
  | 'biological' | 'humanoid' | 'animal' | 'insectoid' | 'mechanical'
  | 'armored' | 'crystalline' | 'mineral' | 'plant' | 'synthetic'
  | 'robotic' | 'amorphous' | 'geometric' | 'energy' | 'cybernetic'
  | 'skeletal' | 'fluid';

export interface VirusModelProfile {
  primaryArchetype: VirusArchetype; secondaryArchetype: VirusArchetype;
  primaryWeight: number; secondaryWeight: number;
  structureLevel: number; symmetryLevel: number; armorLevel: number;
  organicLevel: number; mechanicalLevel: number; crystallineLevel: number; energyLevel: number;
}
export interface VirusVisualModel {
  id: string; archetypes: VirusArchetype[];
  compatibleFeatures: {
    minLobes?: number; maxLobes?: number;
    symmetryRange?: [number, number]; armorRange?: [number, number];
  };
}

// §1  Deterministic hash
function nh(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233 + salt * salt * 0.00371) * 43758.5453;
  return x - Math.floor(x);
}

// §2  Number theory
export function isPrime(n: number): boolean {
  if (n < 2) return false; if (n === 2) return true; if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}
export function isPerfectSquare(n: number): boolean { const s = Math.round(Math.sqrt(n)); return s * s === n; }
export function isPowerOfTwo(n: number): boolean { return n > 0 && (n & (n - 1)) === 0; }
export function getVirusClass(n: number): VirusClass {
  if (isPrime(n)) return 'prime';
  if (isPowerOfTwo(n)) return 'power-of-two';
  if (isPerfectSquare(n)) return 'perfect-square';
  if (n % 2 === 0) return 'even-composite';
  return 'odd-composite';
}
export function getVirusLobes(n: number): number { return 3 + (n % 6); }
export function getVirusSpikes(n: number): boolean[] {
  return Array.from({ length: 8 }, (_, i) => Boolean((n >> i) & 1));
}

// §3  Colours
const FILL_C: Record<VirusClass, string> = {
  prime: '#e879f9', 'power-of-two': '#22d3ee', 'perfect-square': '#fbbf24',
  'even-composite': '#fb7185', 'odd-composite': '#fb923c',
};
const FLASH_C: Record<VirusClass, string> = {
  prime: '#fae8ff', 'power-of-two': '#ecfeff', 'perfect-square': '#fef9c3',
  'even-composite': '#fff1f2', 'odd-composite': '#fff7ed',
};
const GLOW_C: Record<VirusClass, string> = {
  prime: 'rgba(232,121,249,0.55)', 'power-of-two': 'rgba(34,211,238,0.55)',
  'perfect-square': 'rgba(251,191,36,0.55)', 'even-composite': 'rgba(251,113,133,0.45)',
  'odd-composite': 'rgba(251,146,60,0.50)',
};
export function getVirusColors(n: number, flash: boolean): { fill: string; glow: string } {
  const cls = getVirusClass(n);
  return { fill: flash ? FLASH_C[cls] : FILL_C[cls], glow: GLOW_C[cls] };
}

// §4  Topology
const N_TOPO = 14;
export function getTopology(n: number): number {
  return Math.min(N_TOPO - 1, Math.floor(nh(n, 0xBEEF) * N_TOPO));
}
const TV = (n: number) => Math.floor(nh(n, 0xCAFE) * 3);

// §5  Drawing primitives
type Ctx = CanvasRenderingContext2D;
type P2 = [number, number];

function fpoly(ctx: Ctx, pts: P2[], f: string, g: string, a: number, blur = 6): void {
  if (pts.length < 2) return;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
}
function fell(ctx: Ctx, x: number, y: number, rx: number, ry: number, f: string, g: string, a: number, blur = 5): void {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
  ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
}
function fcirc(ctx: Ctx, x: number, y: number, r: number, f: string, g: string, a: number): void {
  fell(ctx, x, y, r, r, f, g, a);
}
function frect(ctx: Ctx, x: number, y: number, w: number, h: number, f: string, g: string, a: number): void {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 5;
  ctx.fillRect(x, y, w, h); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.75; ctx.strokeRect(x, y, w, h); ctx.restore();
}
function sline(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, col: string, a: number, lw = 1.2): void {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
// Machine barrel: extends LEFT from (bx,by)
function gun(ctx: Ctx, bx: number, by: number, len: number, thick: number, f: string, g: string, a: number): void {
  frect(ctx, bx - len, by - thick, len, thick * 2, f, g, a + 0.04);
  fcirc(ctx, bx - len, by, thick * 0.8, f, g, a + 0.06);
}
// Organic stinger/fang: tapered triangle pointing LEFT from (bx,by)
function stinger(ctx: Ctx, bx: number, by: number, len: number, baseW: number, f: string, g: string, a: number): void {
  fpoly(ctx, [[bx, by - baseW], [bx - len, by], [bx, by + baseW]], f, g, a + 0.05, 6);
}

// §6  14 topology drawers — 9 substrate families

// ── MECHANICAL (T0, T1, T7) ───────────────────────────────────────────────────

// T0  MONOCOQUE — smooth pressure hull, panel lines, stern nozzles
function drawT0(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), L = [2.20, 1.85, 2.55][v], H = [0.44, 0.56, 0.36][v];
  ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx - L * R, cy);
  ctx.bezierCurveTo(cx - L * R, cy - H * R * 0.5, cx - H * R * 1.5, cy - H * R, cx, cy - H * R);
  ctx.bezierCurveTo(cx + H * R * 2.0, cy - H * R, cx + L * R * 0.88, cy - H * R * 0.35, cx + L * R, cy);
  ctx.bezierCurveTo(cx + L * R * 0.88, cy + H * R * 0.35, cx + H * R * 2.0, cy + H * R, cx, cy + H * R);
  ctx.bezierCurveTo(cx - H * R * 1.5, cy + H * R, cx - L * R, cy + H * R * 0.5, cx - L * R, cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 0.9; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.6;
  for (let i = 1; i <= 4; i++) { const rx = cx - L * R + i * (L * 2 * R / 5); const hx = H * R * (1 - Math.abs(rx - cx) / (L * R)) * 0.95; ctx.beginPath(); ctx.moveTo(rx, cy - hx); ctx.lineTo(rx, cy + hx); ctx.stroke(); }
  ctx.restore();
  gun(ctx, cx - L * R, cy, R * (0.50 + nh(n, 7) * 0.35), R * 0.065, f, g, A);
  const nN = v === 1 ? 3 : 2;
  for (let i = 0; i < nN; i++) { const ny = cy + (i - (nN - 1) / 2) * R * 0.28; fpoly(ctx, [[cx + L * R, ny - R * 0.07], [cx + L * R + R * 0.28, ny - R * 0.12], [cx + L * R + R * 0.28, ny + R * 0.12], [cx + L * R, ny + R * 0.07]], f, g, A - 0.16, 3); }
}

// T1  CHASSIS_FRAME — exposed structural rails, cross-members, wheel bogies
function drawT1(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), rW = R * 2.0, sep = R * [0.48, 0.62, 0.38][v], rH = R * 0.10, nX = [4, 5, 3][v];
  frect(ctx, cx - rW, cy - sep - rH, rW * 2, rH * 2, f, g, A);
  frect(ctx, cx - rW, cy + sep - rH, rW * 2, rH * 2, f, g, A);
  for (let i = 0; i <= nX; i++) { const rx = cx - rW + i * (rW * 2 / nX); frect(ctx, rx - R * 0.055, cy - sep, R * 0.11, sep * 2, f, g, A - 0.12); }
  fpoly(ctx, [[cx - rW, cy - sep * 1.1], [cx - rW, cy + sep * 1.1], [cx - rW - R * 0.22, cy + sep * 0.6], [cx - rW - R * 0.22, cy - sep * 0.6]], f, g, A + 0.04);
  gun(ctx, cx - rW - R * 0.22, cy, R * 0.80, R * 0.065, f, g, A);
  fpoly(ctx, [[cx + rW, cy - sep * 1.3], [cx + rW + R * 0.40, cy - sep * 0.85], [cx + rW + R * 0.40, cy + sep * 0.85], [cx + rW, cy + sep * 1.3]], f, g, A - 0.06);
  const nM = v === 2 ? 1 : 2;
  for (let i = 0; i < nM; i++) { const bx = cx - rW * 0.50 + i * rW * 0.70; const bh = sep * (0.50 + nh(n, 8 + i) * 0.30); frect(ctx, bx - R * 0.17, cy - bh, R * 0.34, bh * 2, f, g, A - 0.14); }
  for (let i = 0; i < 3; i++) { const wx = cx - rW * 0.68 + i * rW * 0.68; fcirc(ctx, wx, cy + sep + R * 0.26, R * 0.21, f, g, A - 0.16); fcirc(ctx, wx, cy - sep - R * 0.26, R * 0.21, f, g, A - 0.16); }
}

// T7  CRAWLER_BED — wide track bed, hull superstructure, turret gun
function drawT7(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), trkW = R * [2.35, 2.60, 2.10][v], trkH = R * [0.32, 0.40, 0.28][v];
  const hullW = R * [0.75, 0.85, 0.65][v], hullH = R * [0.50, 0.58, 0.42][v];
  fpoly(ctx, [[cx - trkW - R * 0.12, cy - trkH], [cx + trkW + R * 0.12, cy - trkH], [cx + trkW, cy + trkH], [cx - trkW, cy + trkH]], f, g, A - 0.04);
  ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = R * 0.08;
  for (let i = 0; i <= 14; i++) { const tx = cx - trkW + i * (trkW * 2 / 14); ctx.beginPath(); ctx.moveTo(tx, cy - trkH + R * 0.03); ctx.lineTo(tx, cy + trkH - R * 0.03); ctx.stroke(); }
  ctx.restore();
  fcirc(ctx, cx - trkW, cy, trkH * 0.60, f, g, A - 0.06); fcirc(ctx, cx + trkW, cy, trkH * 0.60, f, g, A - 0.06);
  for (const dx of [cx - trkW * 0.50, cx, cx + trkW * 0.50]) fcirc(ctx, dx, cy, trkH * 0.35, f, g, A - 0.20);
  frect(ctx, cx - hullW, cy - trkH - hullH, hullW * 2, hullH, f, g, A + 0.04);
  fell(ctx, cx - hullW * 0.28, cy - trkH - hullH - R * 0.22, R * 0.30, R * 0.20, f, g, A - 0.06);
  gun(ctx, cx - hullW * 0.28 - R * 0.30, cy - trkH - hullH - R * 0.22, R * 0.92, R * 0.065, f, g, A);
}

// ── BIOLOGICAL (T2, T4, T6, T12) ─────────────────────────────────────────────

// T2  CEPHALOPOD — mantle + trailing tentacles, beak weapon, pure curves
function drawT2(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nT = [7, 6, 8][v], mL = R * [1.10, 1.22, 0.96][v], mH = R * [0.74, 0.82, 0.66][v];
  // Tentacles trail rightward (away from weapon tip)
  const tentBase = cx + mL * 0.38;
  for (let i = 0; i < nT; i++) {
    const t = nT > 1 ? i / (nT - 1) : 0.5;
    const ty = cy + (t - 0.5) * mH * 1.85;
    const tLen = R * (0.80 + nh(n, 20 + i) * 0.95);
    const curl = (nh(n, 40 + i) - 0.5) * R * 0.58;
    ctx.save(); ctx.globalAlpha = A - 0.14; ctx.strokeStyle = f;
    ctx.lineWidth = R * Math.max(0.035, 0.085 - i * 0.006); ctx.shadowColor = g; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.moveTo(tentBase, ty);
    ctx.bezierCurveTo(tentBase + tLen * 0.38, ty + curl * 0.55, tentBase + tLen * 0.72, ty + curl, tentBase + tLen, ty + curl * 0.65);
    ctx.stroke(); ctx.restore();
  }
  // Mantle — pointed left (weapon tip), rounded right (tentacle base)
  ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.moveTo(cx - mL, cy);
  ctx.bezierCurveTo(cx - mL * 0.52, cy - mH * 0.58, cx, cy - mH, cx + mL * 0.48, cy - mH);
  ctx.bezierCurveTo(cx + mL * 0.82, cy - mH, cx + mL, cy - mH * 0.42, cx + mL, cy);
  ctx.bezierCurveTo(cx + mL, cy + mH * 0.42, cx + mL * 0.82, cy + mH, cx + mL * 0.48, cy + mH);
  ctx.bezierCurveTo(cx, cy + mH, cx - mL * 0.52, cy + mH * 0.58, cx - mL, cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.85; ctx.stroke(); ctx.restore();
  // Eyes (paired, lateral)
  for (const s of [-1, 1] as const) {
    fcirc(ctx, cx - mL * 0.05, cy + s * mH * 0.48, R * 0.14, 'rgba(255,255,255,0.72)', g, A - 0.04);
    fcirc(ctx, cx - mL * 0.05, cy + s * mH * 0.48, R * 0.07, '#111', g, A + 0.05);
  }
  // Beak weapon at left tip
  stinger(ctx, cx - mL, cy, R * 0.34, R * 0.095, f, g, A);
  // Fin flaps at mantle rear
  for (const s of [-1, 1] as const) fpoly(ctx, [[cx + mL, cy + s * mH * 0.20], [cx + mL + R * 0.28, cy + s * mH * 0.62], [cx + mL + R * 0.12, cy + s * mH * 0.66]], f, g, A - 0.22, 3);
}

// T4  VERTEBRATE — skull + spine + arching ribcage, jaw weapon, haunches
function drawT4(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nRib = [5, 6, 4][v], spL = R * [2.10, 1.90, 2.30][v];
  // Spine
  ctx.save(); ctx.globalAlpha = A - 0.05; ctx.strokeStyle = f; ctx.lineWidth = R * 0.11; ctx.shadowColor = g; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(cx - spL, cy); ctx.lineTo(cx + spL * 0.55, cy); ctx.stroke(); ctx.restore();
  // Ribs — organic arch from spine
  const ribSpanX = spL * 0.78;
  for (let i = 0; i < nRib; i++) {
    const rx = cx - spL * 0.60 + i * (ribSpanX / Math.max(nRib - 1, 1));
    const rH = R * (0.55 + nh(n, 10 + i) * 0.30) * (1 - Math.abs(rx - cx) / (spL * 0.92) * 0.32);
    for (const s of [-1, 1] as const) {
      ctx.save(); ctx.globalAlpha = A - 0.10; ctx.strokeStyle = f; ctx.lineWidth = R * 0.07; ctx.shadowColor = g; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.moveTo(rx, cy);
      ctx.bezierCurveTo(rx + R * 0.12, cy + s * rH * 0.48, rx + R * 0.20, cy + s * rH * 0.86, rx + R * 0.06, cy + s * rH);
      ctx.stroke(); ctx.restore();
    }
  }
  // Skull / head (left, weapon end)
  const hW = R * [0.55, 0.62, 0.50][v], hH = R * [0.38, 0.44, 0.34][v];
  ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx - spL - hW * 0.50, cy);
  ctx.bezierCurveTo(cx - spL - hW * 0.50, cy - hH, cx - spL + hW * 0.80, cy - hH, cx - spL + hW, cy - hH * 0.28);
  ctx.lineTo(cx - spL + hW, cy + hH * 0.28);
  ctx.bezierCurveTo(cx - spL + hW * 0.80, cy + hH, cx - spL - hW * 0.50, cy + hH, cx - spL - hW * 0.50, cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 0.85; ctx.stroke(); ctx.restore();
  // Jaw fang weapon
  stinger(ctx, cx - spL - hW * 0.50, cy, R * 0.42, R * 0.10, f, g, A);
  // Eye socket
  fcirc(ctx, cx - spL - hW * 0.12, cy - hH * 0.28, R * 0.12, 'rgba(255,255,255,0.80)', g, A);
  fcirc(ctx, cx - spL - hW * 0.12, cy - hH * 0.28, R * 0.06, '#111', g, 1.0);
  // Haunches (right, propulsion mass)
  fell(ctx, cx + spL * 0.35, cy, R * 0.44, R * 0.32, f, g, A - 0.12);
  // Tail spike
  fpoly(ctx, [[cx + spL * 0.55, cy - R * 0.08], [cx + spL + R * 0.32, cy], [cx + spL * 0.55, cy + R * 0.08]], f, g, A - 0.18, 3);
}

// T6  ARTHROPOD — chitinous head/thorax/abdomen, 6 legs, mandible weapon
function drawT6(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nPair = [3, 4, 3][v];
  // Abdomen (right, largest segment)
  const abX = cx + R * [0.72, 0.62, 0.82][v], abW = R * [0.72, 0.80, 0.65][v], abH = R * [0.50, 0.58, 0.45][v];
  ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 7;
  ctx.beginPath(); ctx.ellipse(abX, cy, abW, abH, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
  // Abdominal segmentation
  ctx.save(); ctx.globalAlpha = A - 0.38; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.65;
  for (let i = 1; i <= 3; i++) { const sx = abX - abW + i * (abW * 2 / 4); const sh = abH * Math.sqrt(Math.max(0, 1 - Math.pow((sx - abX) / abW, 2))); ctx.beginPath(); ctx.moveTo(sx, cy - sh); ctx.lineTo(sx, cy + sh); ctx.stroke(); }
  ctx.restore();
  // Thorax (center)
  const thX = cx - R * 0.18, thW = R * 0.48, thH = R * 0.36;
  fell(ctx, thX, cy, thW, thH, f, g, A - 0.04);
  // Legs in pairs (from thorax sides)
  const legRoots = [-thH * 0.55, 0, thH * 0.55];
  for (let i = 0; i < Math.min(nPair, 3); i++) {
    for (const s of [-1, 1] as const) {
      const lby = cy + legRoots[i];
      const kx = thX + s * R * 0.18, ky = lby + s * R * 0.55;
      const fx = thX + s * R * 0.42, fy = ky + s * R * 0.36;
      fpoly(ctx, [[thX - R * 0.05, lby], [thX + R * 0.05, lby], [kx + R * 0.05, ky], [kx - R * 0.05, ky]], f, g, A - 0.15);
      fcirc(ctx, kx, ky, R * 0.07, f, g, A - 0.12);
      fpoly(ctx, [[kx - R * 0.04, ky], [kx + R * 0.04, ky], [fx + R * 0.04, fy], [fx - R * 0.04, fy]], f, g, A - 0.20);
    }
  }
  // Head (left) with compound eye
  const hdX = cx - R * 0.80, hdW = R * 0.30, hdH = R * 0.28;
  fell(ctx, hdX, cy, hdW, hdH, f, g, A - 0.06);
  fcirc(ctx, hdX - hdW * 0.30, cy - hdH * 0.40, R * 0.10, 'rgba(255,255,255,0.80)', g, A);
  // Mandible weapon (paired jaws)
  for (const s of [-1, 1] as const) {
    fpoly(ctx, [
      [hdX - hdW * 0.90, cy + s * R * 0.04],
      [hdX - hdW * 0.90 - R * 0.38, cy + s * R * 0.22],
      [hdX - hdW * 0.90 - R * 0.34, cy + s * R * 0.07],
    ], f, g, A - 0.08, 4);
  }
}

// T12  AVIAN_FLYER — bat/pterodactyl membrane wings, beak, tail fan, no rectangles
function drawT12(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), span = R * [1.95, 2.40, 1.65][v];
  // Membrane wings (swept, organic curves)
  for (const s of [-1, 1] as const) {
    const wRootY = cy + s * R * 0.28, wTipX = cx - R * 0.55, wTipY = cy + s * span;
    const wTrailX = cx + R * 0.70, wTrailY = cy + s * span * 0.52;
    ctx.save(); ctx.globalAlpha = A - 0.08; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx, wRootY);
    ctx.bezierCurveTo(cx - R * 0.22, cy + s * span * 0.30, wTipX, cy + s * span * 0.60, wTipX, wTipY);
    ctx.bezierCurveTo(cx - R * 0.08, cy + s * span * 0.88, wTrailX, cy + s * span * 0.72, wTrailX, wTrailY);
    ctx.bezierCurveTo(cx + R * 0.55, cy + s * span * 0.28, cx + R * 0.35, cy + s * R * 0.40, cx, wRootY);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.7; ctx.stroke(); ctx.restore();
    // Membrane veins
    ctx.save(); ctx.globalAlpha = A - 0.32; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.55;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      ctx.beginPath(); ctx.moveTo(cx - R * 0.05, wRootY); ctx.lineTo(wTipX + (cx - R * 0.05 - wTipX) * (1 - t), wTipY * t + wRootY * (1 - t)); ctx.stroke();
    }
    ctx.restore();
    // Wingtip talon
    fpoly(ctx, [[wTipX - R * 0.05, wTipY], [wTipX + R * 0.16, wTipY + s * R * 0.20], [wTipX + R * 0.22, wTipY]], f, g, A - 0.22, 3);
  }
  // Fuselage — elongated organic torpedo
  const fL = R * [0.92, 0.85, 1.02][v], fH = R * 0.20;
  ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.moveTo(cx - fL, cy);
  ctx.bezierCurveTo(cx - fL * 0.60, cy - fH, cx + fL * 0.20, cy - fH, cx + fL * 0.75, cy - fH * 0.45);
  ctx.lineTo(cx + fL, cy); ctx.lineTo(cx + fL * 0.75, cy + fH * 0.45);
  ctx.bezierCurveTo(cx + fL * 0.20, cy + fH, cx - fL * 0.60, cy + fH, cx - fL, cy);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 0.85; ctx.stroke(); ctx.restore();
  // Beak weapon
  stinger(ctx, cx - fL, cy, R * 0.40, R * 0.085, f, g, A);
  // Eye
  fcirc(ctx, cx - fL + R * 0.28, cy - fH * 0.45, R * 0.09, 'rgba(255,255,255,0.85)', g, A);
  // Tail fan feathers
  for (let i = -1; i <= 1; i++) fpoly(ctx, [[cx + fL, cy + i * R * 0.12], [cx + fL + R * 0.38, cy + i * R * 0.30], [cx + fL + R * 0.32, cy + i * R * 0.36]], f, g, A - 0.24, 3);
}

// ── CRYSTALLINE (T5) ──────────────────────────────────────────────────────────

// T5  CRYSTAL_CLUSTER — faceted mineral shards, zero curves, core polygon, focus shard
function drawT5(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nShard = [6, 7, 5][v], coreR = R * [0.30, 0.28, 0.34][v];
  // Radiating shards
  for (let i = 0; i < nShard; i++) {
    const baseA = (i / nShard) * Math.PI * 2 - Math.PI / 8;
    const shardLen = R * (0.65 + nh(n, 10 + i) * 0.80);
    const midA = baseA + (nh(n, 30 + i) - 0.5) * 0.28;
    const tipX = cx + Math.cos(midA) * (coreR + shardLen);
    const tipY = cy + Math.sin(midA) * (coreR + shardLen);
    const lbX = cx + Math.cos(baseA - 0.25) * coreR, lbY = cy + Math.sin(baseA - 0.25) * coreR;
    const rbX = cx + Math.cos(baseA + 0.25) * coreR, rbY = cy + Math.sin(baseA + 0.25) * coreR;
    const perpX = -Math.sin(midA) * R * 0.045, perpY = Math.cos(midA) * R * 0.045;
    // Main shard face
    fpoly(ctx, [[lbX, lbY], [rbX, rbY], [tipX, tipY]], f, g, A - 0.04, 6);
    // Bright highlight facet
    fpoly(ctx, [[rbX, rbY], [tipX, tipY], [tipX + perpX, tipY + perpY]], 'rgba(255,255,255,0.32)', g, A - 0.28, 2);
    // Shadow facet
    fpoly(ctx, [[lbX, lbY], [tipX, tipY], [tipX - perpX, tipY - perpY]], f, g, A - 0.24, 2);
  }
  // Core polygon
  const nCoreSides = [6, 8, 5][v];
  const corePts: P2[] = [];
  for (let i = 0; i < nCoreSides; i++) { const a = (i / nCoreSides) * Math.PI * 2 - Math.PI / 6; corePts.push([cx + coreR * Math.cos(a), cy + coreR * Math.sin(a)]); }
  fpoly(ctx, corePts, f, g, A + 0.06, 8);
  // Focusing weapon shard — largest crystal, pointed hard left
  const fLen = R * (0.90 + nh(n, 5) * 0.42);
  fpoly(ctx, [[cx - coreR, cy - R * 0.08], [cx - coreR - fLen, cy], [cx - coreR, cy + R * 0.08]], f, g, A + 0.02, 7);
  fpoly(ctx, [[cx - coreR - R * 0.10, cy - R * 0.04], [cx - coreR - fLen - R * 0.14, cy], [cx - coreR - R * 0.10, cy + R * 0.04]], 'rgba(255,255,255,0.30)', g, A - 0.24, 3);
}

// ── COLONIAL (T3) ─────────────────────────────────────────────────────────────

// T3  FUNGAL_COLONY — mycelium web, mushroom caps with gills, spore launcher
function drawT3(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nCap = [3, 4, 2][v];
  const stemX = cx + R * [0.22, 0.10, 0.32][v];
  // Mycelium threads (thin, curving irregularly)
  const nThread = 9 + v * 2;
  for (let i = 0; i < nThread; i++) {
    const a = (i / nThread) * Math.PI * 2 + nh(n, 60 + i) * 0.50;
    const tLen = R * (0.58 + nh(n, 70 + i) * 1.20);
    const mx = stemX + Math.cos(a) * tLen * 0.55 + (nh(n, 80 + i) - 0.5) * R * 0.28;
    const my = cy + Math.sin(a) * tLen * 0.55 + (nh(n, 90 + i) - 0.5) * R * 0.28;
    ctx.save(); ctx.globalAlpha = A - 0.36; ctx.strokeStyle = f; ctx.lineWidth = R * 0.028; ctx.shadowColor = g; ctx.shadowBlur = 2;
    ctx.beginPath(); ctx.moveTo(stemX, cy);
    ctx.quadraticCurveTo(mx, my, stemX + Math.cos(a) * tLen, cy + Math.sin(a) * tLen);
    ctx.stroke(); ctx.restore();
    fcirc(ctx, stemX + Math.cos(a) * tLen, cy + Math.sin(a) * tLen, R * 0.042, f, g, A - 0.40);
  }
  // Main stem
  const stemH = R * [0.65, 0.55, 0.72][v];
  ctx.save(); ctx.globalAlpha = A - 0.10; ctx.strokeStyle = f; ctx.lineWidth = R * 0.13; ctx.shadowColor = g; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(stemX, cy + stemH); ctx.lineTo(stemX, cy - stemH * 0.40); ctx.stroke(); ctx.restore();
  // Mushroom caps
  const capDefs = [[0, -1.0], [-0.52, -0.52], [0.52, -0.52], [0, -0.40]] as [number, number][];
  for (let i = 0; i < nCap; i++) {
    const [ox, oy] = capDefs[i] || [0, 0];
    const capX = stemX + ox * R * 0.55, capY = cy + oy * stemH;
    const capW = R * (0.54 - i * 0.055 + nh(n, 100 + i) * 0.10), capH = R * (0.27 - i * 0.025);
    // Underside (gill shadow)
    ctx.save(); ctx.globalAlpha = A - 0.22; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 2;
    ctx.beginPath(); ctx.ellipse(capX, capY, capW, capH * 0.32, 0, 0, Math.PI); ctx.fill(); ctx.restore();
    // Cap dome
    ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(capX - capW, capY);
    ctx.bezierCurveTo(capX - capW, capY - capH * 1.65, capX + capW, capY - capH * 1.65, capX + capW, capY);
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.7; ctx.stroke(); ctx.restore();
    // Gill lines
    ctx.save(); ctx.globalAlpha = A - 0.34; ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 0.52;
    for (let j = -2; j <= 2; j++) { const gx = capX + j * capW * 0.38; const gh = capH * 0.26 * Math.sqrt(Math.max(0, 1 - Math.pow(j * 0.38, 2))); ctx.beginPath(); ctx.moveTo(gx, capY); ctx.lineTo(gx, capY - gh * 0.88); ctx.stroke(); }
    ctx.restore();
  }
  // Spore-tube weapon pointing left
  const tubeX = cx - R * 0.55, tubeLen = R * (0.62 + nh(n, 7) * 0.42);
  ctx.save(); ctx.globalAlpha = A - 0.05; ctx.strokeStyle = f; ctx.lineWidth = R * 0.13; ctx.shadowColor = g; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(tubeX, cy); ctx.lineTo(tubeX - tubeLen, cy); ctx.stroke(); ctx.restore();
  fcirc(ctx, tubeX - tubeLen, cy, R * 0.12, f, g, A);
  fcirc(ctx, tubeX - tubeLen - R * 0.10, cy, R * 0.055, 'rgba(255,255,255,0.72)', g, A);
}

// ── ENERGY (T8) ───────────────────────────────────────────────────────────────

// T8  ENERGY_FIELD — plasma rings, arcing tendrils, glowing nucleus, beam weapon, no hull
function drawT8(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nRing = [3, 4, 2][v];
  // Energy arcs (crackling, irregular)
  const nArc = 7 + v * 2;
  for (let i = 0; i < nArc; i++) {
    const a1 = (i / nArc) * Math.PI * 2, a2 = a1 + (nh(n, 10 + i) - 0.5) * 1.80;
    const r1 = R * (0.22 + nh(n, 20 + i) * 0.50), r2 = R * (0.55 + nh(n, 30 + i) * 0.82);
    const mx = cx + Math.cos((a1 + a2) * 0.5) * (r1 + r2) * 0.72;
    const my = cy + Math.sin((a1 + a2) * 0.5) * (r1 + r2) * 0.72;
    ctx.save(); ctx.globalAlpha = A - 0.28; ctx.strokeStyle = f; ctx.lineWidth = R * 0.038; ctx.shadowColor = g; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
    ctx.quadraticCurveTo(mx, my, cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2);
    ctx.stroke(); ctx.restore();
  }
  // Concentric incomplete rings
  for (let i = 0; i < nRing; i++) {
    const ringR = R * (0.42 + i * [0.40, 0.32, 0.54][v]);
    const startA = nh(n, 40 + i) * Math.PI * 0.80, endA = startA + Math.PI * (1.35 + nh(n, 50 + i) * 0.50);
    ctx.save(); ctx.globalAlpha = A - 0.06 * i; ctx.strokeStyle = f;
    ctx.lineWidth = R * (0.13 - i * 0.022); ctx.shadowColor = g; ctx.shadowBlur = 10 - i * 2;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, startA, endA); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.70;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, startA, endA); ctx.stroke(); ctx.restore();
  }
  // Nucleus (bright hot core)
  fcirc(ctx, cx, cy, R * 0.22, f, g, A + 0.04);
  fcirc(ctx, cx, cy, R * 0.12, 'rgba(255,255,255,0.82)', g, A - 0.04);
  // Beam weapon (focused plasma left)
  const beamLen = R * (0.78 + nh(n, 7) * 0.46);
  ctx.save(); ctx.globalAlpha = A - 0.10; ctx.strokeStyle = f; ctx.lineWidth = R * 0.052; ctx.shadowColor = g; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(cx - R * 0.22, cy); ctx.lineTo(cx - R * 0.22 - beamLen, cy); ctx.stroke(); ctx.restore();
  fcirc(ctx, cx - R * 0.22 - beamLen, cy, R * 0.10, 'rgba(255,255,255,0.88)', g, A);
  // Orbiting probe node
  const orbA = nh(n, 3) * Math.PI * 2;
  fcirc(ctx, cx + Math.cos(orbA) * R * 1.10, cy + Math.sin(orbA) * R * 1.10, R * 0.10, f, g, A - 0.20);
}

// ── PLANT / SIEGE (T9) ────────────────────────────────────────────────────────

// T9  PLANT_SIEGE — gripping roots, trunk, armored leaf panels, crown spore cannon
function drawT9(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nRoot = [4, 5, 3][v];
  // Roots sprawling outward from base
  for (let i = 0; i < nRoot; i++) {
    const a = Math.PI * 0.38 + (i / Math.max(nRoot - 1, 1)) * Math.PI * 0.74 - Math.PI * 0.08;
    const rLen = R * (0.72 + nh(n, 10 + i) * 0.58);
    const ctrl1X = cx + Math.cos(a) * rLen * 0.38 + (nh(n, 20 + i) - 0.5) * R * 0.28;
    const ctrl1Y = cy + Math.sin(a) * rLen * 0.38;
    const ctrl2X = cx + Math.cos(a) * rLen * 0.72 - (nh(n, 25 + i) - 0.5) * R * 0.20;
    const ctrl2Y = cy + Math.sin(a) * rLen * 0.72;
    ctx.save(); ctx.globalAlpha = A - 0.14; ctx.strokeStyle = f; ctx.lineWidth = R * (0.10 - i * 0.008); ctx.shadowColor = g; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, cx + Math.cos(a) * rLen, cy + Math.sin(a) * rLen);
    ctx.stroke(); ctx.restore();
    fcirc(ctx, cx + Math.cos(a) * rLen, cy + Math.sin(a) * rLen, R * 0.050, f, g, A - 0.18);
  }
  // Central trunk
  const trunkH = R * [0.82, 0.72, 0.96][v];
  ctx.save(); ctx.globalAlpha = A - 0.04; ctx.strokeStyle = f; ctx.lineWidth = R * 0.18; ctx.shadowColor = g; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(cx, cy + R * 0.18); ctx.lineTo(cx, cy - trunkH); ctx.stroke(); ctx.restore();
  // Armored leaf panels (alternating sides as armor plating)
  const nLeaf = [3, 4, 2][v];
  for (let i = 0; i < nLeaf; i++) {
    const ly = cy - trunkH * (0.22 + i * 0.28);
    const lSide = i % 2 === 0 ? 1 : -1;
    const lW = R * (0.50 - i * 0.04), lH = R * (0.17 - i * 0.012);
    fpoly(ctx, [
      [cx, ly],
      [cx + lSide * lW * 0.20, ly - lH * 0.52],
      [cx + lSide * lW, ly - lH * 0.26],
      [cx + lSide * lW * 0.90, ly + lH * 0.38],
      [cx, ly + lH * 0.18],
    ], f, g, A - 0.08 - i * 0.04, 4);
  }
  // Crown pod + spore cannon
  fell(ctx, cx, cy - trunkH - R * 0.24, R * 0.30, R * 0.22, f, g, A + 0.02);
  gun(ctx, cx - R * 0.30, cy - trunkH - R * 0.24, R * 0.72, R * 0.062, f, g, A);
  // Spore vent pores on pod
  for (const px of [cx - R * 0.18, cx + R * 0.18]) fcirc(ctx, px, cy - trunkH - R * 0.38, R * 0.065, 'rgba(255,255,255,0.55)', g, A - 0.22);
}

// ── SWARM (T10) ───────────────────────────────────────────────────────────────

// T10  SWARM_COLLECTIVE — particle cloud, emergent front-density weapon cluster, no fixed body
function drawT10(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), nUnit = [28, 22, 34][v];
  const swW = R * [1.65, 1.45, 1.82][v], swH = R * [0.85, 0.75, 0.96][v];
  // Build unit positions
  const positions: P2[] = [];
  for (let i = 0; i < nUnit; i++) {
    const a = (i / nUnit) * Math.PI * 2 + nh(n, 100 + i) * 0.92;
    const radFrac = Math.sqrt(nh(n, 200 + i)); // bias outward
    positions.push([cx + Math.cos(a) * swW * radFrac, cy + Math.sin(a) * swH * radFrac]);
  }
  // Faint neighbor links
  ctx.save(); ctx.globalAlpha = A - 0.46; ctx.strokeStyle = f; ctx.lineWidth = R * 0.024; ctx.shadowColor = g; ctx.shadowBlur = 2;
  for (let i = 0; i < nUnit; i++) {
    const ni = (i + 1) % nUnit;
    const dx = positions[ni][0] - positions[i][0], dy = positions[ni][1] - positions[i][1];
    if (dx * dx + dy * dy < (R * 0.85) * (R * 0.85)) { ctx.beginPath(); ctx.moveTo(positions[i][0], positions[i][1]); ctx.lineTo(positions[ni][0], positions[ni][1]); ctx.stroke(); }
  }
  ctx.restore();
  // Individual units — front-weighted density
  for (let i = 0; i < nUnit; i++) {
    const [px, py] = positions[i];
    const frontBias = 1 - (px - (cx - swW)) / (swW * 2.0);
    const ur = R * (0.038 + frontBias * 0.032 + nh(n, 300 + i) * 0.026);
    fcirc(ctx, px, py, ur, f, g, A - 0.06 - nh(n, 400 + i) * 0.24);
  }
  // Concentrated weapon cluster at front
  const frontX = cx - swW * 0.72;
  for (let i = 0; i < 4 + v; i++) {
    const fx = frontX + nh(n, 500 + i) * R * 0.26 - R * 0.13;
    const fy = cy + (nh(n, 600 + i) - 0.5) * R * 0.28;
    fcirc(ctx, fx, fy, R * (0.072 + nh(n, 700 + i) * 0.038), f, g, A - 0.02);
  }
  // Loose cohesive nucleus
  fcirc(ctx, cx + R * 0.10, cy, R * 0.16, f, g, A - 0.22);
}

// ── BIOMECH HYBRID (T11) ──────────────────────────────────────────────────────

// T11  BIOMECH_HYBRID — organic tissue blob + mechanical graft plates + welded gun arm
function drawT11(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n);
  const blobW = R * [1.05, 0.92, 1.18][v], blobH = R * [0.72, 0.82, 0.64][v];
  // Organic core blob (amoeboid, smoothly interpolated polygon)
  const nBlobV = 10;
  const blobPts: P2[] = [];
  for (let i = 0; i < nBlobV; i++) {
    const a = (i / nBlobV) * Math.PI * 2;
    const w = 1 + (nh(n, 10 + i) - 0.5) * 0.28;
    blobPts.push([cx + Math.cos(a) * blobW * w, cy + Math.sin(a) * blobH * w]);
  }
  ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 9;
  ctx.beginPath(); ctx.moveTo(blobPts[0][0], blobPts[0][1]);
  for (let i = 0; i < nBlobV; i++) {
    const ni = (i + 1) % nBlobV;
    const mx = (blobPts[i][0] + blobPts[ni][0]) / 2, my = (blobPts[i][1] + blobPts[ni][1]) / 2;
    ctx.quadraticCurveTo(blobPts[i][0], blobPts[i][1], mx, my);
  }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
  // Surface veins
  ctx.save(); ctx.globalAlpha = A - 0.36; ctx.strokeStyle = 'rgba(255,255,255,0.60)'; ctx.lineWidth = 0.58;
  for (let i = 0; i < 4 + v; i++) {
    const a = (i / (4 + v)) * Math.PI * 2 + nh(n, 20 + i);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * blobW * 0.62, cy + Math.sin(a) * blobH * 0.62); ctx.stroke();
  }
  ctx.restore();
  // Mechanical graft plates (angular, bolted on)
  const nGraft = [3, 4, 2][v];
  const graftAngs = [Math.PI * 0.90, Math.PI * 0.15, Math.PI * 1.55, Math.PI * 0.55];
  for (let i = 0; i < nGraft; i++) {
    const a = graftAngs[i] + nh(n, 30 + i) * 0.20;
    const gr = blobW * (0.72 + nh(n, 40 + i) * 0.20);
    const gx = cx + Math.cos(a) * gr, gy = cy + Math.sin(a) * blobH / blobW * gr;
    const gW = R * (0.28 + nh(n, 50 + i) * 0.18), gH = R * (0.13 + nh(n, 60 + i) * 0.10);
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(a + Math.PI / 2);
    frect(ctx, -gW / 2, -gH / 2, gW, gH, f, g, A - 0.04);
    // Bolt heads
    ctx.globalAlpha = A - 0.35; ctx.strokeStyle = 'rgba(255,255,255,0.72)'; ctx.lineWidth = 0.65;
    for (const bx of [-gW * 0.32, gW * 0.32]) { ctx.beginPath(); ctx.arc(bx, 0, R * 0.040, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  // Mechanical gun arm welded at left side
  const armLen = R * (0.55 + nh(n, 7) * 0.38);
  fcirc(ctx, cx - blobW, cy, R * 0.14, f, g, A - 0.08); // weld joint
  frect(ctx, cx - blobW - armLen, cy - R * 0.062, armLen, R * 0.124, f, g, A + 0.04);
  gun(ctx, cx - blobW, cy, armLen + R * 0.18, R * 0.062, f, g, A);
}

// ── ALIEN ARCHITECTURE (T13) ──────────────────────────────────────────────────

// T13  ALIEN_ARCH — trefoil outer shell, nested incompatible inner polygon, phase-line orbitals
function drawT13(ctx: Ctx, cx: number, cy: number, R: number, n: number, f: string, g: string, A: number): void {
  const v = TV(n), oR = R * [1.18, 1.32, 1.06][v];
  // Outer trefoil knot form (double-pass for phase-shift ghost effect)
  for (let pass = 0; pass < 2; pass++) {
    const off = pass * R * 0.07;
    ctx.save(); ctx.globalAlpha = A - pass * 0.24; ctx.strokeStyle = f;
    ctx.lineWidth = R * (0.12 - pass * 0.040); ctx.shadowColor = g; ctx.shadowBlur = 8 - pass * 3;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      const r = oR * (1 + 0.28 * Math.cos(3 * t)) + off;
      const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  // Inner nested shape — rotated quadfoil, incompatible with outer form
  ctx.save(); ctx.globalAlpha = A - 0.06; ctx.fillStyle = f; ctx.shadowColor = g; ctx.shadowBlur = 7;
  ctx.beginPath();
  const innerScale = [0.52, 0.46, 0.58][v];
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * Math.PI * 2 + Math.PI / 5;
    const r = oR * innerScale * (1 + 0.32 * Math.cos(4 * t + 0.8));
    if (i === 0) ctx.moveTo(cx + r * Math.cos(t), cy + r * Math.sin(t));
    else ctx.lineTo(cx + r * Math.cos(t), cy + r * Math.sin(t));
  }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
  // Floating disconnected phase orbitals
  const nOrb = [4, 5, 3][v];
  for (let i = 0; i < nOrb; i++) {
    const oa = (i / nOrb) * Math.PI * 2 + nh(n, 10 + i) * 0.70;
    const od = oR * (0.72 + nh(n, 20 + i) * 0.38);
    const ox = cx + Math.cos(oa) * od, oy = cy + Math.sin(oa) * od;
    fcirc(ctx, ox, oy, R * (0.10 + nh(n, 30 + i) * 0.07), f, g, A - 0.18);
    // Phase line — dashed, not a real structural link
    ctx.save(); ctx.globalAlpha = A - 0.44; ctx.setLineDash([R * 0.06, R * 0.10]); ctx.strokeStyle = f; ctx.lineWidth = R * 0.028;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, oy); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  // Nucleus: pentagon nested inside octagon
  const nPts5: P2[] = [], nPts8: P2[] = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; nPts5.push([cx + R * 0.22 * Math.cos(a), cy + R * 0.22 * Math.sin(a)]); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; nPts8.push([cx + R * 0.13 * Math.cos(a), cy + R * 0.13 * Math.sin(a)]); }
  fpoly(ctx, nPts5, f, g, A + 0.02, 6);
  fpoly(ctx, nPts8, 'rgba(255,255,255,0.36)', g, A - 0.24, 3);
  // Rift weapon — geometric tear pointing left
  const rfL = R * (0.65 + nh(n, 7) * 0.46);
  fpoly(ctx, [[cx - oR, cy - R * 0.10], [cx - oR - rfL, cy], [cx - oR, cy + R * 0.10]], f, g, A + 0.02, 8);
  fpoly(ctx, [[cx - oR - R * 0.10, cy - R * 0.06], [cx - oR - rfL - R * 0.14, cy], [cx - oR - R * 0.10, cy + R * 0.06]], 'rgba(255,255,255,0.40)', g, A - 0.22, 4);
}

// §7  Class mark overlay
function drawClassMark(ctx: Ctx, cx: number, cy: number, R: number, cls: VirusClass): void {
  ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.75; ctx.shadowBlur = 0;
  switch (cls) {
    case 'prime':
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + R * 0.12 * Math.cos(a), cy + R * 0.12 * Math.sin(a)); ctx.lineTo(cx + R * 0.28 * Math.cos(a), cy + R * 0.28 * Math.sin(a)); ctx.stroke(); }
      break;
    case 'power-of-two': ctx.strokeRect(cx - R * 0.16, cy - R * 0.16, R * 0.32, R * 0.32); break;
    case 'perfect-square': ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2); ctx.stroke(); break;
    case 'even-composite':
      ctx.beginPath(); ctx.moveTo(cx - R * 0.24, cy - R * 0.10); ctx.lineTo(cx + R * 0.24, cy - R * 0.10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R * 0.24, cy + R * 0.10); ctx.lineTo(cx + R * 0.24, cy + R * 0.10); ctx.stroke(); break;
    case 'odd-composite': { const t = R * 0.20; ctx.beginPath(); ctx.moveTo(cx, cy - t); ctx.lineTo(cx + t * 0.87, cy + t * 0.5); ctx.lineTo(cx - t * 0.87, cy + t * 0.5); ctx.closePath(); ctx.stroke(); break; }
  }
  ctx.restore();
}

// §8  Main draw entry point — signature UNCHANGED
const TOPO_DRAW = [drawT0, drawT1, drawT2, drawT3, drawT4, drawT5, drawT6, drawT7, drawT8, drawT9, drawT10, drawT11, drawT12, drawT13];

export function drawVirus(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, cell: number,
  flash: boolean,
  green = false,
): void {
  const cls  = green ? 'even-composite' as VirusClass : getVirusClass(n);
  const fill = green ? (flash ? '#f0fdf4' : '#4ade80') : (flash ? FLASH_C[cls] : FILL_C[cls]);
  const glow = green ? 'rgba(74,222,128,0.50)' : GLOW_C[cls];
  const R    = cell * 0.22 + cell * 0.016 * Math.log2(n + 1);
  const topo = getTopology(n);
  const A    = flash ? 0.92 : 0.84;
  ctx.save();
  TOPO_DRAW[topo](ctx, cx, cy, R, n, fill, glow, A);
  if (!green && !flash) drawClassMark(ctx, cx, cy, R, cls);
  ctx.restore();
}

// §9  Silhouette validation
export function drawVirusSilhouette(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, cell: number,
): void {
  const R = cell * 0.22 + cell * 0.016 * Math.log2(n + 1);
  ctx.save();
  TOPO_DRAW[getTopology(n)](ctx, cx, cy, R, n, '#000000', '#000000', 1.0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = '#000000';
  ctx.fillRect(cx - R * 3.5, cy - R * 3.5, R * 7, R * 7);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function runSilhouetteDiversityTest(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const seeds = [37, 14, 25, 63, 47, 18, 71, 40, 53, 29, 89, 56, 100, 172, 121, 94, 200, 160, 213, 177];
  const C = 5, cW = w / C, cH = h / 4, cell = Math.min(cW, cH) * 0.52;
  const names = ['MONO', 'FRAME', 'CEPH', 'FUNG', 'VERT', 'CRYS', 'ARTH', 'CRAWL', 'ENRG', 'PLANT', 'SWRM', 'BIOM', 'AVIA', 'ALIE'];
  ctx.fillStyle = '#f0f4f8'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1e293b'; ctx.font = `${Math.round(cell * 0.10)}px monospace`; ctx.textAlign = 'center';
  ctx.fillText('SUBSTRATE DIVERSITY TEST v5', w / 2, cell * 0.09);
  const topoSet = new Set<number>();
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i], col = i % C, row = Math.floor(i / C);
    const ex = cW * (col + 0.5), ey = cH * (row + 0.5) + cell * 0.08;
    const t = getTopology(seed); topoSet.add(t);
    drawVirusSilhouette(ctx, ex, ey, seed, cell);
    ctx.fillStyle = '#334155'; ctx.font = `${Math.round(cell * 0.085)}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(`T${t} ${names[t]}`, ex, ey + cell * 0.35);
  }
  const passed = topoSet.size >= 10;
  ctx.font = `${Math.round(cell * 0.095)}px monospace`; ctx.textAlign = 'center';
  ctx.fillStyle = passed ? '#064e3b' : '#7f1d1d';
  ctx.fillText(`${passed ? 'PASS' : 'FAIL'} -- ${topoSet.size}/14 substrates: ${[...topoSet].map(t => names[t]).join(' ')}`, w / 2, h - cell * 0.12);
  console.log('[SilhouetteTest]', passed ? 'PASS' : 'FAIL', [...topoSet].map(t => names[t]));
}

// §10  MorphSig + diversity helpers
export interface MorphSig {
  topology: number; variant: number; cls: number; aspectGroup: number; massCenter: number;
}
// aspectGroup: 0=round  1=vertical  2=horizontal  3=irregular  4=radial
// massCenter:  0=front  1=center    2=rear         3=distributed
const TOPO_META: [number, number][] = [
  [2, 0], // T0  MONOCOQUE       horizontal / front
  [2, 1], // T1  CHASSIS_FRAME   horizontal / center
  [0, 0], // T2  CEPHALOPOD      round      / front
  [1, 3], // T3  FUNGAL_COLONY   vertical   / distributed
  [2, 0], // T4  VERTEBRATE      horizontal / front
  [4, 1], // T5  CRYSTAL_CLUSTER radial     / center
  [2, 2], // T6  ARTHROPOD       horizontal / rear
  [2, 1], // T7  CRAWLER_BED     horizontal / center
  [4, 1], // T8  ENERGY_FIELD    radial     / center
  [1, 2], // T9  PLANT_SIEGE     vertical   / rear
  [4, 3], // T10 SWARM_COLLECTIVE radial    / distributed
  [3, 0], // T11 BIOMECH_HYBRID  irregular  / front
  [2, 0], // T12 AVIAN_FLYER     horizontal / front
  [3, 3], // T13 ALIEN_ARCH      irregular  / distributed
];
const VC_O: VirusClass[] = ['prime', 'power-of-two', 'perfect-square', 'even-composite', 'odd-composite'];

export function getMorphSig(n: number): MorphSig {
  const t = getTopology(n);
  return { topology: t, variant: TV(n), cls: VC_O.indexOf(getVirusClass(n)), aspectGroup: TOPO_META[t][0], massCenter: TOPO_META[t][1] };
}
export function morphDistance(a: MorphSig, b: MorphSig): number {
  let d = 0;
  d += (a.topology !== b.topology ? 1 : 0) * 0.55;
  d += (a.aspectGroup !== b.aspectGroup ? 1 : 0) * 0.18;
  d += (a.massCenter !== b.massCenter ? 1 : 0) * 0.12;
  d += (a.cls !== b.cls ? 1 : 0) * 0.10;
  d += (a.variant !== b.variant ? 1 : 0) * 0.05;
  return d;
}
export function selectDiverseSeed(waveSigs: MorphSig[], crossHistory: MorphSig[]): number {
  const all = [...crossHistory.slice(-6), ...waveSigs]; let best = -1, bestScore = -1;
  for (let attempt = 0; attempt < 32; attempt++) {
    const seed = Math.floor(Math.random() * 255) + 1, sig = getMorphSig(seed);
    let wMin = 1.0; for (const ws of all) { const d = morphDistance(sig, ws); if (d < wMin) wMin = d; }
    const sharedTopo = all.filter(ws => ws.topology === sig.topology).length;
    const score = wMin * Math.pow(0.55, sharedTopo);
    if (score > bestScore) { bestScore = score; best = seed; }
  }
  return best > 0 ? best : Math.floor(Math.random() * 255) + 1;
}

const SPAWN_WIN = 12, MIN_DIST = 0.18, MAX_SAME_T = 3;
const _hist: MorphSig[] = [];
export function registerSpawn(sig: MorphSig): void { _hist.push(sig); if (_hist.length > SPAWN_WIN) _hist.shift(); }
export function clearSpawnHistory(): void { _hist.length = 0; }
export function pickDiverseSeed(): number {
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < 40; i++) {
    const seed = 1 + ((i * 97 + Math.floor(Math.random() * 22)) % 255), sig = getMorphSig(seed);
    const tC = _hist.filter(s => s.topology === sig.topology).length;
    if (tC >= MAX_SAME_T) continue;
    let minD = 1.0; for (const s of _hist) { const d = morphDistance(sig, s); if (d < minD) minD = d; }
    if (minD < MIN_DIST) continue;
    const sc = minD * Math.pow(0.50, tC); if (sc > bestScore) { bestScore = sc; best = seed; }
  }
  return best > 0 ? best : 1 + Math.floor(Math.random() * 255);
}

// §11  Distribution validator
export function validateDistribution(sampleSize = 256): { topoCounts: number[]; maxTopoFrac: number; uniqueTopologies: number; passed: boolean; } {
  const tc = new Array(N_TOPO).fill(0);
  for (let i = 0; i < sampleSize; i++) tc[getTopology(Math.floor(Math.random() * 255) + 1)]++;
  const maxTC = Math.max(...tc), maxFrac = maxTC / sampleSize, unique = tc.filter(c => c > 0).length;
  const passed = maxFrac <= 0.14 && unique >= 12;
  if (!passed) console.warn('[Morphology] FAIL', { maxFrac: maxFrac.toFixed(3), tc });
  else console.log('[Morphology] OK -- unique:', unique, 'maxFrac:', maxFrac.toFixed(3));
  return { topoCounts: tc, maxTopoFrac: maxFrac, uniqueTopologies: unique, passed };
}

// §12  Legacy shims
export function getVirusRadius(n: number, R0: number, k: number): number { return R0 + k * Math.log2(n + 1); }

const ARCHS: VirusArchetype[] = [
  'biological', 'humanoid', 'animal', 'insectoid', 'mechanical', 'armored', 'crystalline',
  'mineral', 'plant', 'synthetic', 'robotic', 'amorphous', 'geometric', 'energy', 'cybernetic', 'skeletal', 'fluid',
];
export function getVirusModelProfile(value: number): VirusModelProfile {
  const pi = Math.floor(nh(value, 1) * ARCHS.length);
  let si = Math.floor(nh(value, 2) * ARCHS.length); if (si === pi) si = (si + 1) % ARCHS.length;
  const pw = 0.6 + nh(value, 3) * 0.4;
  return {
    primaryArchetype: ARCHS[pi], secondaryArchetype: ARCHS[si], primaryWeight: pw, secondaryWeight: 1 - pw,
    structureLevel: nh(value, 4), symmetryLevel: nh(value, 5), armorLevel: nh(value, 6),
    organicLevel: nh(value, 7), mechanicalLevel: nh(value, 8), crystallineLevel: nh(value, 9), energyLevel: nh(value, 10),
  };
}
export function getCompatibilityScore(profile: VirusModelProfile, model: VirusVisualModel, lobes: number, symmetryLevel: number): number {
  const am = model.archetypes.includes(profile.primaryArchetype) ? 1 : model.archetypes.includes(profile.secondaryArchetype) ? 0.5 : 0;
  const minL = model.compatibleFeatures.minLobes ?? 3, maxL = model.compatibleFeatures.maxLobes ?? 8;
  const [sMin, sMax] = model.compatibleFeatures.symmetryRange ?? [0, 1];
  return am * 0.40 + (lobes >= minL && lobes <= maxL ? 1 : 0) * 0.25 + (symmetryLevel >= sMin && symmetryLevel <= sMax ? 1 : 0) * 0.15;
}
