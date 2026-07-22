/**
 * Virus Morphology v4 — Architecture-First Body Plan
 *
 * Design hierarchy (per spec):
 *   Functional Traits → Body Architecture → Mass Layout → Body Topology
 *   → Attachment Anchors → Functional Structures → Refinement
 *
 * The body is no longer a universal decorated blob.  Each virus's primary
 * silhouette is derived directly from its phenotype traits.
 *
 * Ten body architectures (selected deterministically, never randomly):
 *   compact        — broad armored hub; nearly circular
 *   elongated      — strong front-rear axis; speed-optimised
 *   forwardWeighted — teardrop with large attack-facing mass; pursuit predator
 *   rearWeighted   — reversed teardrop; heavy propulsion, narrow attack tip
 *   segmented      — three connected structural masses; regenerative lineages
 *   ring           — annular mass distribution; radial defensive hub
 *   radialCore     — regular polygon; balanced radial attacker
 *   splitCore      — two vertically offset masses; asymmetric composites
 *   winged         — narrow central body with swept lateral surfaces; evasive
 *   shielded       — flat-front D-shape; forward-facing armoured wall
 *
 * Structural grammar is anchor-driven: attachment positions are derived from
 * the body's actual geometry, not from ad-hoc trig from a nominal radius.
 *
 * In-game orientation: viruses move LEFT.
 *   FRONT = Math.PI  (left  — leading edge / attack direction)
 *   REAR  = 0        (right — trailing edge)
 *   UP    = -π/2     (top of canvas body)
 *   DOWN  = +π/2     (bottom)
 */

const TAU = Math.PI * 2;
const FRONT = Math.PI;
const REAR  = 0;
const UP    = -Math.PI / 2;
const DOWN  =  Math.PI / 2;

/**
 * Silhouette debug mode.
 * When true, drawVirus() renders only the primary body as flat white, no glow,
 * no structures, no refinement.  Use drawSilhouetteDebugGrid() to see all 10.
 */
export const MORPHOLOGY_SILHOUETTE_DEBUG = false;

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  Types
// ═══════════════════════════════════════════════════════════════════════════════

export type VirusClass =
  | 'prime'
  | 'power-of-two'
  | 'perfect-square'
  | 'even-composite'
  | 'odd-composite';

/**
 * Chassis types — functional combat roles that determine geometry.
 * Each chassis communicates role, facing direction, and capability
 * through silhouette alone.  Traits determine component engineering
 * variables (barrel length, shell thickness, fin sweep, etc.), not
 * random shape perturbation.
 */
export type ChassisType =
  | 'interceptor'   // fast pursuit: torpedo body + swept fins + nose spike + engine
  | 'striker'       // aggressive melee: forward wedge + compact body + rear drive
  | 'artillery'     // long-range: large rear mass + core + long forward barrel
  | 'tank'          // armored: thick shell annulus + protected core + short gun
  | 'rammer'        // frontal impact: large arrowhead + compact rear body
  | 'turret'        // radial attack: hub + multiple directional gun barrels
  | 'carrier'       // regenerative: large body + lateral pod ports
  | 'swarm'         // small fast: minimal two-component anatomy
  | 'controller'    // area control: hub + 3 long arms with emitter nodes
  | 'adaptive';     // asymmetric: core + one dominant functional arm

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
  chassis:        ChassisType;
}

/**
 * Geometric description of the constructed body.
 * All distances from (cx, cy) in canvas pixels.
 * Structural grammar functions use these instead of the nominal R.
 */
