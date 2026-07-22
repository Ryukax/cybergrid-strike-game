/**
 * Virus Morphology Encoding Standard v2 — Procedural Body-Plan Grammar
 *
 * Every virus integer n deterministically decodes into a VirusPhenotype:
 * a structured description of the organism's functional traits.
 * The renderer then assembles the visible body from that phenotype.
 * Every major visible structure answers: "why does this virus look this way?"
 *
 * Rendering pipeline:
 *   n → VirusPhenotype (speed, armor, attack style, locomotion type…)
 *     → Polar base body  (lobe + spike/notch encoding — authoritative silhouette)
 *     → Class decorations (inner rings, spokes)
 *     → Phenotype structural layers:
 *         locomotion (rear) → armor (perimeter) → weapons (front)
 *         → sensors (top) → defensive (front arc) → regen nodes → inner core
 *     → Refinement tiers  (progressive elaboration as lineage matures)
 *
 * In-game orientation:
 *   Viruses move LEFT, so FRONT = angle π (left), REAR = angle 0 (right).
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
  // Derived trait scores, all in [0, 1]
  speed:          number;   // locomotion velocity tendency
  armor:          number;   // defensive plating density
  mass:           number;   // body mass / inertia
  attackRange:    number;   // 0 = melee, 1 = ranged
  sensorRadius:   number;   // detection / tracking capability
  aggression:     number;   // combat orientation
  regen:          number;   // regeneration capacity
  evasion:        number;   // avoidance / shield capacity
  // Structural role assignments (derived from trait combinations)
  symmetry:       'radial' | 'bilateral' | 'asymmetric';
  attackStyle:    'melee' | 'pulse' | 'ranged';
  locomotionType: 'fins' | 'jets' | 'struts' | 'passive';
}

// ─── Legacy types preserved for compatibility ──────────────────────────────────

export type VirusArchetype =
  | 'biological' | 'humanoid' | 'animal' | 'insectoid' | 'mechanical'
  | 'armored' | 'crystalline' | 'mineral' | 'plant' | 'synthetic'
  | 'robotic' | 'amorphous' | 'geometric' | 'energy' | 'cybernetic'
  | 'skeletal' | 'fluid';

export interface VirusModelProfile {
  primaryArchetype:   VirusArchetype;
  secondaryArchetype: VirusArchetype;
  primaryWeight:   number;
  secondaryWeight: number;
  structureLevel:  number;
  symmetryLevel:   number;
  armorLevel:      number;
  organicLevel:    number;
  mechanicalLevel: number;
  crystallineLevel:number;
  energyLevel:     number;
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

/**
 * Deterministic hash: (value, salt) → [0, 1).
 * Same inputs always produce the same output. No RNG at render time.
 */
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

/** L = 3 + (n mod 6) → 3–8 outer lobes */
export function getVirusLobes(n: number): number { return 3 + (n % 6); }

/** R = R₀ + k·log₂(n+1) */
export function getVirusRadius(n: number, R0: number, k: number): number {
  return R0 + k * Math.log2(n + 1);
}

/** 8-bit binary shell: bit_i=1 → spike, bit_i=0 → notch */
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

/**
 * Decode a virus integer into its full functional phenotype.
 * Every call with the same n returns the same result (deterministic).
 */
