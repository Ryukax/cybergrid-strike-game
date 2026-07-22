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

// ─── Chassis 1: INTERCEPTOR ───────────────────────────────────────────────────
//
//  Combat role: fast pursuit / flanking.
//  Anatomy: torpedo fuselage + swept rear fins + engine nozzle + forward spike.
//  Direction is unambiguous: narrow tip at LEFT (FRONT), fins at RIGHT (REAR).
//
//  Speed → longer/narrower fuselage + wider fin sweep.
//  Evasion → greater fin span (more control surface).
//  Aggression → longer nose spike.
//
function drawChassisInterceptor(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const coreRX   = R * (1.05 + p.speed * 0.28);     // fuselage half-length
  const coreRY   = R * 0.26;                           // very narrow cross-section
  const finSpan  = R * (0.46 + p.evasion * 0.38);    // lateral fin reach
  const spikeLen = R * (0.26 + p.aggression * 0.24);  // forward attack spike
  const spikeW   = R * 0.10;                           // spike base half-width
  const nozzleR  = R * 0.13;                           // rear engine nozzle

  // 1. Swept fins — drawn first (underneath fuselage)
  //    Root is at the mid-rear of the fuselage; tip sweeps back and laterally.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + coreRX * 0.18, cy + s * coreRY * 0.85);  // inner root
    ctx.lineTo(cx + coreRX * 0.82, cy + s * finSpan);          // tip (rear + wide)
    ctx.lineTo(cx + coreRX,         cy + s * coreRY * 0.18);   // trailing corner
    ctx.closePath();
    applyBodyFill(ctx, fill, glow, flash, debug);
  }

  // 2. Fuselage torpedo ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy, coreRX, coreRY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);

  // 3. Engine nozzle (rear) — visible propulsion indicator
  compCircle(ctx, cx + coreRX, cy, nozzleR, fill, glow, flash, debug);

  // 4. Nose spike — weapon (drawn last = topmost = most prominent)
  ctx.beginPath();
  ctx.moveTo(cx - coreRX - spikeLen, cy);   // tip (FRONT)
  ctx.lineTo(cx - coreRX, cy - spikeW);      // base top
  ctx.lineTo(cx - coreRX, cy + spikeW);      // base bottom
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);

  return {
    frontReach: coreRX + spikeLen,
    rearReach:  coreRX + nozzleR,
    sideReach:  finSpan,
    R,
  };
}

// ─── Chassis 2: STRIKER ───────────────────────────────────────────────────────
//
//  Combat role: aggressive melee / rush.
//  Anatomy: compact body + dominant forward wedge head + small rear drive.
//  The wedge IS the weapon — mass concentrated at the forward attack surface.
//
//  Aggression → larger/longer wedge.
//  Mass → thicker body and wider wedge base.
//
function drawChassisStriker(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const wedgeLen = R * (0.55 + p.aggression * 0.45);  // dominant forward weapon
  const wedgeH   = R * (0.50 + p.mass * 0.14);         // wedge half-height at base
  const bodyRX   = R * (0.60 + p.mass * 0.12);
  const bodyRY   = R * (0.42 + p.mass * 0.06);
  const nubR     = R * 0.16;

  // Offset body rightward so the wedge dominates the left (FRONT) half
  const bodyCx = cx + wedgeLen * 0.32;

  // 1. Rear drive nub
  compCircle(ctx, bodyCx + bodyRX * 0.88, cy, nubR, fill, glow, flash, debug);

  // 2. Body ellipse
  ctx.beginPath();
  ctx.ellipse(bodyCx, cy, bodyRX, bodyRY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);

  // 3. Forward wedge (the melee weapon — drawn last = topmost)
  const tipX  = cx - wedgeLen;
  const baseX = bodyCx - bodyRX * 0.38;
  ctx.beginPath();
  ctx.moveTo(tipX,  cy);           // sharp tip (FRONT)
  ctx.lineTo(baseX, cy - wedgeH); // base top
  ctx.lineTo(baseX, cy + wedgeH); // base bottom
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);

  return {
    frontReach: cx - tipX,
    rearReach:  bodyCx + bodyRX * 0.88 + nubR - cx,
    sideReach:  Math.max(bodyRY, wedgeH),
    R,
  };
}

