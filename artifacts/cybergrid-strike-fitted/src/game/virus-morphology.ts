/**
 * Virus Morphology v3 — Symmetry-First Body Plan Grammar
 *
 * Design hierarchy (per spec):
 *   Functional Traits → Body Plan → Structural Layout → Symmetry → Anatomy → Surface Detail
 *
 * Symmetry is chosen ONCE from the phenotype and drives ALL structural placement.
 * No structure is placed without a phenotypic justification.
 * The renderer receives a phenotype and renders it deterministically — it does not
 * invent geometry.
 *
 * Three exclusive rendering paths:
 *   BILATERAL  — primes. Paired structures mirrored above/below the FRONT-REAR axis.
 *   RADIAL     — powers-of-two, perfect squares. N-fold rotational structures.
 *   ASYMMETRIC — some composites. Deliberate single-side dominance with mass balance.
 *
 * Structural layer order (same for all paths):
 *   1. Primary mass   (polar base body — authoritative silhouette, never overwritten)
 *   2. Locomotion     (rear structures)
 *   3. Weapons        (front structures)
 *   4. Armor          (perimeter structures)
 *   5. Sensors        (forward-top structures)
 *   6. Refinement     (maturity rings + apex crown — on top, purely additive)
 *
 * In-game orientation: viruses move LEFT.
 *   FRONT = Math.PI  (left  — leading edge / attack direction)
 *   REAR  = 0        (right — trailing edge)
 *   UP    = -π/2     (top of canvas body)
 *   DOWN  = +π/2     (bottom)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  Types
// ═══════════════════════════════════════════════════════════════════════════════

export type VirusClass =
  | 'prime'
  | 'power-of-two'
  | 'perfect-square'
  | 'even-composite'
  | 'odd-composite';

/** All gameplay traits derived deterministically from the virus integer n. */
export interface VirusPhenotype {
  n:              number;
  cls:            VirusClass;
  lobes:          number;
  spikes:         boolean[];
  spikeCount:     number;
  // Trait scores — all [0, 1]
  speed:          number;
  armor:          number;
  mass:           number;
  attackRange:    number;
  sensorRadius:   number;
  aggression:     number;
  regen:          number;
  evasion:        number;
  // Structural roles
  symmetry:       'bilateral' | 'radial' | 'asymmetric';
  attackStyle:    'melee' | 'pulse' | 'ranged';
  locomotionType: 'fins' | 'jets' | 'passive';
}

// ─── Legacy types retained for compatibility ───────────────────────────────────

export type VirusArchetype =
  | 'biological' | 'humanoid' | 'animal' | 'insectoid' | 'mechanical'
  | 'armored' | 'crystalline' | 'mineral' | 'plant' | 'synthetic'
  | 'robotic' | 'amorphous' | 'geometric' | 'energy' | 'cybernetic'
  | 'skeletal' | 'fluid';

export interface VirusModelProfile {
  primaryArchetype:    VirusArchetype;
  secondaryArchetype:  VirusArchetype;
  primaryWeight:       number;
  secondaryWeight:     number;
  structureLevel:      number;
  symmetryLevel:       number;
  armorLevel:          number;
  organicLevel:        number;
  mechanicalLevel:     number;
  crystallineLevel:    number;
  energyLevel:         number;
}