export function getVirusPhenotype(n: number): VirusPhenotype {
  const h = (salt: number) => normalizedHash(n, salt);
  const cls = getVirusClass(n);
  const lobes = getVirusLobes(n);
  const spikes = getVirusSpikes(n);
  const spikeCount = spikes.filter(Boolean).length;
  const divCount = getDivisorCount(n);

  // ── Speed
  // High spike density → agile/fast. Primes are quick; perfect squares ponderous.
  const rawSpeed = (spikeCount / 8) * 0.55 + h(11) * 0.45;
  const speed =
    cls === 'prime'          ? Math.min(1, rawSpeed * 1.22)
    : cls === 'perfect-square' ? rawSpeed * 0.65
    : rawSpeed;

  // ── Armor
  // Smooth bodies (few spikes) → more surface area for plating.
  const rawArmor = ((8 - spikeCount) / 8) * 0.40 + h(12) * 0.60;
  const armor =
    cls === 'perfect-square' ? 0.45 + rawArmor * 0.45
    : cls === 'power-of-two'  ? 0.30 + h(12) * 0.50
    : cls === 'even-composite'? 0.20 + rawArmor * 0.70
    : rawArmor * 0.72;

  // ── Mass
  // Logarithmic: larger integers feel heavier (more divisors = denser).
  const mass = Math.min(1, 0.15 + (Math.log2(n + 1) / 8) * 0.55 + h(13) * 0.30);

  // ── Attack range (0 = melee … 1 = ranged)
  // Primes favor close-quarters; power-of-two prefer mid-range.
  const rawRange = h(14);
  const attackRange =
    cls === 'prime'         ? rawRange * 0.42
    : cls === 'power-of-two' ? 0.32 + rawRange * 0.48
    : rawRange;

  // ── Sensor radius
  // Divisor-rich numbers (highly composite) have richer sensory geometry.
  const sensorRadius = Math.min(1, (divCount / 14) * 0.55 + h(15) * 0.45);

  // ── Aggression
  // Primes: aggressive hunters. Perfect squares: passive heavyweights.
  const rawAgg = h(16);
  const aggression =
    cls === 'prime'          ? 0.55 + rawAgg * 0.45
    : cls === 'perfect-square' ? rawAgg * 0.42
    : cls === 'odd-composite'  ? 0.18 + rawAgg * 0.66
    : rawAgg;

  // ── Regeneration
  // Highly composite numbers (many divisors) have redundant structures → regen.
  const regen = Math.min(1, (divCount / 12) * 0.62 + h(17) * 0.38);

  // ── Evasion (trade-off with armor; agile OR armored)
  const evasion = Math.min(1, Math.max(0, (1 - armor) * 0.72 + h(18) * 0.44 - 0.12));

  // ── Symmetry type
  const symVal = h(19);
  const symmetry: VirusPhenotype['symmetry'] =
    cls === 'perfect-square' || cls === 'power-of-two' ? 'radial'
    : cls === 'prime'                                   ? 'bilateral'
    : symVal < 0.28 ? 'asymmetric'
    : symVal < 0.68 ? 'radial'
    : 'bilateral';

  // ── Attack style
  const attackStyle: VirusPhenotype['attackStyle'] =
    attackRange < 0.33 ? 'melee'
    : attackRange > 0.66 ? 'ranged'
    : 'pulse';

  // ── Locomotion type (trait interaction: speed × mass)
  const locomotionType: VirusPhenotype['locomotionType'] =
    speed > 0.62 && mass > 0.60 ? 'jets'    // heavy+fast → thrust jets
    : speed > 0.55               ? 'fins'    // light+fast → swept fins
    : mass > 0.72                ? 'struts'  // very heavy → stabilizer struts
    : 'passive';

  return {
    n, cls, lobes, spikes, spikeCount,
    speed, armor, mass, attackRange, sensorRadius,
    aggression, regen, evasion,
    symmetry, attackStyle, locomotionType,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  Polar base body  (authoritative silhouette — never changed by grammar)
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
  steps = 192,
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
// § 7  Structural grammar — individual shape primitives
//
//  In-game orientation:
//    FRONT = Math.PI    (viruses move LEFT — leading edge)
//    REAR  = 0          (trailing edge, right in canvas)
//    UP    = -Math.PI/2 (top of body in canvas)
//
//  Each function:
//    - saves/restores ctx state
//    - draws at positions relative to (cx, cy) with radius R
//    - accepts an `alpha` opacity scalar [0, 1]
//    - is pure/deterministic (no Math.random, only normalizedHash)
// ═══════════════════════════════════════════════════════════════════════════════

const FRONT = Math.PI;
const REAR  = 0;
const UP    = -Math.PI / 2;

// ── A. Locomotion structures (rear of body) ───────────────────────────────────

/** Swept-back fins for fast, light viruses. */
function grammarFins(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  speed: number, mass: number, alpha: number,
): void {
  const count = speed > 0.78 ? 3 : 2;
  const height = R * (0.38 + speed * 0.28 - mass * 0.10);
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.70})`;
  ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.12})`;
  ctx.lineWidth   = 1.3;
  const spread = count === 3 ? 0.42 : 0.26;
  for (let i = 0; i < count; i++) {
    const off = count < 2 ? 0 : (i / (count - 1) - 0.5) * spread * 2;
    const baseAngle = REAR + off;
    const bx = cx + R * 0.74 * Math.cos(baseAngle);
    const by = cy + R * 0.74 * Math.sin(baseAngle);
    // tip swept backward and slightly outward
    const tipOff = off + (off > 0 ? 0.28 : off < 0 ? -0.28 : 0.20);
    const tx = cx + (R + height) * Math.cos(REAR + tipOff);
    const ty = cy + (R + height) * Math.sin(REAR + tipOff);
    // inner edge slightly inward from base
    const inOff = off + (off >= 0 ? -0.16 : 0.16);
    const ix = cx + R * 0.58 * Math.cos(REAR + inOff);
    const iy = cy + R * 0.58 * Math.sin(REAR + inOff);
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

/** Circular propulsion jets for heavy+fast viruses. */
function grammarJets(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  mass: number, speed: number, alpha: number,
): void {
  const count = mass > 0.78 ? 3 : 2;
  const portR = R * (0.072 + mass * 0.038);
  const spread = count === 3 ? 0.33 : 0.20;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const off = count < 2 ? 0 : (i / (count - 1) - 0.5) * spread * 2;
    const angle = REAR + off;
    const dist = R * (0.84 + mass * 0.06);
    const px = cx + dist * Math.cos(angle);
    const py = cy + dist * Math.sin(angle);
    // Port outer ring
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.72})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(px, py, portR, 0, Math.PI * 2); ctx.stroke();
    // Inner glow disc
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.22})`;
    ctx.beginPath(); ctx.arc(px, py, portR * 0.52, 0, Math.PI * 2); ctx.fill();
    // Exhaust cone
    if (speed > 0.55) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.18})`;
      ctx.lineWidth = 0.8;
      const ex = cx + (dist + portR * 2.5) * Math.cos(angle);
      const ey = cy + (dist + portR * 2.5) * Math.sin(angle);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Stabilizer struts for very heavy, slow viruses. */