// ─── Chassis 3: ARTILLERY ────────────────────────────────────────────────────
//
//  Combat role: long-range projectile attack.
//  Anatomy: large rear support mass + small core + long forward barrel.
//  The barrel IS the weapon and the dominant silhouette feature.
//
//  AttackRange → longer barrel.
//  Mass → larger rear recoil mass.
//
function drawChassisArtillery(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const rearR     = R * (0.52 + p.mass * 0.20);           // large rear recoil mass
  const coreR     = R * 0.22;                               // small connector
  const barrelLen = R * (0.80 + p.attackRange * 1.00);     // dominant feature
  const barrelH   = R * 0.13;                               // barrel half-height (≥3px at R=12)

  // Position: rear mass rightward, core near center, barrel extends far left
  const rearCx   = cx + rearR * 0.68;
  const coreCx   = cx - rearR * 0.12;
  const barrelX1 = coreCx - coreR;         // barrel root
  const barrelX0 = barrelX1 - barrelLen;   // barrel tip (FRONT)

  // 1. Rear support mass (recoil absorber — drawn first)
  compCircle(ctx, rearCx, cy, rearR, fill, glow, flash, debug);

  // 2. Core connector
  compCircle(ctx, coreCx, cy, coreR, fill, glow, flash, debug);

  // 3. Barrel — the dominant ranged weapon (drawn last)
  compRect(ctx, barrelX0, cy - barrelH, barrelLen, barrelH * 2, fill, glow, flash, debug);

  // Muzzle ring (detail only in normal mode — gives barrel a clear endpoint)
  if (!debug && !flash) {
    ctx.beginPath();
    ctx.arc(barrelX0, cy, barrelH * 1.4, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.44)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }

  return {
    frontReach: cx - barrelX0,
    rearReach:  (rearCx + rearR) - cx,
    sideReach:  rearR,
    R,
  };
}

// ─── Chassis 4: TANK ─────────────────────────────────────────────────────────
//
//  Combat role: heavy armor / defensive.
//  Anatomy: thick armor annulus + protected core + short weapon stub.
//  The SHELL IS the silhouette — the core is visibly enclosed.
//
//  Armor → thicker shell (larger outer/inner ratio).
//  Mass → larger core.
//
function drawChassisTank(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const coreR  = R * (0.32 + p.mass * 0.10);
  const outerR = R * (0.78 + p.armor * 0.14);  // outer shell radius
  const gunLen = R * (0.18 + p.aggression * 0.14);  // short weapon stub
  const gunH   = R * 0.13;

  // 1. Armor shell — thick annulus (the dominant visual feature)
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, TAU, false);
  ctx.arc(cx, cy, coreR * 1.15, 0, TAU, true);  // inner — gap between shell and core
  if (debug) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, coreR * 1.15, 0, TAU); ctx.stroke();
  } else {
    ctx.shadowColor = glow;
    ctx.shadowBlur  = flash ? 4 : 8;
    ctx.fillStyle   = fill;
    ctx.fill('evenodd');
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth   = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, coreR * 1.15, 0, TAU); ctx.stroke();
  }

  // 2. Core (visible inside the shell)
  compCircle(ctx, cx, cy, coreR, fill, glow, flash, debug);

  // 3. Short weapon stub — exits the shell at FRONT
  compRect(ctx, cx - outerR - gunLen, cy - gunH, gunLen, gunH * 2, fill, glow, flash, debug);

  return {
    frontReach: outerR + gunLen,
    rearReach:  outerR,
    sideReach:  outerR,
    R,
  };
}

