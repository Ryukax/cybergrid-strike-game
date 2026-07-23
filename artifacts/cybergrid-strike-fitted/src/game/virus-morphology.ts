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

/**
 * Primary-geometry-only debug mode.
 * When true, renders a 2×5 grid showing ONLY the single dominant shape of each
 * chassis — no secondary layers, no glow, no shadow, no stroke, no alpha,
 * no shared morphology, flat white fill only.
 * Use this to verify the bare silhouettes before re-enabling rendering layers.
 *
 * Layer re-enable sequence (controlled by MORPHOLOGY_LAYER_STAGE):
 *   0 = primary shape only (the gate)
 *   1 = + secondary shapes (fins, mount, cheeks, bays, arm…)
 *   2 = + stroke outline (the 1.2px white border)
 *   3 = + shadow glow (shadowBlur=10)
 *   4 = full rendering (colors, alpha variation)
 */
export const MORPHOLOGY_PRIMARY_DEBUG = false;
export const MORPHOLOGY_LAYER_STAGE: number = 0;  // 0–4

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

// ─── v9 Chassis Artwork ───────────────────────────────────────────────────────
//
//  Design rules (v9):
//  • Hard angular geometry ONLY: spPoly, spRect, spBar. No spCirc.
//  • No arc(), ellipse(), bezierCurveTo(), quadraticCurveTo() anywhere.
//  • No central circle / ring / orb on any chassis.
//  • No radial / petal / evenly-spaced appendage distribution.
//  • Extreme aspect ratios — most chassis width/height ≥ 1.8 or height/width ≥ 1.8.
//  • Front / Middle / Rear zones — ≥60% mass along dominant axis.
//  • Dominant feature = gameplay function (barrel, prow, mast, bays).
//
//  FRONT = −X (left).  su = R * 1.4  (pixels per unit-grid step, ≈21px at R=15).
//
//  Target bounding boxes:
//    interceptor  ~60×20 px  (3:1 elongated torpedo)
//    striker      ~44×26 px  (wedge-dominant)
//    artillery    ~70×18 px  (barrel = 54% of width)
//    tank         ~40×36 px  (near-square box — most square of all)
//    rammer       ~50×30 px  (triangle, front-heavy)
//    turret       ~36×30 px  body + single directional barrel
//    carrier      ~62×38 px  (wide flat hull + visible bays)
//    swarm        ~22×10 px  (tiny dart — smallest by far)
//    controller   ~34×52 px  (TALL — antenna mast dominates height)
//    adaptive     ~48×28 px  (barrel + armor hybrid)