export interface VirusVisualModel {
  id: string;
  archetypes: VirusArchetype[];
  compatibleFeatures: {
    minLobes?:      number;
    maxLobes?:      number;
    symmetryRange?: [number, number];
    armorRange?:    [number, number];
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/** Deterministic hash: same inputs always produce the same output. No Math.random(). */
function normalizedHash(value: number, salt: number): number {
  const x = Math.sin(value * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function getDivisorCount(n: number): number {
  if (n <= 1) return 1;
  let count = 0;
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) count += (i === n / i ? 1 : 2);
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  Number theory + morphology primitives
// ═══════════════════════════════════════════════════════════════════════════════

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}
export function isPerfectSquare(n: number): boolean {
  const s = Math.round(Math.sqrt(n));
  return s * s === n;
}
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function getVirusClass(n: number): VirusClass {
  if (isPrime(n))         return 'prime';
  if (isPowerOfTwo(n))    return 'power-of-two';
  if (isPerfectSquare(n)) return 'perfect-square';
  if (n % 2 === 0)        return 'even-composite';
  return 'odd-composite';
}

export function getVirusLobes(n: number): number { return 3 + (n % 6); }
export function getVirusRadius(n: number, R0: number, k: number): number {
  return R0 + k * Math.log2(n + 1);
}
export function getVirusSpikes(n: number): boolean[] {
  return Array.from({ length: 8 }, (_, i) => Boolean((n >> i) & 1));
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  Color palette
// ═══════════════════════════════════════════════════════════════════════════════

const CLASS_FILL: Record<VirusClass, string> = {
  'prime':          '#e879f9',
  'power-of-two':   '#22d3ee',
  'perfect-square': '#fbbf24',
  'even-composite': '#fb7185',
  'odd-composite':  '#fb923c',
};
const CLASS_FLASH: Record<VirusClass, string> = {
  'prime':          '#fae8ff',
  'power-of-two':   '#ecfeff',
  'perfect-square': '#fef9c3',
  'even-composite': '#fff1f2',
  'odd-composite':  '#fff7ed',
};
const CLASS_GLOW: Record<VirusClass, string> = {
  'prime':          'rgba(232,121,249,0.55)',
  'power-of-two':   'rgba(34,211,238,0.55)',
  'perfect-square': 'rgba(251,191,36,0.55)',
  'even-composite': 'rgba(251,113,133,0.45)',
  'odd-composite':  'rgba(251,146,60,0.50)',
};

export function getVirusColors(n: number, flash: boolean): { fill: string; glow: string } {
  const cls = getVirusClass(n);
  return { fill: flash ? CLASS_FLASH[cls] : CLASS_FILL[cls], glow: CLASS_GLOW[cls] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  Phenotype derivation
// ═══════════════════════════════════════════════════════════════════════════════

export function getVirusPhenotype(n: number): VirusPhenotype {
  const h   = (salt: number) => normalizedHash(n, salt);
  const cls = getVirusClass(n);
  const lobes    = getVirusLobes(n);
  const spikes   = getVirusSpikes(n);
  const spikeCount = spikes.filter(Boolean).length;
  const divCount = getDivisorCount(n);

  // Speed: high spike density → agile. Primes quick; squares ponderous.
  const rawSpeed = (spikeCount / 8) * 0.55 + h(11) * 0.45;
  const speed =
    cls === 'prime'           ? Math.min(1, rawSpeed * 1.22)
    : cls === 'perfect-square'? rawSpeed * 0.65
    : rawSpeed;

  // Armor: smooth bodies plate more.
  const rawArmor = ((8 - spikeCount) / 8) * 0.40 + h(12) * 0.60;
  const armor =
    cls === 'perfect-square'  ? 0.45 + rawArmor * 0.45
    : cls === 'power-of-two'  ? 0.30 + h(12) * 0.50
    : cls === 'even-composite'? 0.20 + rawArmor * 0.70
    : rawArmor * 0.72;

  // Mass: larger integers feel heavier.
  const mass = Math.min(1, 0.15 + (Math.log2(n + 1) / 8) * 0.55 + h(13) * 0.30);

  // Attack range: 0 = melee … 1 = ranged.
  const rawRange = h(14);
  const attackRange =
    cls === 'prime'          ? rawRange * 0.42
    : cls === 'power-of-two' ? 0.32 + rawRange * 0.48
    : rawRange;

  // Sensor: divisor-rich numbers detect better.
  const sensorRadius = Math.min(1, (divCount / 14) * 0.55 + h(15) * 0.45);

  // Aggression: primes hunt; squares sit defensively.
  const rawAgg = h(16);
  const aggression =
    cls === 'prime'           ? 0.55 + rawAgg * 0.45
    : cls === 'perfect-square'? rawAgg * 0.42
    : cls === 'odd-composite' ? 0.18 + rawAgg * 0.66
    : rawAgg;

  // Regen: highly composite → redundant structures → regen.
  const regen = Math.min(1, (divCount / 12) * 0.62 + h(17) * 0.38);

  // Evasion: trade-off with armor (agile OR armored).
  const evasion = Math.min(1, Math.max(0, (1 - armor) * 0.72 + h(18) * 0.44 - 0.12));

  // Symmetry — determined once; drives all structural placement.
  const symVal = h(19);
  const symmetry: VirusPhenotype['symmetry'] =
    cls === 'perfect-square' || cls === 'power-of-two' ? 'radial'
    : cls === 'prime'                                   ? 'bilateral'
    : symVal < 0.28 ? 'asymmetric'
    : symVal < 0.68 ? 'radial'
    : 'bilateral';

  // Attack style — one role per virus.
  const attackStyle: VirusPhenotype['attackStyle'] =
    attackRange < 0.33 ? 'melee'
    : attackRange > 0.66 ? 'ranged'
    : 'pulse';

  // Locomotion type — simplified (no struts; passive for slow/heavy).
  const locomotionType: VirusPhenotype['locomotionType'] =
    speed > 0.62 && mass > 0.60 ? 'jets'
    : speed > 0.50               ? 'fins'
    : 'passive';

  return {
    n, cls, lobes, spikes, spikeCount,
    speed, armor, mass, attackRange, sensorRadius,
    aggression, regen, evasion,
    symmetry, attackStyle, locomotionType,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  Polar base body  (primary mass — authoritative silhouette)
// ═══════════════════════════════════════════════════════════════════════════════

function virusRadius(theta: number, n: number, R: number): number {
  const L = getVirusLobes(n);
  const spikes = getVirusSpikes(n);
  const lobeFactor = 0.78 + 0.22 * Math.cos(L * theta);
  const sectorWidth = (Math.PI * 2) / 8;
  const normTheta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.floor(normTheta / sectorWidth);
  const sectorCenter = (sector + 0.5) * sectorWidth;
  let diff = normTheta - sectorCenter;
  if (diff >  Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  const blend = Math.max(0, Math.cos((diff / sectorWidth) * Math.PI * 0.5));
  const binaryOffset = spikes[sector] ? R * 0.30 * blend : -R * 0.16 * blend;
  return R * lobeFactor + binaryOffset;
}

function buildBodyPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, R: number,
  steps = 160,
): void {
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = virusRadius(t, n, R);
    const x = cx + r * Math.cos(t - Math.PI / 2);
    const y = cy + r * Math.sin(t - Math.PI / 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7  Structural grammar — symmetry-aware rendering primitives
//
//  Angular constants:
//    FRONT = π   (left  — leading edge, attack direction)
//    REAR  = 0   (right — trailing edge)
//    UP    = -π/2 (top of body)
//    DOWN  = +π/2 (bottom)
//
//  Rules:
//   • Each function draws ONLY its one structural role.
//   • No function calls another.
//   • All geometry is relative to (cx, cy) and scaled by R.
//   • lineWidth minimum: 1.5 (for visibility at gameplay scale).
//   • Every structure saves/restores ctx state.
// ═══════════════════════════════════════════════════════════════════════════════

const FRONT = Math.PI;
const REAR  = 0;
const UP    = -Math.PI / 2;
const DOWN  =  Math.PI / 2;

// ─── A. BILATERAL structures (paired, mirrored about FRONT-REAR axis) ─────────

/**
 * Two swept-back triangular fins, one above and one below the REAR axis.
 * Communicates: speed / directional locomotion.
 */
function bilateralFins(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  speed: number, alpha: number,
): void {
  const height   = R * (0.50 + speed * 0.28);
  const baseOff  = 0.32;   // angular spread of fin base from REAR

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.78})`;
  ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.18})`;
  ctx.lineWidth   = 1.5;

  for (const side of [-1, 1]) {
    // Base: where fin meets body at rear
    const baseAngle = REAR + side * baseOff;
    const bx = cx + R * 0.82 * Math.cos(baseAngle);
    const by = cy + R * 0.82 * Math.sin(baseAngle);
    // Tip: swept further out and rearward
    const tipAngle = REAR + side * (baseOff + 0.24);
    const tx = cx + (R + height) * Math.cos(tipAngle);
    const ty = cy + (R + height) * Math.sin(tipAngle);
    // Inner corner: at the body edge, closer to REAR axis
    const inAngle = REAR + side * (baseOff - 0.20);
    const ix = cx + R * 0.58 * Math.cos(inAngle);
    const iy = cy + R * 0.58 * Math.sin(inAngle);

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Two circular jet ports at the rear, mirrored above/below REAR axis.
 * Communicates: heavy + fast propulsion.
 */
function bilateralJets(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  mass: number, speed: number, alpha: number,
): void {
  const portR  = R * (0.10 + mass * 0.05);
  const offset = 0.26;

  ctx.save();
  for (const side of [-1, 1]) {
    const angle = REAR + side * offset;
    const dist  = R * 0.86;
    const px = cx + dist * Math.cos(angle);
    const py = cy + dist * Math.sin(angle);

    // Port outer ring
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.82})`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(px, py, portR, 0, Math.PI * 2); ctx.stroke();
    // Inner glow
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.32})`;
    ctx.beginPath(); ctx.arc(px, py, portR * 0.52, 0, Math.PI * 2); ctx.fill();
    // Exhaust plume
    if (speed > 0.55) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.20})`;
      ctx.lineWidth   = portR * 1.4;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + R * 0.30, py);   // directly rearward (REAR = 0, cos(0)=1)
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }
  ctx.restore();
}

/**
 * Two forward-sweeping claws, one above and one below the FRONT axis.
 * Communicates: melee aggression / close-quarters attack.
 */
function bilateralClaws(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  aggression: number, alpha: number,
): void {
  const length  = R * (0.44 + aggression * 0.24);
  const spread  = 0.28 + aggression * 0.06;

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.88})`;
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';

  for (const side of [-1, 1]) {
    const baseAngle = FRONT + side * spread;
    const bx = cx + R * 0.80 * Math.cos(baseAngle);
    const by = cy + R * 0.80 * Math.sin(baseAngle);
    // Tip converges toward the axis (inward hook)
    const tipAngle = FRONT + side * spread * 0.30;
    const tx = cx + (R + length) * Math.cos(tipAngle);
    const ty = cy + (R + length) * Math.sin(tipAngle);
    // Barb: short perpendicular at the tip, pointing inward
    const barbDir = tipAngle + side * (Math.PI / 2);
    const barbLen = R * 0.16;

    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + barbLen * Math.cos(barbDir), ty + barbLen * Math.sin(barbDir));
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}

/**
 * One or two forward-pointing weapon barrels on the FRONT axis.
 * Dual barrels when sensorRadius is high (targeting capability).
 * Communicates: ranged attack.
 */
function bilateralBarrels(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  mass: number, sensorRadius: number, alpha: number,
): void {
  const dual         = sensorRadius > 0.58;
  const barrelLength = R * (0.50 + mass * 0.18);
  const barrelWidth  = R * (0.07 + mass * 0.04);
  const spread       = 0.17;
  const offsets      = dual ? [-1, 1] : [0];

  ctx.save();
  ctx.lineCap = 'butt';

  for (const s of offsets) {
    const angle = FRONT + s * spread;
    const bx = cx + R * 0.74 * Math.cos(angle);
    const by = cy + R * 0.74 * Math.sin(angle);
    const ex = cx + (R + barrelLength) * Math.cos(angle);
    const ey = cy + (R + barrelLength) * Math.sin(angle);

    // Barrel shaft (thick line)
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.80})`;
    ctx.lineWidth   = barrelWidth * 2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    // Muzzle ring
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.95})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(ex, ey, barrelWidth * 0.90, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.restore();
}

/**
 * Two rounded pulse-emitter lobes on the upper and lower flanks.
 * Communicates: omnidirectional mid-range pulse attack.
 */
function bilateralPulseEmitters(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  alpha: number,
): void {
  const nodeR = R * 0.13;
  const dist  = R * 0.86;

  ctx.save();
  for (const side of [-1, 1]) {
    const angle = side === -1 ? UP : DOWN;
    const nx = cx + dist * Math.cos(angle);
    const ny = cy + dist * Math.sin(angle);

    // Emitter node
    ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.40})`;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2); ctx.fill();
    // Emission ring
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2); ctx.stroke();
    // Outer pulse halo
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Protective arc covering the front-facing hemisphere.
 * Used for armored bilateral viruses.
 * Communicates: defensive protection of the attack vector.
 */
function bilateralArmorArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  armor: number, alpha: number,
): void {
  const coverage = Math.PI * (0.40 + armor * 0.25);   // arc half-angle
  const shellR   = R * 0.93;
  const thick    = R * (0.09 + armor * 0.08);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.50 + armor * 0.22)})`;
  ctx.lineWidth   = thick;
  ctx.beginPath();
  ctx.arc(cx, cy, shellR, FRONT - coverage, FRONT + coverage);
  ctx.stroke();
  // Seam gap markers (make it look like segmented plates)
  ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.35})`;
  ctx.lineWidth   = 1;
  for (const off of [-coverage / 2, 0, coverage / 2]) {
    const a = FRONT + off;
    ctx.beginPath();
    ctx.moveTo(cx + (shellR - thick * 0.6) * Math.cos(a), cy + (shellR - thick * 0.6) * Math.sin(a));
    ctx.lineTo(cx + (shellR + thick * 0.6) * Math.cos(a), cy + (shellR + thick * 0.6) * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Paired symmetric flank plates on the upper and lower body halves.
 * Used for moderately armored bilateral viruses.
 */
function bilateralFlankPlates(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  armor: number, alpha: number,
): void {
  const arcSpan = Math.PI * (0.28 + armor * 0.14);
  const plateR  = R * 0.91;
  const thick   = R * (0.07 + armor * 0.06);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.44 + armor * 0.18)})`;
  ctx.lineWidth   = thick;
  // Upper plate (centered on UP) and lower plate (centered on DOWN)
  for (const center of [UP, DOWN]) {
    ctx.beginPath();
    ctx.arc(cx, cy, plateR, center - arcSpan, center + arcSpan);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Two symmetric antennae from the forward-top quadrant.
 * Communicates: sensory capability / detection range.
 * Length and spread scale with sensorRadius.
 */
function bilateralAntennae(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  sensorRadius: number, aggression: number, alpha: number,
): void {
  const length     = R * (0.48 + sensorRadius * 0.34);
  const spread     = 0.22 + sensorRadius * 0.12;
  // Aggressive viruses lean antennae slightly forward
  const centerAngle = aggression > 0.55 ? UP + 0.14 : UP;
  const nodeR      = R * (0.042 + sensorRadius * 0.024);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.72})`;
  ctx.lineWidth   = 1.5;

  for (const side of [-1, 1]) {
    const baseAngle = centerAngle + side * spread;
    const bx  = cx + R * 0.78 * Math.cos(baseAngle);
    const by  = cy + R * 0.78 * Math.sin(baseAngle);
    // Slight outward lean at tip
    const tipAngle = baseAngle + side * 0.12;
    const tx  = cx + (R + length) * Math.cos(tipAngle);
    const ty  = cy + (R + length) * Math.sin(tipAngle);

    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    // Sensor node at tip
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.90})`;
    ctx.beginPath(); ctx.arc(tx, ty, nodeR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ─── B. RADIAL structures (N-fold rotational symmetry) ────────────────────────

/**
 * N-fold fins arranged evenly around the body.
 * Count derived from lobes (clamped 3–6).
 */
function radialFins(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  lobes: number, speed: number, alpha: number,
): void {
  const count  = Math.min(lobes, 6);
  const height = R * (0.40 + speed * 0.20);
  const half   = Math.PI / count * 0.38;   // half-angle width of each fin

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.72})`;
  ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.16})`;
  ctx.lineWidth   = 1.5;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const bxL = cx + R * 0.80 * Math.cos(a - half);
    const byL = cy + R * 0.80 * Math.sin(a - half);
    const bxR = cx + R * 0.80 * Math.cos(a + half);
    const byR = cy + R * 0.80 * Math.sin(a + half);
    const tx  = cx + (R + height) * Math.cos(a);
    const ty  = cy + (R + height) * Math.sin(a);

    ctx.beginPath();
    ctx.moveTo(bxL, byL);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bxR, byR);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Concentric armor shell for radially armored viruses.
 * Divides into armor-count shell segments with seam lines.
 */
function radialShell(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  armor: number, lobes: number, alpha: number,
): void {
  const shellR = R * 0.91;
  const thick  = R * (0.09 + armor * 0.09);
  const seams  = Math.min(lobes, 6);

  ctx.save();
  // Main shell ring
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.48 + armor * 0.22)})`;
  ctx.lineWidth   = thick;
  ctx.beginPath(); ctx.arc(cx, cy, shellR, 0, Math.PI * 2); ctx.stroke();
  // Seam lines
  ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.38})`;
  ctx.lineWidth   = 1;
  for (let i = 0; i < seams; i++) {
    const a = (i / seams) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + (shellR - thick * 0.55) * Math.cos(a), cy + (shellR - thick * 0.55) * Math.sin(a));
    ctx.lineTo(cx + (shellR + thick * 0.55) * Math.cos(a), cy + (shellR + thick * 0.55) * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * N-fold radial weapon emitters for melee/pulse radial viruses,
 * or N-fold barrel stubs for ranged radial viruses.
 */
function radialWeapon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  lobes: number, attackStyle: 'melee' | 'pulse' | 'ranged',
  aggression: number, alpha: number,
): void {
  const count = Math.min(lobes, 6);
  ctx.save();

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;

    if (attackStyle === 'ranged') {
      // Short barrel stub pointing outward
      const barrelLen = R * (0.28 + aggression * 0.10);
      const barrelW   = R * 0.06;
      const bx = cx + R * 0.76 * Math.cos(a);
      const by = cy + R * 0.76 * Math.sin(a);
      const ex = cx + (R + barrelLen) * Math.cos(a);
      const ey = cy + (R + barrelLen) * Math.sin(a);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.82})`;
      ctx.lineWidth   = barrelW * 2;
      ctx.lineCap     = 'butt';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineCap     = 'round';
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.95})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.arc(ex, ey, barrelW * 0.85, 0, Math.PI * 2); ctx.stroke();

    } else if (attackStyle === 'melee') {
      // Outward spine (tapered line)
      const spineLen = R * (0.35 + aggression * 0.16);
      const bx = cx + R * 0.82 * Math.cos(a);
      const by = cy + R * 0.82 * Math.sin(a);
      const ex = cx + (R + spineLen) * Math.cos(a);
      const ey = cy + (R + spineLen) * Math.sin(a);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.88})`;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineCap     = 'butt';

    } else {
      // Pulse emitter node at the body surface
      const nodeR = R * 0.10;
      const nx = cx + R * 0.85 * Math.cos(a);
      const ny = cy + R * 0.85 * Math.sin(a);
      ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.42})`;
      ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.62})`;
      ctx.lineWidth   = 1.8;
      ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.20})`;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * N-fold sensor nodes for radial viruses with high sensorRadius.
 * Small bright dots at the body surface, equally spaced.
 */