// ─── Chassis 5: RAMMER ───────────────────────────────────────────────────────
//
//  Combat role: frontal impact / ramming.
//  Anatomy: large forward arrowhead + compact rear body.
//  Mass is concentrated at the FRONT — the opposite of artillery.
//
//  Mass → larger arrowhead.
//  Aggression → wider arrowhead base (greater impact area).
//  Speed → slightly narrower (aerodynamic).
//
function drawChassisRammer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const arrowLen = R * (0.72 + p.mass * 0.32);       // dominant forward mass
  const arrowH   = R * (0.50 + p.aggression * 0.18); // impact width
  const bodyRX   = R * (0.52 + p.mass * 0.08);
  const bodyRY   = R * (0.40 + p.mass * 0.06);

  // Body offset rightward — arrowhead dominates the FRONT half
  const bodyCx = cx + arrowLen * 0.40;
  const tipX   = cx - arrowLen;                        // arrowhead tip (FRONT)
  const baseX  = bodyCx - bodyRX * 0.35;              // where arrowhead meets body

  // 1. Body (compact rear mass)
  ctx.beginPath();
  ctx.ellipse(bodyCx, cy, bodyRX, bodyRY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);

  // 2. Forward arrowhead (the entire weapon system — drawn last)
  ctx.beginPath();
  ctx.moveTo(tipX,  cy);           // sharp point (FRONT)
  ctx.lineTo(baseX, cy - arrowH); // base top
  ctx.lineTo(baseX, cy + arrowH); // base bottom
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);

  return {
    frontReach: cx - tipX,
    rearReach:  (bodyCx + bodyRX) - cx,
    sideReach:  arrowH,
    R,
  };
}

// ─── Chassis 6: TURRET ───────────────────────────────────────────────────────
//
//  Combat role: radial area attack.
//  Anatomy: central hub + multiple gun barrels radiating outward.
//  The BARRELS are the weapon — not decorative lobes.  Each is a distinct
//  rectangular structure with clear direction.
//
//  Aggression → more barrels (3–6).
//  AttackRange → longer barrels.
//
function drawChassisTurret(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const hubR     = R * 0.36;
  const gunCount = Math.max(3, Math.min(6, 3 + Math.floor(p.aggression * 4)));
  const gunLen   = R * (0.38 + p.attackRange * 0.34);
  const gunH     = R * 0.11;   // barrel half-height (≥3px at R=12)

  // 1. Barrels first (under hub, extend outward)
  for (let i = 0; i < gunCount; i++) {
    const angle = (i / gunCount) * TAU - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // Barrel: rect from just inside hub surface outward
    ctx.beginPath();
    ctx.rect(hubR * 0.80, -gunH, gunLen, gunH * 2);
    applyBodyFill(ctx, fill, glow, flash, debug);
    ctx.restore();
  }

  // 2. Hub (drawn on top — covers barrel roots)
  compCircle(ctx, cx, cy, hubR, fill, glow, flash, debug);

  const reach = hubR + gunLen;
  return { frontReach: reach, rearReach: reach, sideReach: reach, R };
}

// ─── Chassis 7: CARRIER ──────────────────────────────────────────────────────
//
//  Combat role: spawning / regeneration.
//  Anatomy: large body + pod ports at perimeter.
//  The body volume IS the silhouette — visible ports signal capacity.
//
//  Regen → more pods + larger body.
//  Mass → wider body.
//
function drawChassisCarrier(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const bodyRX   = R * (0.75 + p.mass * 0.14);
  const bodyRY   = R * (0.56 + p.mass * 0.10);
  const podR     = R * (0.14 + p.regen * 0.08);
  const podCount = p.regen > 0.68 ? 6 : 4;

  // 1. Body (large — the dominant mass)
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyRX, bodyRY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);

  // 2. Pod ports at body perimeter (functional: spawning / regen apertures)
  const angles =
    podCount === 6
      ? [0, TAU / 6, TAU * 2 / 6, TAU * 3 / 6, TAU * 4 / 6, TAU * 5 / 6]
      : [0, TAU / 4, TAU / 2, TAU * 3 / 4];

  for (const angle of angles) {
    const px = cx + bodyRX * 0.90 * Math.cos(angle);
    const py = cy + bodyRY * 0.90 * Math.sin(angle);
    compCircle(ctx, px, py, podR, fill, glow, flash, debug);
  }

  return {
    frontReach: bodyRX + podR,
    rearReach:  bodyRX + podR,
    sideReach:  bodyRY + podR,
    R,
  };
}