interface BodyGeometry {
  /** How far the body surface extends toward FRONT (left). */
  frontReach: number;
  /** How far the body surface extends toward REAR (right). */
  rearReach:  number;
  /** How far the body surface extends toward UP/DOWN. */
  sideReach:  number;
  /** Nominal R passed in — used for sizing appendages (lineWidth etc.). */
  R:          number;
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

/**
 * Derive chassis type from gameplay traits.  Deterministic — no randomness.
 *
 * Priority order: ranged specialists → radial roles → armored/heavy →
 * mass+aggression → speed → regen → melee → asymmetric fallback.
 *
 * Each chassis maps to a distinct combat role whose anatomy communicates
 * that role through silhouette alone.
 */
function deriveChassis(
  symmetry: VirusPhenotype['symmetry'],
  attackStyle: VirusPhenotype['attackStyle'],
  p: {
    speed: number; armor: number; mass: number; regen: number;
    evasion: number; aggression: number; attackRange: number;
    sensorRadius: number;
  },
): ChassisType {
  // Radial symmetry → turret (aggressive hub) or controller (area node)
  if (symmetry === 'radial') {
    return p.attackRange > 0.52 ? 'controller' : 'turret';
  }

  // Long-range specialist → artillery (barrel IS the silhouette)
  if (p.attackRange > 0.66) return 'artillery';

  // Heavy armor, low mobility → tank (shell IS the silhouette)
  if (p.armor > 0.60 && p.speed < 0.48) return 'tank';

  // Heavy + aggressive + mobile → rammer (arrowhead IS the silhouette)
  if (p.mass > 0.56 && p.aggression > 0.54 && p.speed > 0.34) return 'rammer';

  // Fast + lightweight → swarm (tiny, replicable)
  if (p.speed > 0.60 && p.mass < 0.40) return 'swarm';

  // Regenerative + mass → carrier (body cavity IS the silhouette)
  if (p.regen > 0.56 && p.mass > 0.38 && p.speed < 0.55) return 'carrier';

  // Fast + evasive → interceptor (torpedo silhouette)
  if (p.speed > 0.52 && p.evasion > 0.26) return 'interceptor';

  // Aggressive melee → striker (wedge IS the silhouette)
  if (p.aggression > 0.58 && attackStyle === 'melee') return 'striker';

  // Asymmetric → adaptive (one dominant feature)
  if (symmetry === 'asymmetric') return 'adaptive';

  // Bilateral fallbacks by dominant trait
  if (p.aggression > 0.50) return 'striker';
  if (p.armor > 0.44)      return 'tank';
  if (p.regen > 0.44)      return 'carrier';
  return 'interceptor';
}

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

  // Symmetry — determined once; drives chassis selection.
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

  // Locomotion type (retained for legacy compatibility).
  const locomotionType: VirusPhenotype['locomotionType'] =
    speed > 0.62 && mass > 0.60 ? 'jets'
    : speed > 0.50               ? 'fins'
    : 'passive';

  // Chassis — derived from all traits above.
  const chassis = deriveChassis(symmetry, attackStyle, {
    speed, armor, mass, regen, evasion, aggression, attackRange, sensorRadius,
  });

  return {
    n, cls, lobes, spikes, spikeCount,
    speed, armor, mass, attackRange, sensorRadius,
    aggression, regen, evasion,
    symmetry, attackStyle, locomotionType, chassis,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  Chassis rendering — one function per combat role
//
//  Each chassis function renders ALL of its anatomy in one call:
//    propulsion → core → armor → weapon
//  (drawn back-to-front so weapon is topmost/most prominent)
//
//  Engineering variables scale with gameplay traits — not random perturbation.
//  Every component has a functional reason:
//    barrel   → ranged attack delivery
//    shell    → armor protection
//    wedge    → frontal impact weapon
//    fin      → lateral stability / maneuverability
//    pod      → spawning / regen port
//    arm+node → area emitter
//
//  At R ≈ 12px gameplay scale, role and facing must be readable from
//  silhouette alone.  Minimum 3 screen pixels per structural component.
// ═══════════════════════════════════════════════════════════════════════════════

/** Fill the current canvas path as a chassis component. */
function applyBodyFill(
  ctx:   CanvasRenderingContext2D,
  fill:  string,
  glow:  string,
  flash: boolean,
  debug: boolean = false,
): void {
  if (debug) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.60)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    return;
  }
  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.24)';
  ctx.lineWidth   = 1.2;
  ctx.stroke();
}

// ─── Component primitive helpers ──────────────────────────────────────────────

/** Filled circle component. */
function compCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);
}

/** Filled rectangle component. */
function compRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  applyBodyFill(ctx, fill, glow, flash, debug);
}

/** Filled triangle component (three vertices). */
function compTri(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);
}

// ─── Mechanical drawing primitives ──────────────────────────────────────────
//
//  v6 rule: every chassis is a MECHANICAL PART ASSEMBLY.
//  Use only these discrete named shapes — no organic continuous outlines.
//  Parts must be separated by a visible gap (G ≥ 2px at gameplay scale).

/**
 * Rounded-corner rectangle, centered at (cx, cy).
 * cornerR = 0 → sharp rect;  cornerR = min(w,h)/2 → capsule/pill.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number, cornerR: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): void {
  const x = cx - w / 2, y = cy - h / 2;
  const r = Math.min(Math.abs(cornerR), w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h,     x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r, y,         r);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);
}

/**
 * Filled bar: axis runs from (x1,y1) to (x2,y2), half-width hw perpendicular.
 * Used for gun barrels, struts, structural connectors.
 */