// ─── INTERCEPTOR ─────────────────────────────────────────────────────────────
//  Long torpedo fuselage + swept delta fins.
//  Front: sharp nose triangle. Middle: narrow tapered body. Rear: delta fins.
//  Fins both sweep rearward (NOT symmetric petal lobes).
//  No circles. ~2.86 × 0.80 fuselage, ~3:1 ratio.
function drawChassisInterceptor(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // REAR zone: swept delta fins — both angle rearward (not radial petals)
  spPoly(ctx, [  // upper fin — sweeps up-and-back
    [ 0.30, -0.38], [ 0.90, -0.38], [ 1.43, -0.80], [ 0.20, -0.80],
  ], cx, cy, su, fill, glow, flash, debug, 0.80);
  spPoly(ctx, [  // lower fin — sweeps down-and-back
    [ 0.30,  0.38], [ 0.90,  0.38], [ 1.43,  0.80], [ 0.20,  0.80],
  ], cx, cy, su, fill, glow, flash, debug, 0.80);

  // MIDDLE zone: main fuselage — tapered hexagon, nose at front
  spPoly(ctx, [
    [-1.43,  0.00],  // nose point (FRONT)
    [-1.10, -0.22],  // upper nose
    [-0.30, -0.38],  // upper forward
    [ 0.90, -0.38],  // upper rear
    [ 1.43, -0.22],  // rear upper corner
    [ 1.43,  0.22],  // rear lower corner
    [ 0.90,  0.38],  // lower rear
    [-0.30,  0.38],  // lower forward
    [-1.10,  0.22],  // lower nose
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.43 * su, rearReach: 1.43 * su, sideReach: 0.80 * su, R };
}

// ─── STRIKER ─────────────────────────────────────────────────────────────────
//  Large forward wedge = dominant shape. Rear hull block is secondary.
//  No circles.
function drawChassisStriker(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // REAR zone: compact hull block
  spRect(ctx, 0.50, -0.50, 1.05, 0.50, cx, cy, su, fill, glow, flash, debug, 0.85);

  // FRONT zone: weapon wedge — defines the entire silhouette
  spPoly(ctx, [
    [-1.05,  0.00],  // weapon tip (FRONT)
    [ 0.50, -0.62],  // base upper
    [ 0.50,  0.62],  // base lower
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.05 * su, rearReach: 1.05 * su, sideReach: 0.62 * su, R };
}

// ─── ARTILLERY ───────────────────────────────────────────────────────────────
//  Barrel = 54% of total width. Most elongated chassis (3.9:1).
//  Front: long thin barrel. Middle: mount. Rear: support block.
//  No circles.
function drawChassisArtillery(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // REAR zone: recoil/support mass block
  spRect(ctx, 0.40, -0.43, 1.60, 0.43, cx, cy, su, fill, glow, flash, debug);

  // MIDDLE zone: barrel mount
  spRect(ctx, -0.22, -0.26, 0.40, 0.26, cx, cy, su, fill, glow, flash, debug, 0.80);

  // FRONT zone: barrel — 1.73 units forward (54% of 3.33 total)
  spBar(ctx, -0.22, 0, -1.73, 0, 0.13, cx, cy, su, fill, glow, flash, debug);

  // Barrel tip reinforcement (wider cap — distinct from barrel shaft)
  spRect(ctx, -1.73, -0.22, -1.52, 0.22, cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.73 * su, rearReach: 1.60 * su, sideReach: 0.43 * su, R };
}

// ─── TANK ────────────────────────────────────────────────────────────────────
//  Boxy and square — clearly the most square chassis.
//  Outer armor plates are the dominant shape. Short stub gun does NOT dominate.
//  No circles.
function drawChassisTank(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Outer armor — top and bottom plates, widest elements
  spRect(ctx, -0.55, -0.86, 1.35, -0.62, cx, cy, su, fill, glow, flash, debug);
  spRect(ctx, -0.55,  0.62, 1.35,  0.86, cx, cy, su, fill, glow, flash, debug);

  // Main armored hull body
  spRect(ctx, -0.55, -0.62, 1.35, 0.62, cx, cy, su, fill, glow, flash, debug);

  // Inner hull layer (creates visual depth/layers)
  spRect(ctx, -0.38, -0.44, 1.18, 0.44, cx, cy, su, fill, glow, flash, debug, 0.50);

  // Short gun stub — clearly smaller than artillery barrel
  spRect(ctx, -0.55, -0.18, -0.92, 0.18, cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 0.92 * su, rearReach: 1.35 * su, sideReach: 0.86 * su, R };
}

// ─── RAMMER ──────────────────────────────────────────────────────────────────
//  Triangle IS the weapon — prow occupies 66% of mass.
//  No separate weapon mount. No circles.
function drawChassisRammer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // REAR zone: compact engine block
  spRect(ctx, 0.54, -0.48, 1.19, 0.48, cx, cy, su, fill, glow, flash, debug, 0.80);

  // FRONT zone: massive prow triangle — hull IS the weapon
  spPoly(ctx, [
    [-1.19,  0.00],  // prow tip (strike point, FRONT)
    [ 0.54, -0.71],  // upper rear corner
    [ 0.54,  0.71],  // lower rear corner
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.19 * su, rearReach: 1.19 * su, sideReach: 0.71 * su, R };
}

// ─── TURRET ──────────────────────────────────────────────────────────────────
//  Armored base block + SINGLE directional barrel (NOT 4-way symmetric).
//  One barrel faces FRONT only. Side armor cheeks reinforce lateral stance.
//  No circles.
function drawChassisTurret(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // REAR zone: main armored base block
  spRect(ctx, -0.20, -0.71, 1.51, 0.71, cx, cy, su, fill, glow, flash, debug);

  // Side armor cheeks (front-face corners — directional stance)
  spRect(ctx, -0.20, -0.71, 0.32, -0.50, cx, cy, su, fill, glow, flash, debug, 0.85);
  spRect(ctx, -0.20,  0.50, 0.32,  0.71, cx, cy, su, fill, glow, flash, debug, 0.85);

  // FRONT zone: single directional barrel (FRONT only — not 4-way)
  spBar(ctx, -0.20, 0, -1.51, 0, 0.24, cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.51 * su, rearReach: 1.51 * su, sideReach: 0.71 * su, R };
}

// ─── CARRIER ─────────────────────────────────────────────────────────────────
//  Wide flat rectangular hull. Payload bays are visually obvious.
//  Front armor reinforcement + rear engine section.
//  No circles.
function drawChassisCarrier(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Main hull — widest chassis, clearly rectangular
  spRect(ctx, -1.48, -0.90, 1.48, 0.90, cx, cy, su, fill, glow, flash, debug);

  // Payload bay panels (recessed — clearly distinct at scale)
  spRect(ctx, -1.30, -0.72, -0.55, -0.08, cx, cy, su, fill, glow, flash, debug, 0.45);
  spRect(ctx, -1.30,  0.08, -0.55,  0.72, cx, cy, su, fill, glow, flash, debug, 0.45);
  spRect(ctx, -0.38, -0.72,  0.38, -0.08, cx, cy, su, fill, glow, flash, debug, 0.45);
  spRect(ctx, -0.38,  0.08,  0.38,  0.72, cx, cy, su, fill, glow, flash, debug, 0.45);

  // Front face armor (thicker leading edge reinforcement)
  spRect(ctx, -1.48, -0.90, -1.18, 0.90, cx, cy, su, fill, glow, flash, debug, 0.80);

  // Rear engine section (narrower profile)
  spRect(ctx, 1.18, -0.68, 1.48, 0.68, cx, cy, su, fill, glow, flash, debug, 0.80);

  return { frontReach: 1.48 * su, rearReach: 1.48 * su, sideReach: 0.90 * su, R };
}

// ─── SWARM ───────────────────────────────────────────────────────────────────
//  Tiny dart — smallest chassis by far. Bounding box ~22×10.
//  No circles. Simple 5-vertex arrowhead.
function drawChassisSwarm(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Dart / arrowhead — 5 vertices, points left (FRONT)
  spPoly(ctx, [
    [-0.52,  0.00],  // nose (FRONT)
    [-0.24, -0.24],  // upper neck
    [ 0.52, -0.24],  // upper tail
    [ 0.52,  0.24],  // lower tail
    [-0.24,  0.24],  // lower neck
  ], cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 0.52 * su, rearReach: 0.52 * su, sideReach: 0.24 * su, R };
}

// ─── CONTROLLER ──────────────────────────────────────────────────────────────
//  Antenna mast extends far above body — height >> width (TALL chassis).
//  Mast crossbar + body block + forward arm = asymmetric silhouette.
//  No circles.
function drawChassisController(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // SENSOR MAST: tall slim vertical rect — the defining silhouette feature
  spRect(ctx, -0.22, -1.24, 0.22,  0.00, cx, cy, su, fill, glow, flash, debug);

  // Mast crossbar / antenna brace (wide horizontal bar near top of mast)
  spRect(ctx, -0.60, -1.06, 0.60, -0.88, cx, cy, su, fill, glow, flash, debug, 0.80);

  // BODY: wide horizontal block at center-to-bottom
  spRect(ctx, -0.81,  0.00, 0.81,  1.24, cx, cy, su, fill, glow, flash, debug);

  // FORWARD ARM: sensor/weapon extension pointing FRONT (−X) — asymmetric with mast
  spRect(ctx, -1.62,  0.16, -0.81,  0.56, cx, cy, su, fill, glow, flash, debug, 0.90);

  // Arm tip reinforcement block
  spRect(ctx, -1.62,  0.06, -1.40,  0.66, cx, cy, su, fill, glow, flash, debug);

  return {
    frontReach: 1.62 * su,
    rearReach:  0.81 * su,
    sideReach:  1.24 * su,
    R,
  };
}

// ─── ADAPTIVE ────────────────────────────────────────────────────────────────
//  Tank-style layered armor + medium barrel (longer than tank stub, shorter than artillery).
//  Clearly intermediate between tank (square) and artillery (long).
//  No circles.
function drawChassisAdaptive(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  _p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const su = R * 1.4;

  // Outer armor plates — wider than hull body
  spRect(ctx, -0.50, -0.70, 1.10, -0.52, cx, cy, su, fill, glow, flash, debug);
  spRect(ctx, -0.50,  0.52, 1.10,  0.70, cx, cy, su, fill, glow, flash, debug);

  // Main hull body
  spRect(ctx, -0.50, -0.52, 1.10, 0.52, cx, cy, su, fill, glow, flash, debug);

  // Inner hull detail
  spRect(ctx, -0.35, -0.36, 0.95, 0.36, cx, cy, su, fill, glow, flash, debug, 0.50);

  // Medium barrel — 0.95u forward (between tank's 0.37u and artillery's 1.73u)
  spBar(ctx, -0.50, 0, -1.45, 0, 0.16, cx, cy, su, fill, glow, flash, debug);

  return { frontReach: 1.45 * su, rearReach: 1.10 * su, sideReach: 0.70 * su, R };
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

// ─── Primary-only debug grid ──────────────────────────────────────────────────
//
//  Draws the ONE defining shape per chassis.  No secondary shapes, no glow,
//  no stroke, no shadow, no alpha variation.  Pure flat white fill only.
//
//  When MORPHOLOGY_LAYER_STAGE > 0, layers are added back incrementally:
//    stage 1: secondary shapes (fins, mounts, cheeks, bays, arm)
//    stage 2: stage 1 + 1.2px white stroke outline
//    stage 3: stage 2 + shadowBlur=10 glow
//    stage 4: full rendering (game colors + alpha variation)

export function drawPrimaryDebugGrid(
  ctx:   CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const CHASSIS_LIST: ChassisType[] = [
    'interceptor', 'striker',    'artillery', 'rammer',  'swarm',
    'tank',        'turret',     'carrier',   'controller', 'adaptive',
  ];

  const cols = 5, rows = 2;
  const cellW = width / cols, cellH = height / rows;
  const R  = 15;
  const su = R * 1.4;  // ≈21px at gameplay scale

  // ── helpers that respect the current stage ─────────────────────────────────
  const stage = MORPHOLOGY_LAYER_STAGE;

  // Fills the currently open path according to the current stage.
  // stage 0-1: flat white, no stroke, no shadow
  // stage 2:   flat white + stroke
  // stage 3:   flat white + stroke + shadowBlur glow
  // stage 4:   use provided fill/glow
  function applyStage(
    fill = '#e2e8f0', glow = 'rgba(148,163,184,0.6)',
  ): void {
    if (stage <= 2) {
      ctx.fillStyle = '#ffffff';
    } else if (stage === 3) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur  = 10;
    } else {
      ctx.fillStyle = fill;
      ctx.shadowColor = glow;
      ctx.shadowBlur  = 10;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    if (stage >= 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.60)';
      ctx.lineWidth   = 1.2;
      ctx.stroke();
    }
  }

  // Draw a polygon from unit-grid coords; only filled if showSecondary || isPrimary.
  function poly(
    pts: readonly Pt[], cx: number, cy: number,
    isPrimary: boolean, alpha = 1.0,
    fill?: string, glow?: string,
  ): void {
    if (!isPrimary && stage < 1) return;
    const prev = ctx.globalAlpha;
    if (!isPrimary && stage < 4) ctx.globalAlpha = prev * Math.min(alpha, 0.70);
    ctx.beginPath();
    ctx.moveTo(cx + pts[0][0] * su, cy + pts[0][1] * su);
    for (let i = 1; i < pts.length; i++)
      ctx.lineTo(cx + pts[i][0] * su, cy + pts[i][1] * su);
    ctx.closePath();
    applyStage(fill, glow);
    ctx.globalAlpha = prev;
  }

  // Draw a rect from unit-grid coords.
  function rect(
    ux0: number, uy0: number, ux1: number, uy1: number,
    cx: number, cy: number,
    isPrimary: boolean, alpha = 1.0,
    fill?: string, glow?: string,
  ): void {
    poly([[ux0, uy0], [ux1, uy0], [ux1, uy1], [ux0, uy1]], cx, cy, isPrimary, alpha, fill, glow);
  }

  // Draw a bar (axis-aligned rect) from unit-grid coords.
  function bar(
    ux1: number, uy1: number, ux2: number, uy2: number, uhw: number,
    cx: number, cy: number,
    isPrimary: boolean, alpha = 1.0,
    fill?: string, glow?: string,
  ): void {
    const dx = ux2 - ux1, dy = uy2 - uy1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    const px = (-dy / len) * uhw, py = (dx / len) * uhw;
    poly(
      [[ux1 + px, uy1 + py], [ux2 + px, uy2 + py],
       [ux2 - px, uy2 - py], [ux1 - px, uy1 - py]],
      cx, cy, isPrimary, alpha, fill, glow,
    );
  }

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // ── Stage label ─────────────────────────────────────────────────────────────
  const stageLabel = [
    'STAGE 0: primary shape only',
    'STAGE 1: + secondary shapes',
    'STAGE 2: + stroke outline',
    'STAGE 3: + shadow glow',
    'STAGE 4: full rendering',
  ][stage] ?? `STAGE ${stage}`;
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font      = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(stageLabel, 8, height - 8);
  ctx.fillText(`R=${R}px · su=${su.toFixed(1)}px · gameplay scale`, 8, height - 22);

  // ── Per-chassis rendering ───────────────────────────────────────────────────
  CHASSIS_LIST.forEach((ch, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx  = cellW * (col + 0.5);
    const cy  = cellH * (row + 0.5) - 12;

    const fill = '#e2e8f0';
    const glow = 'rgba(148,163,184,0.60)';

    switch (ch) {

      case 'interceptor':
        // Secondary: swept fins (both angle rearward)
        poly([[ 0.30,-0.38],[ 0.90,-0.38],[1.43,-0.80],[0.20,-0.80]], cx,cy, false,0.80,fill,glow);
        poly([[ 0.30, 0.38],[ 0.90, 0.38],[1.43, 0.80],[0.20, 0.80]], cx,cy, false,0.80,fill,glow);
        // PRIMARY: tapered hexagon fuselage
        poly([[-1.43,0.00],[-1.10,-0.22],[-0.30,-0.38],[0.90,-0.38],
              [1.43,-0.22],[1.43,0.22],[0.90,0.38],[-0.30,0.38],[-1.10,0.22]],
             cx,cy, true,1.0,fill,glow);
        break;

      case 'striker':
        // Secondary: rear hull block
        rect(0.50,-0.50, 1.05,0.50, cx,cy, false,0.85,fill,glow);
        // PRIMARY: forward wedge triangle
        poly([[-1.05,0.00],[0.50,-0.62],[0.50,0.62]], cx,cy, true,1.0,fill,glow);
        break;

      case 'artillery':
        // Secondary: rear recoil block + barrel mount
        rect(0.40,-0.43, 1.60, 0.43, cx,cy, false,1.0,fill,glow);
        rect(-0.22,-0.26, 0.40, 0.26, cx,cy, false,0.80,fill,glow);
        // Secondary: barrel tip cap
        rect(-1.73,-0.22, -1.52, 0.22, cx,cy, false,1.0,fill,glow);
        // PRIMARY: barrel bar
        bar(-0.22,0, -1.73,0, 0.13, cx,cy, true,1.0,fill,glow);
        break;

      case 'tank':
        // Secondary: outer armor plates (top + bottom)
        rect(-0.55,-0.86, 1.35,-0.62, cx,cy, false,1.0,fill,glow);
        rect(-0.55, 0.62, 1.35, 0.86, cx,cy, false,1.0,fill,glow);
        // Secondary: inner hull detail layer
        rect(-0.38,-0.44, 1.18, 0.44, cx,cy, false,0.50,fill,glow);
        // Secondary: short gun stub
        rect(-0.55,-0.18, -0.92, 0.18, cx,cy, false,1.0,fill,glow);
        // PRIMARY: main armored hull body
        rect(-0.55,-0.62, 1.35, 0.62, cx,cy, true,1.0,fill,glow);
        break;

      case 'rammer':
        // Secondary: rear engine block
        rect(0.54,-0.48, 1.19, 0.48, cx,cy, false,0.80,fill,glow);
        // PRIMARY: massive prow triangle
        poly([[-1.19,0.00],[0.54,-0.71],[0.54,0.71]], cx,cy, true,1.0,fill,glow);
        break;

      case 'turret':
        // Secondary: side armor cheeks
        rect(-0.20,-0.71, 0.32,-0.50, cx,cy, false,0.85,fill,glow);
        rect(-0.20, 0.50, 0.32, 0.71, cx,cy, false,0.85,fill,glow);
        // Secondary: directional barrel
        bar(-0.20,0, -1.51,0, 0.24, cx,cy, false,1.0,fill,glow);
        // PRIMARY: main armored base block
        rect(-0.20,-0.71, 1.51, 0.71, cx,cy, true,1.0,fill,glow);
        break;

      case 'carrier':
        // Secondary: payload bay panels (4)
        rect(-1.30,-0.72, -0.55,-0.08, cx,cy, false,0.45,fill,glow);
        rect(-1.30, 0.08, -0.55, 0.72, cx,cy, false,0.45,fill,glow);
        rect(-0.38,-0.72,  0.38,-0.08, cx,cy, false,0.45,fill,glow);
        rect(-0.38, 0.08,  0.38, 0.72, cx,cy, false,0.45,fill,glow);
        // Secondary: front armor + rear engine
        rect(-1.48,-0.90, -1.18, 0.90, cx,cy, false,0.80,fill,glow);
        rect( 1.18,-0.68,  1.48, 0.68, cx,cy, false,0.80,fill,glow);
        // PRIMARY: wide flat hull rect
        rect(-1.48,-0.90, 1.48, 0.90, cx,cy, true,1.0,fill,glow);
        break;

      case 'swarm':
        // PRIMARY (only shape): dart arrowhead
        poly([[-0.52,0.00],[-0.24,-0.24],[0.52,-0.24],[0.52,0.24],[-0.24,0.24]],
             cx,cy, true,1.0,fill,glow);
        break;

      case 'controller':
        // Secondary: mast crossbar
        rect(-0.60,-1.06, 0.60,-0.88, cx,cy, false,0.80,fill,glow);
        // Secondary: forward arm + arm tip
        rect(-1.62, 0.16, -0.81, 0.56, cx,cy, false,0.90,fill,glow);
        rect(-1.62, 0.06, -1.40, 0.66, cx,cy, false,1.0,fill,glow);
        // PRIMARY: vertical mast rect (defines "tall" character)
        rect(-0.22,-1.24, 0.22, 0.00, cx,cy, true,1.0,fill,glow);
        // PRIMARY: horizontal body block (drawn with primary flag so both show at stage 0)
        rect(-0.81, 0.00, 0.81, 1.24, cx,cy, true,1.0,fill,glow);
        break;

      case 'adaptive':
        // Secondary: outer armor plates + inner hull detail
        rect(-0.50,-0.70, 1.10,-0.52, cx,cy, false,1.0,fill,glow);
        rect(-0.50, 0.52, 1.10, 0.70, cx,cy, false,1.0,fill,glow);
        rect(-0.35,-0.36, 0.95, 0.36, cx,cy, false,0.50,fill,glow);
        // Secondary: medium barrel
        bar(-0.50,0, -1.45,0, 0.16, cx,cy, false,1.0,fill,glow);
        // PRIMARY: main hull body
        rect(-0.50,-0.52, 1.10, 0.52, cx,cy, true,1.0,fill,glow);
        break;
    }

    // Chassis label
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ch, cx, cy + R * 3.8 + 8);
    ctx.restore();
  });
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

  // Debug mode: body-only silhouette, no decorations.
  if (MORPHOLOGY_SILHOUETTE_DEBUG) return;

  // v9: class decorations and refinement-tier rings disabled.
  // Keep only: chassis geometry + glow (applied inside spPoly/spRect/spBar via applyBodyFill).
}