// ─── Chassis 8: SWARM ────────────────────────────────────────────────────────
//
//  Combat role: fast, expendable unit optimized for replication.
//  Anatomy: compact body + small forward spike + rear nub.
//  Deliberately minimal — strength in numbers, not individual anatomy.
//
//  Speed → more prominent rear nub (propulsion).
//  Aggression → longer spike.
//
function drawChassisSwarm(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const bodyR  = R * 0.50;
  const spikeL = R * (0.16 + p.aggression * 0.14);
  const spikeW = R * 0.09;
  const nubR   = R * (0.10 + p.speed * 0.05);

  // 1. Rear propulsion nub
  compCircle(ctx, cx + bodyR, cy, nubR, fill, glow, flash, debug);

  // 2. Body
  compCircle(ctx, cx, cy, bodyR, fill, glow, flash, debug);

  // 3. Forward spike (weapon)
  ctx.beginPath();
  ctx.moveTo(cx - bodyR - spikeL, cy);   // tip (FRONT)
  ctx.lineTo(cx - bodyR, cy - spikeW);
  ctx.lineTo(cx - bodyR, cy + spikeW);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash, debug);

  return {
    frontReach: bodyR + spikeL,
    rearReach:  bodyR + nubR,
    sideReach:  bodyR,
    R,
  };
}

// ─── Chassis 9: CONTROLLER ───────────────────────────────────────────────────
//
//  Combat role: radial area control / field emitter.
//  Anatomy: hub + 3 long structural arms + large emitter nodes at tips.
//  The arms ARE the weapon delivery system — they establish area presence.
//
//  AttackRange → longer arms.
//  SensorRadius → larger emitter nodes.
//
function drawChassisController(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const hubR   = R * 0.34;
  const armLen = R * (0.52 + p.attackRange * 0.48);
  const armH   = R * 0.11;
  const nodeR  = R * (0.16 + p.sensorRadius * 0.08);

  // 3 arms spaced 120° apart; one arm points directly REAR (0°) for stability
  const angles = [REAR, REAR + TAU / 3, REAR + 2 * TAU / 3];

  // 1. Arms (structural conduits — drawn first)
  for (const angle of angles) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.rect(hubR * 0.78, -armH, armLen, armH * 2);
    applyBodyFill(ctx, fill, glow, flash, debug);
    ctx.restore();
  }

  // 2. Emitter nodes at arm tips
  for (const angle of angles) {
    const nx = cx + (hubR + armLen) * Math.cos(angle);
    const ny = cy + (hubR + armLen) * Math.sin(angle);
    compCircle(ctx, nx, ny, nodeR, fill, glow, flash, debug);
  }

  // 3. Hub (drawn on top of arm bases)
  compCircle(ctx, cx, cy, hubR, fill, glow, flash, debug);

  const reach = hubR + armLen + nodeR;
  return { frontReach: reach, rearReach: reach, sideReach: reach, R };
}