function drawBar(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number, hw: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): void {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return;
  const px = (-dy / len) * hw, py = (dx / len) * hw;
  ctx.beginPath();
  ctx.moveTo(x1 + px, y1 + py);
  ctx.lineTo(x2 + px, y2 + py);
  ctx.lineTo(x2 - px, y2 - py);
  ctx.lineTo(x1 - px, y1 - py);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);
}

/**
 * Filled wedge: sharp tip at (tipX,tipY), flat base centered at (baseX,baseY),
 * half-width hw perpendicular to the tip→base axis.
 * Used for nose cones, ramming prows, forward weapons.
 */
function drawWedge(
  ctx: CanvasRenderingContext2D,
  tipX: number, tipY: number, baseX: number, baseY: number, hw: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): void {
  const dx = baseX - tipX, dy = baseY - tipY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return;
  const px = (-dy / len) * hw, py = (dx / len) * hw;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX + px, baseY + py);
  ctx.lineTo(baseX - px, baseY - py);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);
}

// ─── Chassis 1: INTERCEPTOR ──────────────────────────────────────────────────
//
//  Mandatory anatomy:  narrow hull  ·  2 lateral wings  ·  1 engine pod  ·  nose spike
//
//  [SPIKE]──[══════HULL-CAPSULE══════]──[ENGINE]
//                    [LEFT-WING]
//                    [RIGHT-WING]
//
//  FRONT = left.  Hull is a 4:1 elongated capsule.
//  Wings are flat rectangular plates at the rear half, clearly separate from hull.
//  Engine is a detached circle at the very rear.
//  Spike is a detached wedge at the very front.
//
function drawChassisInterceptor(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.20, 2.2);

  const hW = R * 2.20, hH = R * 0.54;
  const hFront = cx - hW / 2, hRear = cx + hW / 2;

  // 1. Hull — elongated capsule
  drawRoundedRect(ctx, cx, cy, hW, hH, hH / 2, fill, glow, flash, debug);

  // 2. Wings — flat rect plates, at rear half, perpendicular
  const wingW = R * (0.45 + p.evasion * 0.15);
  const wingH = Math.max(R * 0.28, 3.5);
  const wingCX = cx + R * 0.30;
  const wingCY = hH / 2 + G + wingH / 2;
  drawRoundedRect(ctx, wingCX, cy - wingCY, wingW, wingH, wingH * 0.25, fill, glow, flash, debug);
  drawRoundedRect(ctx, wingCX, cy + wingCY, wingW, wingH, wingH * 0.25, fill, glow, flash, debug);

  // 3. Engine pod — detached circle at rear
  const engR = Math.max(R * 0.27, 3.5);
  const engX  = hRear + G + engR;
  compCircle(ctx, engX, cy, engR, fill, glow, flash, debug);

  // 4. Nose spike — detached wedge at front (weapon, drawn last)
  const spkLen = R * (0.36 + p.aggression * 0.18);
  const spkHW  = Math.max(R * 0.22, 2.8);
  drawWedge(ctx, hFront - G - spkLen, cy, hFront - G, cy, spkHW, fill, glow, flash, debug);

  return {
    frontReach: cx - (hFront - G - spkLen),
    rearReach:  engX + engR - cx,
    sideReach:  wingCY + wingH / 2,
    R,
  };
}

// ─── Chassis 2: STRIKER ──────────────────────────────────────────────────────
//
//  Mandatory anatomy:  compact hull  ·  large forward wedge weapon  ·  engine block
//
//  [WEDGE]──[HULL]──[ENGINE-BLOCK]
//
//  Wedge is the melee weapon — dominant, clearly forward-facing.
//  Engine block is taller than wide, visibly different from hull.
//
function drawChassisStriker(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.20, 2.2);

  const hW = R * 1.06, hH = R * 0.90;
  const hullCX = cx + R * 0.14;
  const hFront = hullCX - hW / 2, hRear = hullCX + hW / 2;

  // 1. Hull — compact rect
  drawRoundedRect(ctx, hullCX, cy, hW, hH, R * 0.15, fill, glow, flash, debug);

  // 2. Engine block — separate, taller than wide (propulsion signature)
  const engW = Math.max(R * 0.36, 5.0), engH = R * 0.58;
  const engCX = hRear + G + engW / 2;
  drawRoundedRect(ctx, engCX, cy, engW, engH, R * 0.10, fill, glow, flash, debug);

  // 3. Forward weapon wedge — dominant (drawn last)
  const wLen = R * (0.90 + p.aggression * 0.28);
  const wHW  = R * (0.52 + p.mass * 0.08);
  drawWedge(ctx, hFront - G - wLen, cy, hFront - G, cy, wHW, fill, glow, flash, debug);

  return {
    frontReach: cx - (hFront - G - wLen),
    rearReach:  engCX + engW / 2 - cx,
    sideReach:  Math.max(hH / 2, wHW),
    R,
  };
}