function grammarStruts(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  mass: number, alpha: number,
): void {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.40})`;
  ctx.lineWidth = 1.5;
  // Four splayed ground-struts, like landing legs
  [-0.55, -0.20, 0.20, 0.55].forEach(off => {
    const angle = REAR + Math.PI / 2 + off; // spread below and above rear
    const bx = cx + R * 0.65 * Math.cos(REAR + off);
    const by = cy + R * 0.65 * Math.sin(REAR + off);
    const ex = cx + (R + R * 0.30) * Math.cos(angle);
    const ey = cy + (R + R * 0.30) * Math.sin(angle);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    // Foot pad
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.30})`;
    ctx.beginPath(); ctx.arc(ex, ey, R * 0.045, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ── B. Armor structures (perimeter) ──────────────────────────────────────────

/** Overlapping armor plates around the body perimeter. */
function grammarArmorPlates(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  armor: number, speed: number, lobes: number, alpha: number,
): void {
  // High speed + armor → plates concentrate at the front (forward-facing shield)
  // Low speed → full perimeter coverage
  const frontBiased = speed > 0.58;
  const plateCount = frontBiased
    ? Math.max(2, Math.round(lobes * 0.65))
    : lobes;
  const coverage = frontBiased ? 0.55 : 0.88;  // fraction of circumference covered
  const totalArc  = Math.PI * 2 * coverage;
  const plateArc  = totalArc / plateCount;
  const gap       = plateArc * 0.10;
  const startAngle = frontBiased ? FRONT - totalArc / 2 : -Math.PI / 2;
  const plateRadius = R * 0.91;
  const plateWidth  = R * (0.09 + armor * 0.09);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.48 + armor * 0.22)})`;
  ctx.lineWidth   = plateWidth;
  for (let i = 0; i < plateCount; i++) {
    const a0 = startAngle + i * plateArc + gap;
    const a1 = startAngle + (i + 1) * plateArc - gap;
    ctx.beginPath(); ctx.arc(cx, cy, plateRadius, a0, a1); ctx.stroke();
  }
  ctx.restore();
}

/** Full circumferential shell for very heavily armored viruses. */
function grammarArmorShell(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  armor: number, alpha: number,
): void {
  ctx.save();
  // Main shell ring
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.52})`;
  ctx.lineWidth   = R * (0.11 + armor * 0.10);
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.90, 0, Math.PI * 2); ctx.stroke();
  // Seam lines dividing the shell into plates
  ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.40})`;
  ctx.lineWidth   = 0.9;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.83 * Math.cos(a), cy + R * 0.83 * Math.sin(a));
    ctx.lineTo(cx + R * 0.97 * Math.cos(a), cy + R * 0.97 * Math.sin(a));
    ctx.stroke();
  }
  // Inner shell detail ring
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.18})`;
  ctx.lineWidth   = 0.8;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** Streamlined fairing for high-speed + high-armor viruses (no bulky plates). */