// ─── Chassis 10: ADAPTIVE ────────────────────────────────────────────────────
//
//  Combat role: asymmetric / emergent.
//  Anatomy: offset core + one dominant functional arm (direction biased toward FRONT).
//  The arm tip component signals the dominant function.
//
function drawChassisAdaptive(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  p: VirusPhenotype,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const h = (s: number) => normalizedHash(p.n, s);

  const coreR    = R * (0.42 + p.mass * 0.10);
  const offX     = (h(53) - 0.5) * R * 0.18;   // slight asymmetric offset
  const offY     = (h(54) - 0.5) * R * 0.18;
  const armAngle = FRONT + (h(55) - 0.5) * 0.55; // biased toward FRONT axis
  const armLen   = R * (0.38 + Math.max(p.speed, p.aggression, p.attackRange) * 0.52);
  const armH     = R * 0.11;
  const headR    = R * (0.18 + Math.max(p.aggression, p.attackRange) * 0.10);

  // 1. Core (offset slightly for asymmetry)
  compCircle(ctx, cx + offX, cy + offY, coreR, fill, glow, flash, debug);

  // 2. Dominant structural arm
  ctx.save();
  ctx.translate(cx + offX, cy + offY);
  ctx.rotate(armAngle);
  ctx.beginPath();
  ctx.rect(coreR * 0.78, -armH, armLen, armH * 2);
  applyBodyFill(ctx, fill, glow, flash, debug);
  ctx.restore();

  // 3. Functional head at arm tip (weapon / sensor / pod)
  const tipX = cx + offX + (coreR + armLen) * Math.cos(armAngle);
  const tipY = cy + offY + (coreR + armLen) * Math.sin(armAngle);
  compCircle(ctx, tipX, tipY, headR, fill, glow, flash, debug);

  return {
    frontReach: coreR + armLen + headR,
    rearReach:  coreR,
    sideReach:  coreR + armLen * 0.50,
    R,
  };
}

// ─── Chassis dispatcher ───────────────────────────────────────────────────────

/** Draw the chassis for a given phenotype and return its geometry. */
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

// ─── Silhouette debug grid ────────────────────────────────────────────────────
//
//  drawSilhouetteDebugGrid(ctx, w, h) renders all 10 chassis as flat-white
//  silhouettes on black.  Acceptance test: every chassis must be identifiable
//  by silhouette alone before structures / glow / color are enabled.
//
//  Set MORPHOLOGY_SILHOUETTE_DEBUG = true to activate in gameplay.