// ─── Chassis 3: ARTILLERY ────────────────────────────────────────────────────
//
//  Mandatory anatomy:  very long barrel  ·  small mount  ·  large rear mass
//  Barrel ≥ 40% of total entity length.
//
//  [BARREL══════════════════]──[MOUNT]──[REAR-MASS]
//
function drawChassisArtillery(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.20, 2.2);

  // 1. Rear recoil mass — large circle
  const massR  = R * (0.58 + p.mass * 0.14);
  const massCX = cx + massR * 0.76;
  compCircle(ctx, massCX, cy, massR, fill, glow, flash, debug);

  // 2. Barrel mount — small connector
  const mntW = R * 0.28, mntH = R * 0.44;
  const mntCX = cx - mntW * 0.18;
  drawRoundedRect(ctx, mntCX, cy, mntW, mntH, R * 0.08, fill, glow, flash, debug);

  // 3. Barrel — dominant weapon (drawn last)
  const barLen = R * (1.40 + p.attackRange * 0.82);
  const barHW  = Math.max(R * 0.17, 2.2);
  const barS   = mntCX - mntW / 2 - G;
  drawBar(ctx, barS, cy, barS - barLen, cy, barHW, fill, glow, flash, debug);

  return {
    frontReach: cx - (barS - barLen),
    rearReach:  massCX + massR - cx,
    sideReach:  massR,
    R,
  };
}

// ─── Chassis 4: TANK ─────────────────────────────────────────────────────────
//
//  Mandatory anatomy:  armor plates (wider than hull)  ·  hull  ·  short gun
//
//  [TOP-ARMOR-PLATE — wider than hull]
//  [         HULL         ] [GUN──>]
//  [BOTTOM-ARMOR-PLATE]
//
function drawChassisTank(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.18, 2.0);

  const hullW = R * 1.16, hullH = R * 0.96;
  const platW = hullW + R * (0.22 + p.armor * 0.12);
  const platH = Math.max(R * 0.27, 3.5);
  const platCY = hullH / 2 + platH / 2 + 1;

  // 1. Armor plates — visibly wider than hull (clamping effect)
  drawRoundedRect(ctx, cx, cy - platCY, platW, platH, platH * 0.20, fill, glow, flash, debug);
  drawRoundedRect(ctx, cx, cy + platCY, platW, platH, platH * 0.20, fill, glow, flash, debug);

  // 2. Hull — near-square
  drawRoundedRect(ctx, cx, cy, hullW, hullH, R * 0.14, fill, glow, flash, debug);

  // 3. Short gun stub — exits front face of hull
  const gunLen = R * (0.44 + p.aggression * 0.14);
  const gunHW  = Math.max(R * 0.18, 2.5);
  const gunS   = cx - hullW / 2 - G;
  drawBar(ctx, gunS, cy, gunS - gunLen, cy, gunHW, fill, glow, flash, debug);

  return {
    frontReach: hullW / 2 + G + gunLen,
    rearReach:  hullW / 2,
    sideReach:  platCY + platH / 2,
    R,
  };
}

// ─── Chassis 5: RAMMER ───────────────────────────────────────────────────────
//
//  Mandatory anatomy:  wide reinforced prow  ·  compact hull  ·  2 drive pods
//  Prow is LARGER and WIDER than striker's wedge — blunt impact, not a spike.
//
//  [══PROW══]──[HULL]
//               [LDRIVE][RDRIVE]
//
function drawChassisRammer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.20, 2.2);

  const hW = R * 0.92, hH = R * 0.78;
  const hullCX = cx + R * 0.22;
  const hFront = hullCX - hW / 2, hRear = hullCX + hW / 2;

  // 1. Hull
  drawRoundedRect(ctx, hullCX, cy, hW, hH, R * 0.12, fill, glow, flash, debug);

  // 2. Drive pods — two circles at rear flanks
  const dR = Math.max(R * 0.23, 3.2);
  const dY = hH * 0.32, dX = hRear + G + dR;
  compCircle(ctx, dX, cy - dY, dR, fill, glow, flash, debug);
  compCircle(ctx, dX, cy + dY, dR, fill, glow, flash, debug);

  // 3. Ramming prow — big, wide wedge (drawn last)
  const pLen = R * (1.22 + p.mass * 0.28);
  const pHW  = R * (0.64 + p.aggression * 0.10);
  drawWedge(ctx, hFront - G - pLen, cy, hFront - G, cy, pHW, fill, glow, flash, debug);

  return {
    frontReach: cx - (hFront - G - pLen),
    rearReach:  dX + dR - cx,
    sideReach:  Math.max(hH / 2, pHW),
    R,
  };
}