function radialSensorNodes(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  sensorRadius: number, lobes: number, alpha: number,
): void {
  const count = Math.min(lobes, 8);
  const nodeR = R * (0.042 + sensorRadius * 0.022);
  const dist  = R * 0.88;

  ctx.save();
  for (let i = 0; i < count; i++) {
    const a  = (i / count) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + dist * Math.cos(a);
    const ny = cy + dist * Math.sin(a);
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.88})`;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30})`;
    ctx.lineWidth   = 0.8;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ─── C. ASYMMETRIC structures (deliberate mass imbalance, still directional) ──

/**
 * Single dominant fin on the heavier side of the asymmetric body.
 * Larger than a bilateral fin to emphasize the asymmetry.
 */
function asymmetricFin(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  n: number, speed: number, alpha: number,
): void {
  // Side chosen deterministically by n
  const side   = normalizedHash(n, 37) > 0.5 ? 1 : -1;
  const height = R * (0.55 + speed * 0.28);
  const offA   = side * 0.38;

  const baseAngle = REAR + offA;
  const bx = cx + R * 0.82 * Math.cos(baseAngle);
  const by = cy + R * 0.82 * Math.sin(baseAngle);
  const tipAngle = REAR + side * (Math.abs(offA) + 0.22);
  const tx = cx + (R + height) * Math.cos(tipAngle);
  const ty = cy + (R + height) * Math.sin(tipAngle);
  const inAngle = REAR + side * (Math.abs(offA) - 0.18);
  const ix = cx + R * 0.56 * Math.cos(inAngle);
  const iy = cy + R * 0.56 * Math.sin(inAngle);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.80})`;
  ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.22})`;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(ix, iy);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/**
 * Single dominant weapon on the forward, off-axis side.
 * The asymmetric virus commits its attack capability to one prominent structure.
 */
