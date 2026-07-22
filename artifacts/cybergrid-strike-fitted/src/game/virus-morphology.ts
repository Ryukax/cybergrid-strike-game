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

// ─── v7 Authored Sprite Assembly ─────────────────────────────────────────────
//
//  Design rule: chassis shapes are EXPLICIT POLYGON DATA, not algorithmic paths.
//  Every polygon vertex was placed intentionally at a specific visual position.
//
//  Visual scale:  su = R * 1.4  (sprite-unit, pixels per unit-grid step)
//  At R=14 (typical gameplay):  su ≈ 19.6 px
//  At R=20 (boss):              su ≈ 28.0 px
//
//  Unit grid:  origin = entity pivot (cx, cy)
//              FRONT  = negative X (left)   REAR = positive X (right)
//
//  Aspect ratios are NON-UNIFORM — do not normalize to the same radius.
//    interceptor   3.8 × 1.8  units  (very elongated)
//    artillery     3.6 × 1.0  units  (weapon-dominated, barrel length ≥ 40%)
//    tank          2.2 × 2.2  units  (nearly square, layered)
//    rammer        2.4 × 1.9  units  (forward-heavy triangle)
//    carrier       3.2 × 2.6  units  (wide bay structure)
//
//  Visual radius for BodyGeometry is computed from ACTUAL polygon extents,
//  not from the collision R.  Collision boxes remain at R.

type Pt = readonly [number, number];

// ── Low-level sprite draw ops  ─────────────────────────────────────────────────
//    All coordinates are in unit-grid space; `su` converts to canvas pixels.

/** Filled polygon in unit-grid space. */
function spPoly(
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  cx: number, cy: number, su: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
  alpha = 1.0,
): void {
  if (pts.length < 2) return;
  const prev = ctx.globalAlpha;
  if (alpha < 1.0) ctx.globalAlpha = prev * alpha;
  ctx.beginPath();
  ctx.moveTo(cx + pts[0][0] * su, cy + pts[0][1] * su);
  for (let i = 1; i < pts.length; i++)
    ctx.lineTo(cx + pts[i][0] * su, cy + pts[i][1] * su);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);
  ctx.globalAlpha = prev;
}

/** Filled rect in unit-grid space (corners given). */
function spRect(
  ctx: CanvasRenderingContext2D,
  ux0: number, uy0: number, ux1: number, uy1: number,
  cx: number, cy: number, su: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
  alpha = 1.0,
): void {
  spPoly(ctx,
    [[ux0, uy0], [ux1, uy0], [ux1, uy1], [ux0, uy1]],
    cx, cy, su, fill, glow, flash, debug, alpha);
}

/** Filled circle in unit-grid space. */
function spCirc(
  ctx: CanvasRenderingContext2D,
  ucx: number, ucy: number, ur: number,
  cx: number, cy: number, su: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
  alpha = 1.0,
): void {
  const prev = ctx.globalAlpha;
  if (alpha < 1.0) ctx.globalAlpha = prev * alpha;
  ctx.beginPath();
  ctx.arc(cx + ucx * su, cy + ucy * su, Math.max(ur * su, 1.5), 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);
  ctx.globalAlpha = prev;
}

/** Filled bar (rect with axis from point1 to point2). */
function spBar(
  ctx: CanvasRenderingContext2D,
  ux1: number, uy1: number, ux2: number, uy2: number, uhw: number,
  cx: number, cy: number, su: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
  alpha = 1.0,
): void {
  const dx = ux2 - ux1, dy = uy2 - uy1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return;
  const px = (-dy / len) * uhw, py = (dx / len) * uhw;
  spPoly(ctx,
    [[ux1 + px, uy1 + py], [ux2 + px, uy2 + py],
     [ux2 - px, uy2 - py], [ux1 - px, uy1 - py]],
    cx, cy, su, fill, glow, flash, debug, alpha);
}