// ─── Chassis 6: TURRET ───────────────────────────────────────────────────────
//
//  Mandatory anatomy:  square base  ·  rotating hub  ·  4 gun barrels
//  Barrels are DISCRETE RECTANGULAR BARS — not lobes, not petals.
//
//       [GUN-N]
//  [GUN-W][BASE+HUB][GUN-E]
//       [GUN-S]
//
function drawChassisTurret(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.18, 2.0);
  const base = R * 0.86;
  const hubR  = R * 0.30;

  // 1. Base plate — square mounting platform
  drawRoundedRect(ctx, cx, cy, base, base, R * 0.12, fill, glow, flash, debug);

  // 2. Hub — circular rotating mount
  compCircle(ctx, cx, cy, hubR, fill, glow, flash, debug);

  // 3. Gun barrels — 4 rectangular bars, each with a visible gap from hub
  const gLen = R * (0.62 + p.attackRange * 0.28);
  const gHW  = Math.max(R * 0.15, 2.2);
  for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    const cos = Math.cos(a), sin = Math.sin(a);
    drawBar(
      ctx,
      cx + cos * (hubR + G),         cy + sin * (hubR + G),
      cx + cos * (hubR + G + gLen),  cy + sin * (hubR + G + gLen),
      gHW, fill, glow, flash, debug,
    );
  }

  const reach = hubR + G + gLen;
  return { frontReach: reach, rearReach: reach, sideReach: reach, R };
}

// ─── Chassis 7: CARRIER ──────────────────────────────────────────────────────
//
//  Mandatory anatomy:  large hull  ·  3 deployment pods  ·  2 rear engines
//
//  [FPOD]──[══════════HULL══════════]──[LENG]
//          [TPOD]          [BPOD]       [RENG]
//
function drawChassisCarrier(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.20, 2.5);
  const hW = R * 1.72, hH = R * 1.14;
  const hFront = cx - hW / 2, hRear = cx + hW / 2;

  // 1. Twin engines — detached circles at rear
  const engR = Math.max(R * 0.21, 3.0);
  const engY = hH * 0.30, engX = hRear + G + engR;
  compCircle(ctx, engX, cy - engY, engR, fill, glow, flash, debug);
  compCircle(ctx, engX, cy + engY, engR, fill, glow, flash, debug);

  // 2. Hull — large body
  drawRoundedRect(ctx, cx, cy, hW, hH, R * 0.18, fill, glow, flash, debug);

  // 3. Deployment pods — detached circles at hull perimeter
  const podR = Math.max(R * (0.22 + p.regen * 0.06), 3.5);
  compCircle(ctx, hFront - G - podR,    cy,                      podR, fill, glow, flash, debug); // front
  compCircle(ctx, cx - R * 0.18,        cy - (hH / 2 + G + podR), podR, fill, glow, flash, debug); // top
  compCircle(ctx, cx - R * 0.18,        cy + (hH / 2 + G + podR), podR, fill, glow, flash, debug); // bottom

  return {
    frontReach: cx - (hFront - G - podR - podR),
    rearReach:  engX + engR - cx,
    sideReach:  hH / 2 + G + podR * 2,
    R,
  };
}

// ─── Chassis 8: SWARM ────────────────────────────────────────────────────────
//
//  Mandatory anatomy:  body  ·  front spike  ·  rear nub
//  Minimal three-part assembly — compact, expendable, clearly directional.
//
//  [SPIKE]──[BODY]──[NUB]
//
function drawChassisSwarm(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.18, 2.0);

  const bodyR = R * 0.50;
  compCircle(ctx, cx, cy, bodyR, fill, glow, flash, debug);

  // Rear propulsion nub
  const nubR = Math.max(R * 0.20, 2.8);
  compCircle(ctx, cx + bodyR + G + nubR, cy, nubR, fill, glow, flash, debug);

  // Front spike — thin bar (weapon)
  const spkL = R * (0.26 + p.aggression * 0.14);
  const spkHW = Math.max(R * 0.13, 2.0);
  drawBar(ctx, cx - bodyR - G, cy, cx - bodyR - G - spkL, cy, spkHW, fill, glow, flash, debug);

  return {
    frontReach: bodyR + G + spkL,
    rearReach:  bodyR + G + nubR * 2,
    sideReach:  bodyR,
    R,
  };
}