function grammarStreamlinedFairing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  speed: number, armor: number, alpha: number,
): void {
  ctx.save();
  // Protective forward arc — armor aligned with direction of travel
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.38 + armor * 0.18)})`;
  ctx.lineWidth   = R * (0.06 + armor * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.94, FRONT - 0.52, FRONT + 0.52);
  ctx.stroke();
  // Speed-line fairings along the body flanks
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.18})`;
  ctx.lineWidth   = 0.8;
  [-0.28, 0.28].forEach(off => {
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.72 * Math.cos(FRONT + off), cy + R * 0.72 * Math.sin(FRONT + off));
    ctx.lineTo(cx + R * 0.72 * Math.cos(REAR  + off), cy + R * 0.72 * Math.sin(REAR  + off));
    ctx.stroke();
  });
  ctx.restore();
}

// ── C. Weapon structures (front of body) ─────────────────────────────────────

/** Blade/claw appendages for melee-focused viruses. */
function grammarMeleeClaws(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  aggression: number, alpha: number,
): void {
  const count  = aggression > 0.70 ? 3 : 2;
  const length = R * (0.30 + aggression * 0.24);
  const spread = 0.32;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.78})`;
  ctx.lineWidth   = 1.5;
  for (let i = 0; i < count; i++) {
    const off = count < 2 ? 0 : (i / (count - 1) - 0.5) * spread * 2;
    const baseAngle = FRONT + off;
    const bx  = cx + R * 0.76 * Math.cos(baseAngle);
    const by  = cy + R * 0.76 * Math.sin(baseAngle);
    // tip: extends forward with slight inward hook
    const tipAngle = FRONT + off * 0.45;
    const tx  = cx + (R + length) * Math.cos(tipAngle);
    const ty  = cy + (R + length) * Math.sin(tipAngle);
    // barb: perpendicular to claw, hooking inward
    const hookDir = off >= 0 ? 1 : -1;
    const hAngle  = tipAngle + hookDir * (Math.PI / 2);
    const hx = tx + R * 0.13 * Math.cos(hAngle);
    const hy = ty + R * 0.13 * Math.sin(hAngle);
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(hx, hy);
    ctx.stroke();
  }
  ctx.restore();
}

/** Curved mandibles for high-aggression melee viruses. */
function grammarMandibles(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  aggression: number, alpha: number,
): void {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.62})`;
  ctx.lineWidth   = 1.8;
  [-0.44, 0.44].forEach(off => {
    const a0 = FRONT + off;
    const aMid = FRONT + off * 0.40;
    const aTip = FRONT + off * 1.15 + (off > 0 ? 0.30 : -0.30);
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.62 * Math.cos(a0), cy + R * 0.62 * Math.sin(a0));
    ctx.quadraticCurveTo(
      cx + (R + R * 0.48) * Math.cos(aMid), cy + (R + R * 0.48) * Math.sin(aMid),
      cx + (R + R * 0.26) * Math.cos(aTip), cy + (R + R * 0.26) * Math.sin(aTip),
    );
    ctx.stroke();
  });
  ctx.restore();
}