/** Representative trait values for each chassis (used in debug grid). */
const CHASSIS_PREVIEW_TRAITS: Record<ChassisType, Partial<VirusPhenotype>> = {
  interceptor: { speed: 0.72, evasion: 0.55, aggression: 0.50, attackRange: 0.25, armor: 0.22, mass: 0.30, regen: 0.30, sensorRadius: 0.40, symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins' },
  striker:     { aggression: 0.80, mass: 0.55, speed: 0.55, attackRange: 0.20, armor: 0.35, regen: 0.28, evasion: 0.30, sensorRadius: 0.35, symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins' },
  artillery:   { attackRange: 0.85, mass: 0.60, speed: 0.25, aggression: 0.35, armor: 0.38, regen: 0.30, evasion: 0.18, sensorRadius: 0.55, symmetry: 'bilateral', attackStyle: 'ranged', locomotionType: 'passive' },
  tank:        { armor: 0.80, mass: 0.65, speed: 0.22, aggression: 0.38, attackRange: 0.35, regen: 0.40, evasion: 0.12, sensorRadius: 0.35, symmetry: 'bilateral', attackStyle: 'pulse', locomotionType: 'passive' },
  rammer:      { mass: 0.75, aggression: 0.72, speed: 0.48, attackRange: 0.22, armor: 0.45, regen: 0.28, evasion: 0.22, sensorRadius: 0.30, symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins' },
  turret:      { aggression: 0.65, attackRange: 0.48, mass: 0.50, speed: 0.28, armor: 0.55, regen: 0.38, evasion: 0.18, sensorRadius: 0.45, symmetry: 'radial', attackStyle: 'pulse', locomotionType: 'passive' },
  carrier:     { regen: 0.78, mass: 0.60, speed: 0.30, aggression: 0.25, armor: 0.42, attackRange: 0.28, evasion: 0.22, sensorRadius: 0.45, symmetry: 'bilateral', attackStyle: 'pulse', locomotionType: 'passive' },
  swarm:       { speed: 0.72, mass: 0.25, aggression: 0.48, attackRange: 0.28, armor: 0.20, regen: 0.22, evasion: 0.45, sensorRadius: 0.30, symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins' },
  controller:  { attackRange: 0.72, sensorRadius: 0.68, mass: 0.42, speed: 0.30, aggression: 0.40, armor: 0.40, regen: 0.45, evasion: 0.20, symmetry: 'radial', attackStyle: 'ranged', locomotionType: 'passive' },
  adaptive:    { speed: 0.48, aggression: 0.55, mass: 0.42, attackRange: 0.45, armor: 0.35, regen: 0.38, evasion: 0.32, sensorRadius: 0.40, symmetry: 'asymmetric', attackStyle: 'melee', locomotionType: 'fins' },
};

export function drawSilhouetteDebugGrid(
  ctx:    CanvasRenderingContext2D,
  width:  number,
  height: number,
): void {
  const chassis: ChassisType[] = [
    'interceptor', 'striker', 'artillery', 'rammer', 'swarm',
    'tank', 'turret', 'carrier', 'controller', 'adaptive',
  ];

  const cols  = 5;
  const rows  = 2;
  const cellW = width  / cols;
  const cellH = height / rows;
  const R     = Math.min(cellW, cellH) * 0.24;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  chassis.forEach((ch, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx  = cellW * (col + 0.5);
    const cy  = cellH * (row + 0.5) - R * 0.30;

    const traits = CHASSIS_PREVIEW_TRAITS[ch];
    const p: VirusPhenotype = {
      n: 7, cls: 'prime', lobes: 5, spikes: [], spikeCount: 3,
      speed: 0.5, armor: 0.5, mass: 0.5, attackRange: 0.5,
      sensorRadius: 0.5, aggression: 0.5, regen: 0.5, evasion: 0.5,
      symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins',
      chassis: ch,
      ...traits,
    };

    drawChassis(ctx, cx, cy, R, p, '#fff', 'transparent', false, true);

    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.font      = `${Math.max(9, R * 0.52)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(ch, cx, cy + R * 1.80);
  });
}


// All anatomy is rendered inside the 10 chassis functions above.
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
  if (!green) {
    const effectiveR = (geo.frontReach + geo.rearReach + geo.sideReach) / 3;
    if (cls === 'perfect-square' || cls === 'power-of-two') {
      // Inner ring — radial class marker
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR * 0.40, 0, TAU);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    if (cls === 'power-of-two') {
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR * 0.68, 0, TAU);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
    if (cls === 'prime' && !flash) {
      // Radial spokes — bilateral class marker
      const L = getVirusLobes(n);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth   = 0.8;
      for (let i = 0; i < L; i++) {
        const a = (i / L) * TAU - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + effectiveR * 0.58 * Math.cos(a), cy + effectiveR * 0.58 * Math.sin(a));
        ctx.stroke();
      }
    }
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
      // Tier 3: apex crown — spines at each lobe peak
      const lobes  = getVirusLobes(n);
      const spread = 0.10;
      ctx.strokeStyle = `rgba(255,255,255,${t3 * 0.55})`;
      ctx.lineWidth   = 1.5;
      for (let i = 0; i < lobes; i++) {
        const a  = (i / lobes) * TAU - Math.PI / 2;
        const r0 = effectiveR * 1.12;
        const r1 = effectiveR * (1.52 + t3 * 0.20);
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
      ctx.arc(cx, cy, effectiveR * 1.08, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${t3 * 0.10})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}