function asymmetricWeapon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  n: number, attackStyle: 'melee' | 'pulse' | 'ranged',
  aggression: number, mass: number, alpha: number,
): void {
  // Weapon side chosen deterministically (often opposite the fin side)
  const side = normalizedHash(n, 39) > 0.5 ? 1 : -1;
  const offA = side * (0.20 + normalizedHash(n, 41) * 0.14);

  ctx.save();

  if (attackStyle === 'melee') {
    // Single large claw
    const length    = R * (0.50 + aggression * 0.26);
    const baseAngle = FRONT + offA;
    const bx = cx + R * 0.80 * Math.cos(baseAngle);
    const by = cy + R * 0.80 * Math.sin(baseAngle);
    const tipAngle = FRONT + offA * 0.25;
    const tx = cx + (R + length) * Math.cos(tipAngle);
    const ty = cy + (R + length) * Math.sin(tipAngle);
    const barbDir = tipAngle + side * (Math.PI / 2);
    const barbLen = R * 0.18;

    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.92})`;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + barbLen * Math.cos(barbDir), ty + barbLen * Math.sin(barbDir));
    ctx.stroke();
    ctx.lineCap = 'butt';

  } else if (attackStyle === 'ranged') {
    // Single off-axis barrel
    const barrelLength = R * (0.52 + mass * 0.16);
    const barrelWidth  = R * (0.08 + mass * 0.04);
    const angle = FRONT + offA;
    const bx = cx + R * 0.74 * Math.cos(angle);
    const by = cy + R * 0.74 * Math.sin(angle);
    const ex = cx + (R + barrelLength) * Math.cos(angle);
    const ey = cy + (R + barrelLength) * Math.sin(angle);
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.82})`;
    ctx.lineWidth   = barrelWidth * 2;
    ctx.lineCap     = 'butt';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineCap     = 'round';
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.96})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(ex, ey, barrelWidth * 0.90, 0, Math.PI * 2); ctx.stroke();

  } else {
    // Single offset pulse node — heavier and more prominent than bilateral pair
    const nodeR = R * 0.16;
    const angle = side === -1 ? UP + 0.16 : DOWN - 0.16;
    const nx = cx + R * 0.84 * Math.cos(angle);
    const ny = cy + R * 0.84 * Math.sin(angle);
    ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.45})`;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.68})`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.2, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
}