/** Elongated weapon barrels for ranged viruses. */
function grammarRangedBarrels(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  mass: number, sensorRadius: number, alpha: number,
): void {
  const count        = sensorRadius > 0.65 ? 3 : mass > 0.60 ? 1 : 2;
  const barrelLength = R * (0.36 + mass * 0.20);
  const barrelHalf   = R * (0.055 + mass * 0.038);
  const spread       = count === 3 ? 0.26 : count === 2 ? 0.16 : 0;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread * 2;
    const angle = FRONT + off;
    const bx = cx + R * 0.68 * Math.cos(angle);
    const by = cy + R * 0.68 * Math.sin(angle);
    const ex = cx + (R + barrelLength) * Math.cos(angle);
    const ey = cy + (R + barrelLength) * Math.sin(angle);
    // Barrel shaft (thick stroke = rectangular barrel)
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.72})`;
    ctx.lineWidth   = barrelHalf * 2;
    ctx.lineCap     = 'butt';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineCap     = 'round';
    // Emitter ring at muzzle
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.88})`;
    ctx.lineWidth   = 1.3;
    ctx.beginPath(); ctx.arc(ex, ey, barrelHalf * 0.78, 0, Math.PI * 2); ctx.stroke();
    // Stabilizer mount flanges (heavier mass = wider)
    if (mass > 0.48) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.28})`;
      ctx.lineWidth   = 0.8;
      const midX = (bx + ex) / 2;
      const midY = (by + ey) / 2;
      const perp  = angle + Math.PI / 2;
      const fSize = barrelHalf * 2.0;
      [1, -1].forEach(side => {
        ctx.beginPath();
        ctx.moveTo(midX + fSize * side * Math.cos(perp), midY + fSize * side * Math.sin(perp));
        ctx.lineTo(bx  + fSize * side * 0.5 * Math.cos(perp), by  + fSize * side * 0.5 * Math.sin(perp));
        ctx.stroke();
      });
    }
  }
  ctx.restore();
}

/** Radial pulse-burst emitter nodes for mid-range viruses. */
function grammarPulseNodes(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  lobes: number, alpha: number,
): void {
  const count = Math.min(lobes, 5);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + R * 0.83 * Math.cos(angle);
    const ny = cy + R * 0.83 * Math.sin(angle);
    const nr = R * 0.072;
    // Node fill
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.35})`;
    ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
    // Emitter ring
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.26})`;
    ctx.lineWidth   = 0.9;
    ctx.beginPath(); ctx.arc(nx, ny, nr * 1.75, 0, Math.PI * 2); ctx.stroke();
    // Spoke to center
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.15})`;
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.28 * Math.cos(angle), cy + R * 0.28 * Math.sin(angle));
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }
  ctx.restore();
}

// ── D. Sensor structures ──────────────────────────────────────────────────────

/** Thin antennae extending from the top of the body. */
function grammarAntennae(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  sensorRadius: number, aggression: number, alpha: number,
): void {
  const count  = sensorRadius > 0.72 ? 4 : sensorRadius > 0.50 ? 3 : 2;
  const length = R * (0.42 + sensorRadius * 0.32);
  // Aggressive viruses lean antennae slightly forward
  const baseAngle = aggression > 0.55 ? UP + 0.18 : UP;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.68})`;
  ctx.lineWidth   = 0.9;
  const totalSpread = 0.50;
  for (let i = 0; i < count; i++) {
    const off = count < 2 ? 0 : (i / (count - 1) - 0.5) * totalSpread;
    const a   = baseAngle + off;
    const bx  = cx + R * 0.76 * Math.cos(a);
    const by  = cy + R * 0.76 * Math.sin(a);
    // Slight lean outward at tip
    const ta  = a + off * 0.18;
    const tx  = cx + (R + length) * Math.cos(ta);
    const ty  = cy + (R + length) * Math.sin(ta);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    // Tip sensor node
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`;
    ctx.beginPath();
    ctx.arc(tx, ty, R * (0.038 + sensorRadius * 0.028), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Eye-like sensory nodes near the front of the body. */
function grammarEyeArray(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  sensorRadius: number, alpha: number,
): void {
  const count = sensorRadius > 0.72 ? 3 : 2;
  const eyeR  = R * (0.058 + sensorRadius * 0.030);
  // Eyes cluster near front-upper quadrant
  const positions: [number, number][] =
    count >= 3
      ? [[-0.21, -0.26], [0.01, -0.36], [0.21, -0.26]]
      : [[-0.16, -0.30], [0.16, -0.30]];
  ctx.save();
  positions.forEach(([dx, dy]) => {
    const ex = cx + R * dx;
    const ey = cy + R * dy;
    // Outer eye socket
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.78})`;
    ctx.lineWidth   = 1.1;
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.stroke();
    // Directional pupil (slightly forward-biased)
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.88})`;
    ctx.beginPath();
    ctx.arc(ex - eyeR * 0.18, ey, eyeR * 0.42, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ── E. Defensive structures ────────────────────────────────────────────────────

/** Partial arc shield at front for evasive viruses. */
function grammarShieldArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  evasion: number, alpha: number,
): void {
  const coverage = 0.22 + evasion * 0.44;  // arc half-angle in radians
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.42 + evasion * 0.28)})`;
  ctx.lineWidth   = R * (0.07 + evasion * 0.04);
  ctx.beginPath();
  ctx.arc(cx, cy, R * (0.98 + evasion * 0.06), FRONT - coverage, FRONT + coverage);
  ctx.stroke();
  // Secondary inner arc at lower opacity
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.15})`;
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, R * (0.86 + evasion * 0.04), FRONT - coverage * 0.7, FRONT + coverage * 0.7);
  ctx.stroke();
  ctx.restore();
}