// ─── Chassis 9: CONTROLLER ───────────────────────────────────────────────────
//
//  Mandatory anatomy:  hub  ·  3 arms (Y-shape)  ·  3 emitter nodes
//  Forward arm (FRONT=left) is LONGER than the two rear arms — establishes facing.
//
//  [FWDNODE]════════[HUB]
//                  /    \
//           [LNODE]      [RNODE]
//
function drawChassisController(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G    = Math.max(R * 0.18, 2.0);
  const hubR = R * 0.30;
  const fLen = R * (0.82 + p.attackRange * 0.40);  // forward arm — longer
  const sLen = R * (0.56 + p.attackRange * 0.22);  // side arms — shorter
  const aHW  = Math.max(R * 0.13, 2.0);
  const fNR  = Math.max(R * 0.22, 3.0);
  const sNR  = Math.max(R * 0.18, 2.8);

  const FWD  = FRONT;
  const LARM = FRONT - TAU / 3;
  const RARM = FRONT + TAU / 3;

  // 1. Arms (under hub and nodes)
  for (const [angle, len] of [[FWD, fLen], [LARM, sLen], [RARM, sLen]] as [number, number][]) {
    drawBar(
      ctx,
      cx + Math.cos(angle) * (hubR + G),        cy + Math.sin(angle) * (hubR + G),
      cx + Math.cos(angle) * (hubR + G + len),   cy + Math.sin(angle) * (hubR + G + len),
      aHW, fill, glow, flash, debug,
    );
  }

  // 2. Hub
  compCircle(ctx, cx, cy, hubR, fill, glow, flash, debug);

  // 3. Emitter nodes
  compCircle(
    ctx,
    cx + Math.cos(FWD) * (hubR + G + fLen), cy + Math.sin(FWD) * (hubR + G + fLen),
    fNR, fill, glow, flash, debug,
  );
  for (const angle of [LARM, RARM]) {
    compCircle(
      ctx,
      cx + Math.cos(angle) * (hubR + G + sLen), cy + Math.sin(angle) * (hubR + G + sLen),
      sNR, fill, glow, flash, debug,
    );
  }

  const fReach = hubR + G + fLen + fNR;
  const sReach = hubR + G + sLen + sNR;
  return { frontReach: fReach, rearReach: sReach, sideReach: sReach, R };
}

// ─── Chassis 10: ADAPTIVE ────────────────────────────────────────────────────
//
//  Tank + Artillery hybrid: armor-plated hull with a medium barrel.
//  Reads as neither a pure tank nor pure artillery — a recognizable crossover.
//
//  [TOP-ARMOR]
//  [HULL][BARREL══]
//  [BOTTOM-ARMOR]
//
function drawChassisAdaptive(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const G = Math.max(R * 0.20, 2.2);

  const hullW = R * 1.06, hullH = R * 0.90;
  const platW = hullW + R * (0.18 + p.armor * 0.10);
  const platH = Math.max(R * 0.24, 3.0);
  const platCY = hullH / 2 + platH / 2 + 1;

  // 1. Armor plates — tank element
  drawRoundedRect(ctx, cx, cy - platCY, platW, platH, platH * 0.20, fill, glow, flash, debug);
  drawRoundedRect(ctx, cx, cy + platCY, platW, platH, platH * 0.20, fill, glow, flash, debug);

  // 2. Hull
  drawRoundedRect(ctx, cx, cy, hullW, hullH, R * 0.14, fill, glow, flash, debug);

  // 3. Forward barrel — artillery element (medium length, drawn last)
  const barLen = R * (0.72 + p.attackRange * 0.36);
  const barHW  = Math.max(R * 0.17, 2.2);
  const barS   = cx - hullW / 2 - G;
  drawBar(ctx, barS, cy, barS - barLen, cy, barHW, fill, glow, flash, debug);

  return {
    frontReach: hullW / 2 + G + barLen,
    rearReach:  hullW / 2,
    sideReach:  platCY + platH / 2,
    R,
  };
}

// ─── Chassis dispatcher ───────────────────────────────────────────────────────