// ─── Chassis 1: INTERCEPTOR ──────────────────────────────────────────────────
//
//  Shape language: thin · angular · swept · rear-heavy propulsion · sharp axis
//  NO central circle.  The FUSELAGE POLYGON is the primary shape.
//
//  Layer order:  engine nozzle → fuselage → wings → nose spike
//
//  Unit-grid bounding box at design scale:
//    X: −1.52 (nose spike tip) → +0.88 (engine rear)   ≈ 2.40 units
//    Y: −0.98 (wing tip)       → +0.98                  ≈ 1.96 units
//  At R=14, su=19.6 → sprite ≈ 47 × 38 px
//
function drawChassisInterceptor(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: engine nozzle — circle at rear, behind fuselage
  spCirc(ctx, 0.76, 0, 0.24, cx, cy, su, fill, glow, flash, debug, 0.70);

  // Layer 2: main fuselage — narrow angular polygon, NO central mass
  //   Nose at left (−X = FRONT), wider toward rear
  spPoly(ctx, [
    [-1.10,  0.00],   // nose tip (FRONT)
    [-0.78, -0.22],   // upper nose
    [-0.22, -0.38],   // upper forward
    [ 0.28, -0.40],   // upper mid
    [ 0.68, -0.30],   // upper rear shoulder
    [ 0.76, -0.12],   // rear upper connect
    [ 0.76,  0.12],   // rear lower connect
    [ 0.68,  0.30],   // lower rear shoulder
    [ 0.28,  0.40],   // lower mid
    [-0.22,  0.38],   // lower forward
    [-0.78,  0.22],   // lower nose
  ], cx, cy, su, fill, glow, flash, debug);

  // Layer 3: swept wing plates — two flat rect plates at hull rear
  //   Clearly separate from fuselage (above/below, wider than body)
  spPoly(ctx, [                              // UPPER wing
    [-0.08, -0.40], [ 0.62, -0.40],
    [ 0.78, -0.98], [-0.08, -0.98],
  ], cx, cy, su, fill, glow, flash, debug, 0.88);
  spPoly(ctx, [                              // LOWER wing
    [-0.08,  0.40], [ 0.62,  0.40],
    [ 0.78,  0.98], [-0.08,  0.98],
  ], cx, cy, su, fill, glow, flash, debug, 0.88);

  // Layer 4: nose spike — sharp weapon extending ahead of fuselage
  spPoly(ctx, [
    [-1.52,  0.00],   // spike tip
    [-1.10, -0.12],   // base upper
    [-1.10,  0.12],   // base lower
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.52 * su, rearReach: 0.88 * su, sideReach: 0.98 * su, R };
}

// ─── Chassis 2: STRIKER ──────────────────────────────────────────────────────
//
//  Shape language: compact · wedge-dominated · aggressive forward bias
//  The WEAPON WEDGE is the largest single shape — it defines the silhouette.
//  Hull and engine are visually secondary.
//
//  Unit-grid bounding box:
//    X: −1.10 (wedge tip) → +0.90 (engine rear)    ≈ 2.00 units
//    Y: −0.62 (wedge base) → +0.62                  ≈ 1.24 units
//  At R=14, su=19.6 → sprite ≈ 39 × 24 px
//
function drawChassisStriker(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: engine block — rear propulsion, taller than wide
  spRect(ctx, 0.58, -0.34, 0.90, 0.34, cx, cy, su, fill, glow, flash, debug, 0.70);

  // Layer 2: compact hull body
  spRect(ctx, -0.10, -0.46, 0.58, 0.46, cx, cy, su, fill, glow, flash, debug);

  // Layer 3: forward weapon wedge — the DOMINANT shape
  spPoly(ctx, [
    [-1.10,  0.00],   // weapon tip (FRONT)
    [-0.10, -0.62],   // base upper (at hull front face)
    [-0.10,  0.62],   // base lower
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.10 * su, rearReach: 0.90 * su, sideReach: 0.62 * su, R };
}

// ─── Chassis 3: ARTILLERY ────────────────────────────────────────────────────
//
//  Shape language: long · asymmetric · weapon-dominated · large rear support
//  The BARREL is the dominant shape — it occupies >40% of total length.
//  No central circle anywhere.
//
//  Unit-grid bounding box:
//    X: −2.10 (barrel tip) → +0.86 (rear mass right edge)   ≈ 2.96 units
//    Y: −0.52 (rear mass)  → +0.52                           ≈ 1.04 units
//  At R=14, su=19.6 → sprite ≈ 58 × 20 px  (≈3:1 ratio vs tank's 1:1)
//
function drawChassisArtillery(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: rear recoil mass — large body, right of pivot
  spRect(ctx, 0.08, -0.52, 0.86, 0.52, cx, cy, su, fill, glow, flash, debug);

  // Layer 2: barrel mount — small connector block
  spRect(ctx, -0.20, -0.28, 0.08, 0.28, cx, cy, su, fill, glow, flash, debug, 0.85);

  // Layer 3: barrel — DOMINANT WEAPON, long thin rectangle
  //   Extends far forward (−X), clearly the defining feature
  spBar(ctx, -0.20, 0, -2.10, 0, 0.16, cx, cy, su, fill, glow, flash, debug);

  // Layer 4: barrel tip reinforcement
  spRect(ctx, -2.10, -0.20, -1.88, 0.20, cx, cy, su, fill, glow, flash, debug, 0.90);

  return { frontReach: 2.10 * su, rearReach: 0.86 * su, sideReach: 0.52 * su, R };
}

// ─── Chassis 4: TANK ─────────────────────────────────────────────────────────
//
//  Shape language: square · wide · layered · thick perimeter · compact weapon
//  Armor plates are WIDER than hull — the layered structure is the silhouette.
//  Short gun stub — does NOT dominate.
//
//  Unit-grid bounding box:
//    X: −0.90 (gun tip) → +0.62 (hull rear)   ≈ 1.52 units
//    Y: −0.72 (armor)   → +0.72               ≈ 1.44 units
//  At R=14, su=19.6 → sprite ≈ 30 × 28 px  (nearly square — very different from artillery)
//
function drawChassisTank(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: wide bottom armor plate (wider than hull)
  spRect(ctx, -0.58, 0.52, 0.62, 0.72, cx, cy, su, fill, glow, flash, debug, 0.80);

  // Layer 2: wide top armor plate (wider than hull)
  spRect(ctx, -0.58, -0.72, 0.62, -0.52, cx, cy, su, fill, glow, flash, debug, 0.80);

  // Layer 3: main armored hull body
  spRect(ctx, -0.46, -0.52, 0.62, 0.52, cx, cy, su, fill, glow, flash, debug);

  // Layer 4: inner hull detail (creates layered look)
  spRect(ctx, -0.36, -0.38, 0.50, 0.38, cx, cy, su, fill, glow, flash, debug, 0.65);

  // Layer 5: short gun stub — exits front face, compact
  spBar(ctx, -0.46, 0, -0.90, 0, 0.16, cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 0.90 * su, rearReach: 0.62 * su, sideReach: 0.72 * su, R };
}

// ─── Chassis 5: RAMMER ───────────────────────────────────────────────────────
//
//  Shape language: triangular · front-heavy · large continuous prow · minimal equipment
//  The ENTIRE FRONT is a single continuous mass — hull IS the weapon.
//  No separate weapon mount. Drives at extreme rear corners.
//
//  Unit-grid bounding box:
//    X: −1.20 (prow tip) → +0.62 (drive rear)   ≈ 1.82 units
//    Y: −0.98 (prow/drives) → +0.98              ≈ 1.96 units
//  At R=14, su=19.6 → sprite ≈ 36 × 38 px  (wide forward triangle)
//
function drawChassisRammer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: drive pods — rear propulsion circles, drawn first (behind prow)
  spCirc(ctx, 0.54, -0.72, 0.22, cx, cy, su, fill, glow, flash, debug, 0.70);
  spCirc(ctx, 0.54,  0.72, 0.22, cx, cy, su, fill, glow, flash, debug, 0.70);

  // Layer 2: entire prow — ONE continuous forward mass (hull + weapon unified)
  //   Triangular/arrowhead — front-heavy, rear narrows
  spPoly(ctx, [
    [-1.20,  0.00],   // prow tip (FRONT) — the strike point
    [-0.50, -0.60],   // upper shoulder
    [ 0.26, -0.88],   // upper rear
    [ 0.46, -0.68],   // upper drive mount
    [ 0.46,  0.68],   // lower drive mount
    [ 0.26,  0.88],   // lower rear
    [-0.50,  0.60],   // lower shoulder
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.20 * su, rearReach: 0.62 * su, sideReach: 0.98 * su, R };
}

// ─── Chassis 6: TURRET ───────────────────────────────────────────────────────
//
//  Shape language: stationary · octagonal base · discrete rectangular gun modules
//  4 gun barrels are RECTANGULAR BARS — not lobes, not petals, not circles.
//  Hub is a small secondary element, not the dominant mass.
//
//  Unit-grid bounding box: ±0.90 in all directions ≈ 1.80 × 1.80 units
//  At R=14, su=19.6 → sprite ≈ 35 × 35 px  (square, clearly gun emplacement)
//
function drawChassisTurret(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: octagonal base plate
  const b = 0.50, bc = 0.34;   // radius and cut corner offset
  spPoly(ctx, [
    [-bc, -b], [ bc, -b],
    [ b, -bc], [ b,  bc],
    [ bc,  b], [-bc,  b],
    [-b,  bc], [-b, -bc],
  ], cx, cy, su, fill, glow, flash, debug);

  // Layer 2: central hub (small — NOT dominant)
  spCirc(ctx, 0, 0, 0.24, cx, cy, su, fill, glow, flash, debug, 0.85);

  // Layer 3: 4 gun barrel modules — discrete rectangular bars
  //   Each starts at hub edge + gap and extends outward
  const gunStart = 0.26, gunEnd = 0.90, gunHW = 0.13;
  spBar(ctx, -gunStart, 0, -gunEnd, 0, gunHW, cx, cy, su, fill, glow, flash, debug);  // FRONT barrel
  spBar(ctx,  gunStart, 0,  gunEnd, 0, gunHW, cx, cy, su, fill, glow, flash, debug);  // rear barrel
  spBar(ctx, 0, -gunStart, 0, -gunEnd, gunHW, cx, cy, su, fill, glow, flash, debug);  // top barrel
  spBar(ctx, 0,  gunStart, 0,  gunEnd, gunHW, cx, cy, su, fill, glow, flash, debug);  // bottom barrel

  // Layer 4: gun tips (small squares to cap the barrels)
  const gt = 0.90;
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
    spRect(ctx, gt*dx - 0.14*Math.abs(dy) - 0.04*Math.abs(dx),
               gt*dy - 0.14*Math.abs(dx) - 0.04*Math.abs(dy),
               gt*dx + 0.14*Math.abs(dy) + 0.04*Math.abs(dx),
               gt*dy + 0.14*Math.abs(dx) + 0.04*Math.abs(dy),
               cx, cy, su, fill, glow, flash, debug, 0.90);
  }

  const reach = 0.90 * su;
  return { frontReach: reach, rearReach: reach, sideReach: reach, R };
}

// ─── Chassis 7: CARRIER ──────────────────────────────────────────────────────
//
//  Shape language: broad · rectangular/boxy · visible deployment bays · multiple modules
//  Large rectangular hull — not elongated, not circular.
//  Pods are separate circles attached to hull perimeter faces.
//
//  Unit-grid bounding box:
//    X: −1.14 (front pod)  → +1.06 (engine rear)   ≈ 2.20 units
//    Y: −1.00 (top pod)    → +1.00                  ≈ 2.00 units
//  At R=14, su=19.6 → sprite ≈ 43 × 39 px  (widest in Y relative to X)
//
function drawChassisCarrier(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: twin rear engines (behind hull)
  spCirc(ctx,  0.88, -0.38, 0.20, cx, cy, su, fill, glow, flash, debug, 0.65);
  spCirc(ctx,  0.88,  0.38, 0.20, cx, cy, su, fill, glow, flash, debug, 0.65);

  // Layer 2: main hull — wide rect, NOT elongated
  spRect(ctx, -0.76, -0.70, 0.76, 0.70, cx, cy, su, fill, glow, flash, debug);

  // Layer 3: hull detail panels (creates bay structure visual)
  spRect(ctx, -0.72, -0.62, -0.08, -0.14, cx, cy, su, fill, glow, flash, debug, 0.55);
  spRect(ctx, -0.72,  0.14, -0.08,  0.62, cx, cy, su, fill, glow, flash, debug, 0.55);
  spRect(ctx,  0.10, -0.62,  0.70, -0.14, cx, cy, su, fill, glow, flash, debug, 0.55);
  spRect(ctx,  0.10,  0.14,  0.70,  0.62, cx, cy, su, fill, glow, flash, debug, 0.55);

  // Layer 4: deployment pods — discrete circles at hull faces (clearly separate)
  spCirc(ctx, -0.94, 0, 0.20, cx, cy, su, fill, glow, flash, debug, 0.90);   // front pod
  spCirc(ctx, -0.18, -0.90, 0.20, cx, cy, su, fill, glow, flash, debug, 0.90); // top pod
  spCirc(ctx, -0.18,  0.90, 0.20, cx, cy, su, fill, glow, flash, debug, 0.90); // bottom pod

  return { frontReach: 1.14 * su, rearReach: 1.06 * su, sideReach: 1.00 * su, R };
}

// ─── Chassis 8: SWARM ────────────────────────────────────────────────────────
//
//  Shape language: simple · directional · compact · expendable
//  Teardrop silhouette — rounded rear, pointed front (FRONT = −X).
//  Tiny and fast-looking. NO separate weapon part needed; nose IS the attack.
//
//  Unit-grid bounding box:
//    X: −0.70 (nose) → +0.56 (rear nub)   ≈ 1.26 units
//    Y: −0.44        → +0.44              ≈ 0.88 units
//  At R=14, su=19.6 → sprite ≈ 25 × 17 px  (small, fast profile)
//
function drawChassisSwarm(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: rear propulsion nub
  spCirc(ctx, 0.44, 0, 0.16, cx, cy, su, fill, glow, flash, debug, 0.70);

  // Layer 2: teardrop body — pointed nose, rounded rear
  spPoly(ctx, [
    [-0.70,  0.00],   // nose tip (FRONT)
    [-0.44, -0.30],   // upper nose
    [-0.06, -0.44],   // upper body
    [ 0.26, -0.42],   // upper rear
    [ 0.44, -0.24],   // rear upper
    [ 0.44,  0.24],   // rear lower
    [ 0.26,  0.42],   // lower rear
    [-0.06,  0.44],   // lower body
    [-0.44,  0.30],   // lower nose
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 0.70 * su, rearReach: 0.56 * su, sideReach: 0.44 * su, R };
}

// ─── Chassis 9: CONTROLLER ───────────────────────────────────────────────────
//
//  Shape language: tall · asymmetric · antennae · emitter structures
//  Y-shape with 3 asymmetric arms.  FORWARD arm (−X) is LONGER — facing indicator.
//  Hub is small; arms define the silhouette.
//
//  Unit-grid bounding box:
//    X: −1.44 (forward node)  → +0.76 (side arm reach)   ≈ 2.20 units
//    Y: −1.12 (upper node)    → +1.12                     ≈ 2.24 units
//  At R=14, su=19.6 → sprite ≈ 43 × 44 px  (tall Y-shape, clearly asymmetric)
//
function drawChassisController(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Y-arm angles: forward = FRONT (-X), upper-right, lower-right
  // Using 115° and 245° (not symmetric 120°/240°) for visible asymmetry
  const fwdA   = Math.PI;           // 180° — forward (FRONT)
  const upperA = (115 / 180) * Math.PI;  // 115° — upper-rear
  const lowerA = (245 / 180) * Math.PI;  // 245° — lower-rear

  const fwdLen   = 1.14;  // forward arm — LONGER (facing indicator)
  const sideLen  = 0.80;  // side arms — shorter
  const armHW    = 0.10;
  const hubR     = 0.24;
  const fwdNR    = 0.20;
  const sideNR   = 0.16;

  // Layer 1: arms (under hub and nodes)
  spBar(ctx, Math.cos(fwdA)*hubR,    Math.sin(fwdA)*hubR,
             Math.cos(fwdA)*fwdLen,  Math.sin(fwdA)*fwdLen,
             armHW, cx, cy, su, fill, glow, flash, debug);
  spBar(ctx, Math.cos(upperA)*hubR,  Math.sin(upperA)*hubR,
             Math.cos(upperA)*sideLen, Math.sin(upperA)*sideLen,
             armHW, cx, cy, su, fill, glow, flash, debug);
  spBar(ctx, Math.cos(lowerA)*hubR,  Math.sin(lowerA)*hubR,
             Math.cos(lowerA)*sideLen, Math.sin(lowerA)*sideLen,
             armHW, cx, cy, su, fill, glow, flash, debug);

  // Layer 2: hub (small — NOT dominant)
  spCirc(ctx, 0, 0, hubR, cx, cy, su, fill, glow, flash, debug, 0.90);

  // Layer 3: emitter nodes at arm tips
  spCirc(ctx, Math.cos(fwdA)*fwdLen,    Math.sin(fwdA)*fwdLen,
              fwdNR, cx, cy, su, fill, glow, flash, debug);
  spCirc(ctx, Math.cos(upperA)*sideLen,  Math.sin(upperA)*sideLen,
              sideNR, cx, cy, su, fill, glow, flash, debug);
  spCirc(ctx, Math.cos(lowerA)*sideLen,  Math.sin(lowerA)*sideLen,
              sideNR, cx, cy, su, fill, glow, flash, debug);

  return {
    frontReach: (fwdLen + fwdNR) * su,
    rearReach:  (sideLen * 0.6 + sideNR) * su,
    sideReach:  (sideLen + sideNR) * su,
    R,
  };
}

// ─── Chassis 10: ADAPTIVE ────────────────────────────────────────────────────
//
//  Shape language: armored block + medium barrel — hybrid of tank and artillery
//  Distinguishable from BOTH: barrel is longer than tank's stub, shorter than artillery's.
//  Armor plates still wider than hull (tank inheritance).
//
//  Unit-grid bounding box:
//    X: −1.26 (barrel tip) → +0.62 (hull rear)   ≈ 1.88 units
//    Y: −0.68 (armor)      → +0.68               ≈ 1.36 units
//  At R=14, su=19.6 → sprite ≈ 37 × 27 px  (intermediate between tank and artillery)
//
function drawChassisAdaptive(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Layer 1: armor plates (wider than hull — tank element)
  spRect(ctx, -0.50, -0.68, 0.62, -0.50, cx, cy, su, fill, glow, flash, debug, 0.80);
  spRect(ctx, -0.50,  0.50, 0.62,  0.68, cx, cy, su, fill, glow, flash, debug, 0.80);

  // Layer 2: main hull
  spRect(ctx, -0.50, -0.50, 0.62,  0.50, cx, cy, su, fill, glow, flash, debug);

  // Layer 3: medium barrel — artillery element (shorter than pure artillery ~2.1, longer than tank ~0.44)
  spBar(ctx, -0.50, 0, -1.26, 0, 0.16, cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.26 * su, rearReach: 0.62 * su, sideReach: 0.68 * su, R };
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

// ─── Debug grid — GAMEPLAY-SCALE acceptance test ──────────────────────────────
//
//  Renders all 10 chassis at R=15px (actual gameplay entity size).
//  Visual sprites are shown at full su=R*1.4 scale with glow and fill color,
//  exactly as they appear in the running game.
//
//  PASS criteria:
//    1. No two chassis can be confused as solid silhouettes         → distinct shapes
//    2. <25% resemble stars, flowers, crosses, or blobs             → no radial motifs
//    3. Most units do NOT share a circular central mass              → no central-core
//    4. Bounding boxes show varied aspect ratios                     → no normalization
//    5. Front identifiable in <1 second                             → clear facing
//    6. Largest feature corresponds to gameplay behavior             → function-readable

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
    'interceptor', 'striker',    'artillery', 'rammer',  'swarm',
    'tank',        'turret',     'carrier',   'controller', 'adaptive',
  ];

  const cols = 5, rows = 2;
  const cellW = width / cols, cellH = height / rows;

  // R=15 = actual gameplay entity size (cell≈64, R0≈11.8, typical n gives R≈14–18)
  const R = 15;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Show scale note
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font      = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`R=${R}px · su=${(R * 1.4).toFixed(1)}px · gameplay scale`, 8, height - 8);

  chassis.forEach((ch, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx  = cellW * (col + 0.5);
    const cy  = cellH * (row + 0.5) - 16;

    const p: VirusPhenotype = {
      n: 7, cls: 'prime', lobes: 5, spikes: [], spikeCount: 3,
      speed: 0.5, armor: 0.5, mass: 0.5, attackRange: 0.5,
      sensorRadius: 0.5, aggression: 0.5, regen: 0.5, evasion: 0.5,
      symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins',
      chassis: ch,
      ...CHASSIS_PREVIEW_TRAITS[ch],
    };

    // Draw with actual game colors + glow (not debug=true) so this is the TRUE rendering
    const fill = '#e2e8f0';
    const glow = 'rgba(148,163,184,0.60)';
    drawChassis(ctx, cx, cy, R, p, fill, glow, false, false);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ch, cx, cy + R * 3.8 + 8);
  });
}


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