// ── F. Regeneration structures ────────────────────────────────────────────────

/** Visible growth nodes — redundant structural clusters indicating regen. */
function grammarRegenNodes(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  regen: number, lobes: number, alpha: number,
): void {
  const count = Math.round(2 + regen * 4);  // 2–6 nodes
  ctx.save();
  for (let i = 0; i < count; i++) {
    const a    = (i / count) * Math.PI * 2 - Math.PI / 2;
    const dist = R * (0.68 + normalizedHash(i * 7, 19) * 0.18);
    const nx   = cx + dist * Math.cos(a);
    const ny   = cy + dist * Math.sin(a);
    const nr   = R * (0.040 + regen * 0.038 + normalizedHash(i, 23) * 0.018);
    // Node body
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.42})`;
    ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
    // Growth halo
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.17})`;
    ctx.lineWidth   = 0.7;
    ctx.beginPath(); ctx.arc(nx, ny, nr * 1.85, 0, Math.PI * 2); ctx.stroke();
  }
  // Connecting filaments
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.12})`;
  ctx.lineWidth   = 0.6;
  for (let i = 0; i < Math.min(count - 1, 5); i++) {
    const a0 = (i / count) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / count) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.72 * Math.cos(a0), cy + R * 0.72 * Math.sin(a0));
    ctx.lineTo(cx + R * 0.72 * Math.cos(a1), cy + R * 0.72 * Math.sin(a1));
    ctx.stroke();
  }
  ctx.restore();
}

/** Visible segmentation lines for regen+armor viruses (replaceable plates). */
function grammarSegmentation(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  lobes: number, alpha: number,
): void {
  const segCount = Math.min(lobes, 5);
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.20})`;
  ctx.lineWidth   = 0.8;
  ctx.setLineDash([2, 3]);
  for (let i = 0; i < segCount; i++) {
    const a = (i / segCount) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.30 * Math.cos(a), cy + R * 0.30 * Math.sin(a));
    ctx.lineTo(cx + R * 0.90 * Math.cos(a), cy + R * 0.90 * Math.sin(a));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

// ── G. Mutation / advanced detail structures ──────────────────────────────────

/** Inner core — visible reactor or nucleus for energy-dense viruses. */
function grammarInnerCore(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  intensity: number, alpha: number,
): void {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.38})`;
  ctx.lineWidth   = 1.1;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.26, 0, Math.PI * 2); ctx.stroke();
  if (intensity > 0.58) {
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.16})`;
    ctx.fill();
    // Inner crosshair
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.18, cy); ctx.lineTo(cx + R * 0.18, cy); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * 0.18); ctx.lineTo(cx, cy + R * 0.18); ctx.stroke();
  }
  ctx.restore();
}