function drawChassis(
  ctx:   CanvasRenderingContext2D,
  cx:    number, cy: number, R: number,
  p:     VirusPhenotype,
  fill:  string, glow: string, flash: boolean,
  debug: boolean = false,
): BodyGeometry {
  switch (p.chassis) {
    case 'interceptor': return drawChassisInterceptor(ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'striker':     return drawChassisStriker    (ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'artillery':   return drawChassisArtillery  (ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'tank':        return drawChassisTank        (ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'rammer':      return drawChassisRammer      (ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'turret':      return drawChassisTurret      (ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'carrier':     return drawChassisCarrier     (ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'swarm':       return drawChassisSwarm       (ctx, cx, cy, R, p, fill, glow, flash, debug);
    case 'controller':  return drawChassisController  (ctx, cx, cy, R, p, fill, glow, flash, debug);
    default:            return drawChassisAdaptive    (ctx, cx, cy, R, p, fill, glow, flash, debug);
  }
}

// ─── Silhouette debug grid — GAMEPLAY SCALE ──────────────────────────────────
//
//  Renders all 10 chassis at R=15px — actual gameplay entity size.
//  This is an honest acceptance test, not a misleading large-scale render.
//
//  Acceptance criteria (no colors, no glow, solid white on black):
//    A. Role recognition: fast / heavy / ranged / ramming / carrier / turret
//       distinguishable without labels.
//    B. Facing recognition: FRONT direction obvious for every directional chassis.
//    C. Structural recognition: weapon, engine, armor individually pointable.

const CHASSIS_PREVIEW_TRAITS: Record<ChassisType, Partial<VirusPhenotype>> = {
  interceptor: { speed: 0.72, evasion: 0.55, aggression: 0.52, attackRange: 0.22, armor: 0.22, mass: 0.28, regen: 0.28, sensorRadius: 0.40 },
  striker:     { aggression: 0.82, mass: 0.56, speed: 0.52, attackRange: 0.18, armor: 0.32, regen: 0.26, evasion: 0.28, sensorRadius: 0.32 },
  artillery:   { attackRange: 0.88, mass: 0.62, speed: 0.22, aggression: 0.32, armor: 0.38, regen: 0.28, evasion: 0.16, sensorRadius: 0.55 },
  tank:        { armor: 0.82, mass: 0.66, speed: 0.20, aggression: 0.36, attackRange: 0.32, regen: 0.40, evasion: 0.10, sensorRadius: 0.32 },
  rammer:      { mass: 0.78, aggression: 0.74, speed: 0.46, attackRange: 0.20, armor: 0.44, regen: 0.26, evasion: 0.20, sensorRadius: 0.28 },
  turret:      { aggression: 0.68, attackRange: 0.52, mass: 0.52, speed: 0.24, armor: 0.56, regen: 0.36, evasion: 0.16, sensorRadius: 0.44 },
  carrier:     { regen: 0.80, mass: 0.62, speed: 0.28, aggression: 0.22, armor: 0.40, attackRange: 0.25, evasion: 0.20, sensorRadius: 0.44 },
  swarm:       { speed: 0.74, mass: 0.24, aggression: 0.50, attackRange: 0.26, armor: 0.18, regen: 0.20, evasion: 0.46, sensorRadius: 0.28 },
  controller:  { attackRange: 0.75, sensorRadius: 0.70, mass: 0.40, speed: 0.28, aggression: 0.38, armor: 0.38, regen: 0.44, evasion: 0.18 },
  adaptive:    { armor: 0.52, attackRange: 0.55, mass: 0.48, speed: 0.40, aggression: 0.48, regen: 0.36, evasion: 0.28, sensorRadius: 0.40 },
};

export function drawSilhouetteDebugGrid(
  ctx:    CanvasRenderingContext2D,
  width:  number,
  height: number,
): void {
  const chassis: ChassisType[] = [
    'interceptor', 'striker', 'artillery', 'rammer', 'swarm',
    'tank',        'turret',  'carrier',   'controller', 'adaptive',
  ];

  const cols = 5, rows = 2;
  const cellW = width / cols, cellH = height / rows;

  // ── GAMEPLAY-SCALE RADIUS ─────────────────────────────────────────────────
  // Actual gameplay: cell≈64px → R0=11.8, typical R≈14–18px.
  // We use R=15 here — an honest test of what the player sees.
  const R = 15;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font      = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`R=${R}px  (gameplay scale)`, 8, height - 8);

  chassis.forEach((ch, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx  = cellW * (col + 0.5);
    const cy  = cellH * (row + 0.5) - 14;

    const p: VirusPhenotype = {
      n: 7, cls: 'prime', lobes: 5, spikes: [], spikeCount: 3,
      speed: 0.5, armor: 0.5, mass: 0.5, attackRange: 0.5,
      sensorRadius: 0.5, aggression: 0.5, regen: 0.5, evasion: 0.5,
      symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins',
      chassis: ch,
      ...CHASSIS_PREVIEW_TRAITS[ch],
    };

    drawChassis(ctx, cx, cy, R, p, '#fff', 'transparent', false, true);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font      = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ch, cx, cy + R * 3.2 + 10);
  });
}


// §7 structural grammar and §8 phenotype renderer have been removed.
// ─────────────────────────────────────────────────────────────────────────────

// (intentional placeholder — do not remove; consumed below)
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
    structureLevel:  h(4),
    symmetryLevel:   h(5),
    armorLevel:      h(6),
    organicLevel:    h(7),
    mechanicalLevel: h(8),
    crystallineLevel:h(9),
    energyLevel:     h(10),
  };
}

/** @deprecated Retained for compatibility. */
export function getCompatibilityScore(
  profile: VirusModelProfile,
  model: VirusVisualModel,
  lobes: number,
  _symmetryLevel: number,
): number {
  const archetypeMatch =
    model.archetypes.includes(profile.primaryArchetype)   ? 1   :
    model.archetypes.includes(profile.secondaryArchetype) ? 0.5 : 0;
  const minL = model.compatibleFeatures.minLobes ?? 3;
  const maxL = model.compatibleFeatures.maxLobes ?? 8;
  const geometryMatch = lobes >= minL && lobes <= maxL ? 1 : 0;
  return archetypeMatch * 0.40 + geometryMatch * 0.25;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10  Main draw entry point
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draw a virus at canvas coordinates (cx, cy).
 *
 * Pipeline:
 *  1. Derive phenotype (includes architecture, symmetry, all traits)
 *  2. Draw primary body (architecture-specific silhouette — the authoritative shape)
 *  3. Class decorations (mathematical identity markers)
 *  4. Phenotype structures (anchor-driven: locomotion → weapons → armor → sensors)
 *  5. Refinement tiers (purely additive elaboration as lineage matures)
 *
 * Signature is unchanged from v2/v3; all callers are compatible.
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

  // ── 1. Derive phenotype (chassis + all gameplay traits) ────────────────────
  const phenotype = getVirusPhenotype(n);

  // ── 2. Draw chassis — ALL anatomy in one call (weapon + propulsion + armor) ─
  const geo = drawChassis(ctx, cx, cy, R, phenotype, fill, glow, flash, MORPHOLOGY_SILHOUETTE_DEBUG);

  // Debug mode: body-only silhouette, no decorations or structures.
  if (MORPHOLOGY_SILHOUETTE_DEBUG) return;

  // ── 3. Class decoration (mathematical identity markers) ─────────────────────
  //  Only concentric rings — no radial spokes (they create flower silhouettes).
  if (!green && !flash) {
    const effectiveR = (geo.frontReach + geo.rearReach + geo.sideReach) / 3;
    if (cls === 'perfect-square' || cls === 'power-of-two') {
      // Subtle inner ring only — does not create star/flower pattern
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR * 0.40, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth   = 1.2;
      ctx.stroke();
    }
    if (cls === 'power-of-two') {
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR * 0.65, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }
    // NOTE: Prime spokes removed — they created radial flower silhouettes
    //       that dominated the chassis shape at gameplay scale.
  }

  // ── 4. Refinement tiers (purely additive) ────────────────────────────────────
  //  (Structural grammar removed in v5 — anatomy is now folded into chassis renderers.
  //   Refinement tiers remain as purely additive elaboration on top of the chassis.)
  if (!flash && !green && refinement > 0.02) {
    const effectiveR = (geo.frontReach + geo.rearReach + geo.sideReach) / 3;
    const t1 = Math.min(1,                refinement         / 0.30);
    const t2 = Math.min(1, Math.max(0, (refinement - 0.30) / 0.35));
    const t3 = Math.min(1, Math.max(0, (refinement - 0.65) / 0.35));

    // Tier 1: outer structural ring
    ctx.beginPath();
    ctx.arc(cx, cy, effectiveR * (1.22 + t1 * 0.06), 0, TAU);
    ctx.strokeStyle = `rgba(255,255,255,${t1 * 0.22})`;
    ctx.lineWidth   = 0.8 + t1 * 0.4;
    ctx.stroke();

    if (t2 > 0) {
      // Tier 2: second ring + inner core luminance
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR * 1.42, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${t2 * 0.14})`;
      ctx.lineWidth   = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR * 0.20, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${t2 * 0.28})`;
      ctx.fill();
    }

    if (t3 > 0) {
      // Tier 3: apex corona glow (no radial spines — they create flower patterns)
      ctx.shadowColor = glow;
      ctx.shadowBlur  = t3 * 18;
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR * 1.10, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${t3 * 0.14})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}