/**
 * Single armor patch on the heavier side of the body.
 * Communicates: partial protection weighted toward the dominant mass.
 */
function asymmetricArmorPatch(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  n: number, armor: number, alpha: number,
): void {
  const side    = normalizedHash(n, 43) > 0.5 ? 1 : -1;
  const center  = side === -1 ? UP + 0.20 : DOWN - 0.20;
  const arcSpan = Math.PI * (0.32 + armor * 0.20);
  const thick   = R * (0.09 + armor * 0.07);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.48 + armor * 0.20)})`;
  ctx.lineWidth   = thick;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.92, center - arcSpan, center + arcSpan);
  ctx.stroke();
  ctx.restore();
}

/**
 * Single forward-biased antenna for asymmetric viruses with sensor capability.
 */
function asymmetricAntenna(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  n: number, sensorRadius: number, alpha: number,
): void {
  const side   = normalizedHash(n, 45) > 0.5 ? -1 : 1;
  const angle  = UP + side * 0.20;
  const length = R * (0.50 + sensorRadius * 0.36);
  const nodeR  = R * (0.044 + sensorRadius * 0.024);

  const bx = cx + R * 0.78 * Math.cos(angle);
  const by = cy + R * 0.78 * Math.sin(angle);
  const tx = cx + (R + length) * Math.cos(angle + side * 0.10);
  const ty = cy + (R + length) * Math.sin(angle + side * 0.10);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.74})`;
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.92})`;
  ctx.beginPath(); ctx.arc(tx, ty, nodeR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  Phenotype renderer — assembles structural layers from phenotype
//
//  Layer order (same for all symmetry types):
//    1. Locomotion  (rear)
//    2. Weapons     (front / perimeter)
//    3. Armor       (perimeter)
//    4. Sensors     (forward-top)
//
//  Refinement gates secondary/tertiary structures.
//  Each symmetry path is self-contained — no cross-path calls.
// ═══════════════════════════════════════════════════════════════════════════════

function drawPhenotypeStructures(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  refinement: number,
): void {
  const r = refinement;

  if (p.symmetry === 'bilateral') {
    // ── BILATERAL PATH ─────────────────────────────────────────────────────────
    //
    // Layer 1: Locomotion (rear)
    //   Always present unless passive; alpha scales with refinement.
    if (p.locomotionType === 'jets') {
      bilateralJets(ctx, cx, cy, R, p.mass, p.speed, 0.55 + r * 0.28);
    } else if (p.locomotionType === 'fins') {
      bilateralFins(ctx, cx, cy, R, p.speed, 0.55 + r * 0.28);
    }
    // passive: silhouette communicates locomotion; no appendages.

    // Layer 2: Weapons (front)
    //   Always present; the dominant visual feature.
    const weapAlpha = 0.65 + r * 0.22;
    if (p.attackStyle === 'melee') {
      bilateralClaws(ctx, cx, cy, R, p.aggression, weapAlpha);
    } else if (p.attackStyle === 'ranged') {
      bilateralBarrels(ctx, cx, cy, R, p.mass, p.sensorRadius, weapAlpha);
    } else {
      bilateralPulseEmitters(ctx, cx, cy, R, weapAlpha);
    }

    // Layer 3: Armor (perimeter)
    //   Appears with refinement; type depends on armor + speed interaction.
    if (p.armor > 0.38 && r > 0.08) {
      const armorAlpha = Math.min(1, (r - 0.08) / 0.40) * 0.62 + 0.18;
      if (p.armor > 0.62) {
        // Heavy armor: full front-arc shield
        bilateralArmorArc(ctx, cx, cy, R, p.armor, armorAlpha);
      } else {
        // Moderate armor: flank plates (don't conflict with front weapons)
        bilateralFlankPlates(ctx, cx, cy, R, p.armor, armorAlpha);
      }
    }

    // Layer 4: Sensors (forward-top)
    //   Appear at moderate refinement when sensor capability justifies them.
    if (p.sensorRadius > 0.40 && r > 0.28) {
      const sensorAlpha = Math.min(1, (r - 0.28) / 0.40) * 0.65 + 0.15;
      bilateralAntennae(ctx, cx, cy, R, p.sensorRadius, p.aggression, sensorAlpha);
    }

  } else if (p.symmetry === 'radial') {
    // ── RADIAL PATH ────────────────────────────────────────────────────────────
    //
    // Layer 1: Locomotion (radial fins)
    //   Only for non-passive; moderate-to-high refinement.
    if (p.locomotionType !== 'passive') {
      const locoAlpha = 0.48 + r * 0.30;
      radialFins(ctx, cx, cy, R, p.lobes, p.speed, locoAlpha);
    }

    // Layer 2: Weapons (N-fold radial)
    //   Present from the start; intensity scales with refinement.
    const weapAlpha = 0.50 + r * 0.32;
    radialWeapon(ctx, cx, cy, R, p.lobes, p.attackStyle, p.aggression, weapAlpha);

    // Layer 3: Armor (concentric shell)
    //   Radial viruses naturally armor via shell rings; always present when armored.
    if (p.armor > 0.30) {
      radialShell(ctx, cx, cy, R, p.armor, p.lobes, 0.50 + r * 0.24);
    }

    // Layer 4: Sensors (N-fold nodes)
    //   Appear at higher refinement for sensitive radial viruses.
    if (p.sensorRadius > 0.48 && r > 0.35) {
      const sensorAlpha = Math.min(1, (r - 0.35) / 0.40) * 0.60 + 0.18;
      radialSensorNodes(ctx, cx, cy, R, p.sensorRadius, p.lobes, sensorAlpha);
    }

  } else {
    // ── ASYMMETRIC PATH ────────────────────────────────────────────────────────
    //
    // Layer 1: Locomotion (single dominant fin)
    if (p.locomotionType !== 'passive') {
      asymmetricFin(ctx, cx, cy, R, p.n, p.speed, 0.58 + r * 0.26);
    }

    // Layer 2: Weapon (single dominant, off-axis)
    //   Always present; asymmetric viruses commit to one strong feature.
    asymmetricWeapon(
      ctx, cx, cy, R, p.n,
      p.attackStyle, p.aggression, p.mass,
      0.68 + r * 0.20,
    );

    // Layer 3: Armor (single-side patch)
    if (p.armor > 0.38 && r > 0.18) {
      const armorAlpha = Math.min(1, (r - 0.18) / 0.42) * 0.58 + 0.18;
      asymmetricArmorPatch(ctx, cx, cy, R, p.n, p.armor, armorAlpha);
    }

    // Layer 4: Sensors (single antenna, forward-biased)
    if (p.sensorRadius > 0.44 && r > 0.32) {
      const sensorAlpha = Math.min(1, (r - 0.32) / 0.40) * 0.62 + 0.15;
      asymmetricAntenna(ctx, cx, cy, R, p.n, p.sensorRadius, sensorAlpha);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 9  Legacy compatibility exports
// ═══════════════════════════════════════════════════════════════════════════════

const ARCHETYPES: VirusArchetype[] = [
  'biological', 'humanoid', 'animal', 'insectoid', 'mechanical',
  'armored', 'crystalline', 'mineral', 'plant', 'synthetic',
  'robotic', 'amorphous', 'geometric', 'energy', 'cybernetic',
  'skeletal', 'fluid',
];

/** @deprecated Use getVirusPhenotype instead. */
export function getVirusModelProfile(value: number): VirusModelProfile {
  const h = (salt: number) => normalizedHash(value, salt);
  const pi = Math.floor(h(1) * ARCHETYPES.length);
  let   si = Math.floor(h(2) * ARCHETYPES.length);
  if (si === pi) si = (si + 1) % ARCHETYPES.length;
  const pw = 0.6 + h(3) * 0.4;
  return {
    primaryArchetype:   ARCHETYPES[pi],
    secondaryArchetype: ARCHETYPES[si],
    primaryWeight:   pw,
    secondaryWeight: 1 - pw,
    structureLevel:   h(4),
    symmetryLevel:    h(5),
    armorLevel:       h(6),
    organicLevel:     h(7),
    mechanicalLevel:  h(8),
    crystallineLevel: h(9),
    energyLevel:      h(10),
  };
}

/** @deprecated Retained for compatibility. */
export function getCompatibilityScore(
  profile: VirusModelProfile,
  model: VirusVisualModel,
  lobes: number,
  symmetryLevel: number,
): number {
  const archetypeMatch =
    model.archetypes.includes(profile.primaryArchetype)   ? 1    :
    model.archetypes.includes(profile.secondaryArchetype) ? 0.5  : 0;
  const minL = model.compatibleFeatures.minLobes ?? 3;
  const maxL = model.compatibleFeatures.maxLobes ?? 8;
  const geometryMatch = lobes >= minL && lobes <= maxL ? 1 : 0;
  const [sMin, sMax] = model.compatibleFeatures.symmetryRange ?? [0, 1];
  const symmetryMatch = symmetryLevel >= sMin && symmetryLevel <= sMax ? 1 : 0;
  void symmetryMatch;  // used in deprecated API only
  return archetypeMatch * 0.40 + geometryMatch * 0.25;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10  Main draw entry point
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draw a virus at canvas coordinates (cx, cy).
 *
 * Pipeline:
 *  1. Polar base body  (primary mass — authoritative silhouette)
 *  2. Class decorations (inner ring / spokes — communicates mathematical class)
 *  3. Phenotype structures (symmetry-driven: locomotion → weapons → armor → sensors)
 *  4. Refinement tiers  (purely additive elaboration as lineage matures)
 *
 * Signature is unchanged from v2; all callers are compatible.
 */
export function drawVirus(
  ctx:       CanvasRenderingContext2D,
  cx:        number,
  cy:        number,
  n:         number,
  cell:      number,
  flash:     boolean,
  green      = false,
  refinement = 0,
): void {
  const cls  = green ? 'even-composite' : getVirusClass(n);
  const fill = green ? (flash ? '#f0fdf4' : '#4ade80')
                     : (flash ? CLASS_FLASH[cls] : CLASS_FILL[cls]);
  const glow = green ? 'rgba(74,222,128,0.50)' : CLASS_GLOW[cls];

  // Refined lineages grow slightly larger (up to +18% at apex)
  const sizeBoost = 1 + refinement * 0.18;
  const R0 = cell * 0.185 * sizeBoost;
  const k  = cell * 0.026;
  const R  = getVirusRadius(n, R0, k);

  // ── 1. Primary mass (base body) ───────────────────────────────────────────────
  buildBodyPath(ctx, cx, cy, n, R);
  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // ── 2. Class decorations (mathematical identity markers) ─────────────────────
  if (!green) {
    if (cls === 'perfect-square' || cls === 'power-of-two') {
      // Inner ring — radial structural marker
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.40, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    if (cls === 'power-of-two') {
      // Second outer ring for binary viruses
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.70, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
    if (cls === 'prime') {
      // Radial spokes for prime viruses (bilateral marker)
      const L = getVirusLobes(n);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth   = 0.8;
      for (let i = 0; i < L; i++) {
        const a = (i / L) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + R * 0.58 * Math.cos(a), cy + R * 0.58 * Math.sin(a));
        ctx.stroke();
      }
    }
  }

  // ── 3. Phenotype structures (symmetry-first, trait-justified) ─────────────────
  if (!flash && !green) {
    const phenotype = getVirusPhenotype(n);
    drawPhenotypeStructures(ctx, cx, cy, R, phenotype, refinement);
  }

  // ── 4. Refinement tiers (purely additive — never overwrites earlier geometry) ─
  if (!flash && !green && refinement > 0.02) {
    const t1 = Math.min(1,                refinement         / 0.30);
    const t2 = Math.min(1, Math.max(0, (refinement - 0.30) / 0.35));
    const t3 = Math.min(1, Math.max(0, (refinement - 0.65) / 0.35));

    // Tier 1 (0→30%): outer structural ring — first visible lineage marker
    ctx.beginPath();
    ctx.arc(cx, cy, R * (1.20 + t1 * 0.06), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${t1 * 0.22})`;
    ctx.lineWidth   = 0.8 + t1 * 0.4;
    ctx.stroke();

    if (t2 > 0) {
      // Tier 2 (30→65%): second ring + luminous inner core
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.40, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${t2 * 0.14})`;
      ctx.lineWidth   = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.20, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${t2 * 0.28})`;
      ctx.fill();
    }

    if (t3 > 0) {
      // Tier 3 (65→100%): apex crown — spines at each lobe peak + corona
      const lobes  = getVirusLobes(n);
      const spread = 0.10;
      ctx.strokeStyle = `rgba(255,255,255,${t3 * 0.55})`;
      ctx.lineWidth   = 1.5;
      for (let i = 0; i < lobes; i++) {
        const a  = (i / lobes) * Math.PI * 2 - Math.PI / 2;
        const r0 = R * 1.10;
        const r1 = R * (1.50 + t3 * 0.20);
        ctx.beginPath();
        ctx.moveTo(cx + r0 * Math.cos(a - spread), cy + r0 * Math.sin(a - spread));
        ctx.lineTo(cx + r1 * Math.cos(a),           cy + r1 * Math.sin(a));
        ctx.moveTo(cx + r0 * Math.cos(a + spread), cy + r0 * Math.sin(a + spread));
        ctx.lineTo(cx + r1 * Math.cos(a),           cy + r1 * Math.sin(a));
        ctx.stroke();
      }
      // Corona glow
      ctx.shadowColor = glow;
      ctx.shadowBlur  = t3 * 18;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${t3 * 0.10})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }
  }
}