/** Asymmetric protrusion for highly asymmetric forms (visible mutation). */
function grammarAsymmetricProtrusion(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  n: number, alpha: number,
): void {
  // Placed at a deterministically chosen angle (varies by n)
  const angle  = normalizedHash(n, 41) * Math.PI * 2;
  const length = R * (0.22 + normalizedHash(n, 43) * 0.18);
  const width  = R * (0.08 + normalizedHash(n, 47) * 0.06);
  const bx = cx + R * 0.80 * Math.cos(angle);
  const by = cy + R * 0.80 * Math.sin(angle);
  const ex = cx + (R + length) * Math.cos(angle);
  const ey = cy + (R + length) * Math.sin(angle);
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.50})`;
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.lineCap     = 'butt';
  // Tip node
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.60})`;
  ctx.beginPath(); ctx.arc(ex, ey, width * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  Phenotype renderer — assembles structural layers from phenotype
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draw all phenotype-derived structural elements on top of the base body.
 * Layer order:
 *   locomotion (rear) → armor (perimeter) → weapons (front)
 *   → sensors (top) → defensive (front arc) → regen → core → mutations
 *
 * `refinement` [0,1] gates secondary/tertiary structures — early in a lineage's
 * life only the dominant trait structure appears; elaboration comes with maturity.
 */
function drawPhenotypeStructures(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  refinement: number,
): void {
  const r = refinement;  // shorthand

  // ── Layer 1: Locomotion (rear of body) ──────────────────────────────────────
  const locoAlpha = 0.52 + r * 0.28;
  if (p.locomotionType === 'fins') {
    grammarFins(ctx, cx, cy, R, p.speed, p.mass, locoAlpha);
  } else if (p.locomotionType === 'jets') {
    grammarJets(ctx, cx, cy, R, p.mass, p.speed, locoAlpha);
  } else if (p.locomotionType === 'struts') {
    grammarStruts(ctx, cx, cy, R, p.mass, locoAlpha);
  }
  // passive: body silhouette carries the locomotion signal; no appendages

  // ── Layer 2: Armor (perimeter) ───────────────────────────────────────────────
  const armorAlpha = 0.50 + r * 0.22;
  if (p.armor > 0.75) {
    // Very heavy armor → full enclosing shell
    grammarArmorShell(ctx, cx, cy, R, p.armor, armorAlpha);
  } else if (p.armor > 0.50) {
    if (p.speed > 0.58) {
      // Speed + armor → streamlined fairing (no bulky plates)
      grammarStreamlinedFairing(ctx, cx, cy, R, p.speed, p.armor, armorAlpha);
    } else {
      grammarArmorPlates(ctx, cx, cy, R, p.armor, p.speed, p.lobes, armorAlpha);
    }
  }

  // ── Layer 3: Weapons (front of body) ─────────────────────────────────────────
  const weapAlpha = 0.58 + r * 0.26;
  if (p.attackStyle === 'melee') {
    grammarMeleeClaws(ctx, cx, cy, R, p.aggression, weapAlpha);
    // Mandibles appear on aggressive melee viruses; more prominent with refinement
    if (p.aggression > 0.68 && r > 0.22) {
      grammarMandibles(ctx, cx, cy, R, p.aggression, (r - 0.22) / 0.78 * 0.55 + 0.20);
    }
  } else if (p.attackStyle === 'ranged') {
    grammarRangedBarrels(ctx, cx, cy, R, p.mass, p.sensorRadius, weapAlpha);
    // Stabilizer struts for heavy ranged platforms
    if (p.mass > 0.58 && r > 0.30) {
      const strutAlpha = (r - 0.30) / 0.70 * 0.35 + 0.15;
      // Draw two bracing struts from body flanks to barrel mount area
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${strutAlpha})`;
      ctx.lineWidth   = 1;
      [UP - 0.28, UP + 0.28].forEach(a => {
        ctx.beginPath();
        ctx.moveTo(cx + R * 0.55 * Math.cos(a),    cy + R * 0.55 * Math.sin(a));
        ctx.lineTo(cx + R * 0.82 * Math.cos(FRONT), cy + R * 0.82 * Math.sin(FRONT));
        ctx.stroke();
      });
      ctx.restore();
    }
  } else {
    // Pulse: radial emitter nodes
    grammarPulseNodes(ctx, cx, cy, R, p.lobes, 0.48 + r * 0.24);
  }

  // ── Layer 4: Sensors (top of body, forward lean for aggressive) ──────────────
  // Primary antennae appear when sensorRadius is high OR refinement unlocks them
  const sensorGate = p.sensorRadius > 0.44 || r > 0.22;
  if (sensorGate) {
    const sensorContrib = Math.max(0, p.sensorRadius - 0.28);
    const sensorAlpha   = sensorContrib * 0.72 + r * 0.28;
    if (sensorAlpha > 0.08) {
      grammarAntennae(ctx, cx, cy, R, p.sensorRadius, p.aggression, sensorAlpha);
      // Eye array: high sensor + refinement > 0.3
      if (p.sensorRadius > 0.60 && r > 0.30) {
        grammarEyeArray(ctx, cx, cy, R, p.sensorRadius, sensorAlpha * 0.68);
      }
    }
  }

  // ── Layer 5: Defensive shield arc ────────────────────────────────────────────
  if (p.evasion > 0.42) {
    grammarShieldArc(ctx, cx, cy, R, p.evasion, 0.44 + r * 0.26);
  }

  // ── Layer 6: Regeneration indicators ─────────────────────────────────────────
  if (p.regen > 0.38) {
    grammarRegenNodes(ctx, cx, cy, R, p.regen, p.lobes, 0.33 + r * 0.32);
    // Segmentation lines: regen + armor combination
    if (p.regen > 0.48 && p.armor > 0.32 && r > 0.20) {
      grammarSegmentation(ctx, cx, cy, R, p.lobes, 0.22 + r * 0.26);
    }
  }

  // ── Layer 7: Inner core (energy/tracking-intense viruses) ────────────────────
  const coreSignal = p.sensorRadius * 0.35 + p.regen * 0.30 + p.attackRange * 0.35;
  if (coreSignal > 0.48 && r > 0.28) {
    grammarInnerCore(ctx, cx, cy, R, coreSignal, (coreSignal - 0.38) * 0.55 + r * 0.20);
  }

  // ── Layer 8: Asymmetric mutation (refinement ≥ 0.55, asymmetric lineages) ────
  if (p.symmetry === 'asymmetric' && r > 0.55) {
    grammarAsymmetricProtrusion(ctx, cx, cy, R, p.n, (r - 0.55) / 0.45 * 0.55);
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

/** @deprecated Use getVirusPhenotype instead. Retained for compatibility. */
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
  return archetypeMatch * 0.40 + geometryMatch * 0.25 + symmetryMatch * 0.15;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10  Main draw entry point
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draw a virus at canvas coordinates (cx, cy).
 *
 * Rendering pipeline:
 *  1. Polar base body (lobe + spike/notch — authoritative silhouette)
 *  2. Class decorations (inner ring for power-of-two/square; spokes for prime)
 *  3. Phenotype structural layers (locomotion → armor → weapons → sensors → …)
 *  4. Refinement tiers (progressive elaboration as lineage matures)
 */
export function drawVirus(
  ctx:       CanvasRenderingContext2D,
  cx:        number,
  cy:        number,
  n:         number,
  cell:      number,
  flash:     boolean,
  green      = false,
  refinement = 0,    // 0 = fresh spawn · 1 = fully evolved apex form
): void {
  const cls  = green ? 'even-composite' : getVirusClass(n);
  const fill = green ? (flash ? '#f0fdf4' : '#4ade80')
                     : (flash ? CLASS_FLASH[cls] : CLASS_FILL[cls]);
  const glow = green ? 'rgba(74,222,128,0.50)' : CLASS_GLOW[cls];

  // Refined lineages grow slightly larger (up to +20% at apex)
  const sizeBoost = 1 + refinement * 0.20;
  const R0 = cell * 0.185 * sizeBoost;
  const k  = cell * 0.026;
  const R  = getVirusRadius(n, R0, k);

  // ── 1. Base body ──────────────────────────────────────────────────────────────
  buildBodyPath(ctx, cx, cy, n, R);
  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // ── 2. Class decorations ──────────────────────────────────────────────────────
  if (!green) {
    if (cls === 'perfect-square' || cls === 'power-of-two') {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.40, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    if (cls === 'prime') {
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
    if (cls === 'power-of-two') {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.70, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }

  // ── 3. Phenotype structural layers ────────────────────────────────────────────
  if (!flash && !green) {
    const phenotype = getVirusPhenotype(n);
    drawPhenotypeStructures(ctx, cx, cy, R, phenotype, refinement);
  }

  // ── 4. Refinement visual tiers ────────────────────────────────────────────────
  // These sit on top of everything, marking the lineage's evolutionary maturity.
  if (!flash && !green && refinement > 0.02) {
    const t1 = Math.min(1,                refinement         / 0.30);
    const t2 = Math.min(1, Math.max(0, (refinement - 0.30) / 0.35));
    const t3 = Math.min(1, Math.max(0, (refinement - 0.65) / 0.35));

    // Tier 1 (0→30%): outer structural ring — first visible mark of refinement
    ctx.beginPath();
    ctx.arc(cx, cy, R * (1.22 + t1 * 0.06), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${t1 * 0.22})`;
    ctx.lineWidth   = 0.8 + t1 * 0.4;
    ctx.stroke();

    if (t2 > 0) {
      // Tier 2 (30→65%): second ring + inner luminous core
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.42, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${t2 * 0.14})`;
      ctx.lineWidth   = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
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
        const r0 = R * 1.12;
        const r1 = R * (1.52 + t3 * 0.20);
        ctx.beginPath();
        ctx.moveTo(cx + r0 * Math.cos(a - spread), cy + r0 * Math.sin(a - spread));
        ctx.lineTo(cx + r1 * Math.cos(a),           cy + r1 * Math.sin(a));
        ctx.moveTo(cx + r0 * Math.cos(a + spread), cy + r0 * Math.sin(a + spread));
        ctx.lineTo(cx + r1 * Math.cos(a),           cy + r1 * Math.sin(a));
        ctx.stroke();
      }
      // Corona glow
      ctx.shadowColor = glow;
      ctx.shadowBlur  = t3 * 20;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${t3 * 0.10})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }
  }
}
