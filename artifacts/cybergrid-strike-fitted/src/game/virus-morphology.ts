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

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  Types
// ═══════════════════════════════════════════════════════════════════════════════

export type VirusClass =
  | 'prime'
  | 'power-of-two'
  | 'perfect-square'
  | 'even-composite'
  | 'odd-composite';

export type BodyArchitecture =
  | 'compact'
  | 'elongated'
  | 'forwardWeighted'
  | 'rearWeighted'
  | 'segmented'
  | 'ring'
  | 'radialCore'
  | 'splitCore'
  | 'winged'
  | 'shielded';

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
  architecture:   BodyArchitecture;
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

/** Derive the body architecture from phenotype traits. Deterministic — no randomness. */
function deriveArchitecture(
  symmetry: VirusPhenotype['symmetry'],
  p: {
    speed: number; armor: number; mass: number; regen: number;
    evasion: number; aggression: number; attackRange: number;
  },
): BodyArchitecture {
  if (symmetry === 'radial') {
    // Radial viruses: armored rings or polygonal cores
    return p.armor > 0.55 ? 'ring' : 'radialCore';
  }

  if (symmetry === 'bilateral') {
    // Regenerative organisms build segmented multi-mass bodies
    if (p.regen > 0.58 && p.speed < 0.56) return 'segmented';
    // Heavy armored slow organisms become shielded walls
    if (p.armor > 0.60 && p.speed < 0.42) return 'shielded';
    // Moderately armored slow organisms become compact hubs
    if (p.armor > 0.46 && p.speed < 0.42) return 'compact';
    // Agile evasive organisms grow wings
    if (p.evasion > 0.56 && p.speed > 0.46) return 'winged';
    // Ranged heavy organisms have rear-weighted propulsion
    if (p.attackRange > 0.62 && p.mass > 0.52) return 'rearWeighted';
    // Fast aggressive pursuit predators are forward-weighted
    if (p.speed > 0.62 && p.aggression > 0.50) return 'forwardWeighted';
    // Fast organisms are elongated
    if (p.speed > 0.50) return 'elongated';
    return 'compact';
  }

  // asymmetric
  if (p.regen > 0.56) return 'splitCore';
  if (p.speed > 0.58) return 'elongated';
  if (p.armor > 0.52) return 'compact';
  if (p.aggression > 0.56) return 'forwardWeighted';
  return 'compact';
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

  // Locomotion type.
  const locomotionType: VirusPhenotype['locomotionType'] =
    speed > 0.62 && mass > 0.60 ? 'jets'
    : speed > 0.50               ? 'fins'
    : 'passive';

  // Body architecture — derived from all traits above.
  const architecture = deriveArchitecture(symmetry, {
    speed, armor, mass, regen, evasion, aggression, attackRange,
  });

  return {
    n, cls, lobes, spikes, spikeCount,
    speed, armor, mass, attackRange, sensorRadius,
    aggression, regen, evasion,
    symmetry, attackStyle, locomotionType, architecture,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  Body rendering — one function per architecture
//
//  Each function:
//    1. Builds the primary body path
//    2. Applies fill + glow (or handles complex cases like ring/segmented)
//    3. Returns BodyGeometry so structures attach to the correct surface
//
//  The body IS the silhouette — no external sinusoidal lobe modifier.
// ═══════════════════════════════════════════════════════════════════════════════

function applyBodyFill(
  ctx:   CanvasRenderingContext2D,
  fill:  string,
  glow:  string,
  flash: boolean,
): void {
  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.24)';
  ctx.lineWidth   = 1.2;
  ctx.stroke();
}

/** Broad, near-circular hub. Slightly wider than tall. */
function drawBodyCompact(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const rX = R * 0.92, rY = R * 0.84;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rX, rY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash);
  return { frontReach: rX, rearReach: rX, sideReach: rY, R };
}

/** Long horizontal ellipse — clear forward thrust axis. */
function drawBodyElongated(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  speed: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const stretch = 0.65 + speed * 0.30;
  const rX = R * (1.10 + stretch * 0.22);
  const rY = R * Math.max(0.34, 0.62 - stretch * 0.18);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rX, rY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash);
  return { frontReach: rX, rearReach: rX, sideReach: rY, R };
}

/**
 * Teardrop: large attack-facing bulge tapering to a narrow rear.
 * FRONT = left = the wide end.  REAR = right = the narrow tip.
 */
function drawBodyForwardWeighted(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  aggression: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const fR = R * (0.98 + aggression * 0.10);  // front bulge radius
  const rR = R * 0.36;                          // rear tip radius (half-width)
  const sH = R * (0.72 + aggression * 0.06);   // half-height at widest point

  // FRONT is left (FRONT = π → cos(π) = -1).  So the front bulge is at cx - fR.
  // REAR is right (REAR = 0 → cos(0) = 1).  Rear narrow tip is at cx + rR.
  const fX = cx - fR;   // leftmost (front — wide end)
  const rX = cx + rR;   // rightmost (rear — narrow tip)

  ctx.beginPath();
  ctx.moveTo(fX, cy);
  // Upper half: tangent rises straight up from front, converges to rear tip from above
  ctx.bezierCurveTo(fX, cy - sH, rX, cy - sH * 0.22, rX, cy);
  // Lower half: symmetric
  ctx.bezierCurveTo(rX, cy + sH * 0.22, fX, cy + sH, fX, cy);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash);
  return { frontReach: fR, rearReach: rR, sideReach: sH, R };
}

/**
 * Reversed teardrop: large propulsion rear, narrow attack tip pointing FRONT.
 * FRONT = left = narrow tip.  REAR = right = wide propulsion mass.
 */
function drawBodyRearWeighted(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  mass: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const fR = R * 0.40;                          // front tip
  const rR = R * (0.90 + mass * 0.12);          // rear bulk
  const sH = R * (0.70 + mass * 0.08);

  const fX = cx - fR;   // leftmost (front — narrow tip)
  const rX = cx + rR;   // rightmost (rear — wide end)

  ctx.beginPath();
  ctx.moveTo(fX, cy);
  // Upper half: front tip rises gently, rear bulges broadly upward
  ctx.bezierCurveTo(fX, cy - sH * 0.22, rX, cy - sH, rX, cy);
  // Lower half: symmetric
  ctx.bezierCurveTo(rX, cy + sH, fX, cy + sH * 0.22, fX, cy);
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash);
  return { frontReach: fR, rearReach: rR, sideReach: sH, R };
}

/**
 * Three connected structural masses arranged along the FRONT-REAR axis.
 * Front segment (attack), middle segment (core), rear segment (propulsion).
 */
function drawBodySegmented(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const segR    = R * 0.44;
  const spacing = R * 0.60;          // center-to-center

  // Draw middle segment first (largest), then front and rear
  const segments: [number, number][] = [
    [cx,           segR * 1.08],    // middle — slightly larger
    [cx - spacing, segR * 0.94],    // front (left)
    [cx + spacing, segR * 0.90],    // rear (right)
  ];

  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;

  for (const [sx, sr] of segments) {
    ctx.beginPath();
    ctx.arc(sx, cy, sr, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Connective bridges (filled trapezoids between segments)
  const bridgeH = segR * 0.52;
  for (const [sx, dir] of [[cx - spacing * 0.50, -1], [cx + spacing * 0.50, 1]] as [number, number][]) {
    void dir;
    ctx.beginPath();
    ctx.rect(sx - spacing * 0.24, cy - bridgeH, spacing * 0.48, bridgeH * 2);
    ctx.fill();
  }

  // Stroke each segment
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.24)';
  ctx.lineWidth   = 1.2;
  for (const [sx, sr] of segments) {
    ctx.beginPath();
    ctx.arc(sx, cy, sr, 0, TAU);
    ctx.stroke();
  }

  return {
    frontReach: spacing + segR * 0.94,
    rearReach:  spacing + segR * 0.90,
    sideReach:  segR * 1.08,
    R,
  };
}

/**
 * Annular body — mass distributed as a ring around a central void.
 * Used by radial viruses with high armor.
 */
function drawBodyRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  armor: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const outerR  = R * 0.92;
  const ringW   = R * (0.28 + armor * 0.14);  // ring thickness
  const innerR  = outerR - ringW;

  // Filled donut via evenodd winding rule
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, TAU, false);   // outer CCW
  ctx.arc(cx, cy, innerR, 0, TAU, true);    // inner CW (hole)

  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;
  ctx.fill('evenodd');
  ctx.shadowBlur  = 0;

  // Stroke outer and inner separately for clean edges
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.24)';
  ctx.lineWidth   = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, TAU); ctx.stroke();

  return { frontReach: outerR, rearReach: outerR, sideReach: outerR, R };
}

/**
 * Regular polygon — clean geometric form for radial attackers.
 * Sides derived from lobes (5–8).  Slightly rounded by draw approach.
 */
function drawBodyRadialCore(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  lobes: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const sides   = Math.min(8, Math.max(5, lobes));
  const polyR   = R * 0.88;
  // Rotate so a flat edge faces UP (top) for visual stability
  const baseAngle = -Math.PI / 2 + Math.PI / sides;

  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = baseAngle + (i / sides) * TAU;
    const x = cx + polyR * Math.cos(a);
    const y = cy + polyR * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash);
  // Inset ridge line
  if (!flash) {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = baseAngle + (i / sides) * TAU;
      const x = cx + polyR * 0.62 * Math.cos(a);
      const y = cy + polyR * 0.62 * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  }
  return { frontReach: polyR, rearReach: polyR, sideReach: polyR, R };
}

/**
 * Two vertically-offset masses connected by a bridge — figure-8 / H shape.
 * Used by asymmetric composites with regen.
 */
function drawBodySplitCore(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  n: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const lR      = R * 0.52;                    // lobe radius
  const offset  = R * (0.40 + normalizedHash(n, 53) * 0.08);  // vertical offset

  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;

  // Top lobe
  ctx.beginPath(); ctx.arc(cx, cy - offset, lR, 0, TAU); ctx.fill();
  // Bottom lobe
  ctx.beginPath(); ctx.arc(cx, cy + offset, lR, 0, TAU); ctx.fill();
  // Bridge
  ctx.beginPath();
  ctx.rect(cx - lR * 0.46, cy - offset, lR * 0.92, offset * 2);
  ctx.fill();

  ctx.shadowBlur  = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.24)';
  ctx.lineWidth   = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy - offset, lR, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy + offset, lR, 0, TAU); ctx.stroke();

  return { frontReach: lR, rearReach: lR, sideReach: offset + lR, R };
}

/**
 * Narrow central body with swept wing surfaces.
 * Communicates: speed + lateral maneuverability.
 */
function drawBodyWinged(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  speed: number, evasion: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const bRX     = R * 0.52;           // central body half-width
  const bRY     = R * 0.28;           // central body half-height
  const wingH   = R * (0.82 + evasion * 0.20);  // wing half-span
  const wingX   = cx + R * (0.30 + speed * 0.12); // wing trailing x

  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;

  // Wing surfaces (drawn first so body sits on top)
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx - bRX * 0.65, cy + side * bRY * 0.85);   // front root
    ctx.lineTo(cx + bRX * 0.50, cy + side * bRY * 0.85);   // rear root
    ctx.lineTo(wingX,            cy + side * wingH);          // wing tip
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Central body ellipse
  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.beginPath();
  ctx.ellipse(cx, cy, bRX, bRY, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur  = 0;

  // Strokes
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.24)';
  ctx.lineWidth   = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx - bRX * 0.65, cy + side * bRY * 0.85);
    ctx.lineTo(cx + bRX * 0.50, cy + side * bRY * 0.85);
    ctx.lineTo(wingX,            cy + side * wingH);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, bRX, bRY, 0, 0, TAU);
  ctx.stroke();

  return { frontReach: bRX, rearReach: Math.max(bRX, wingX - cx), sideReach: wingH, R };
}

/**
 * D-shape: flat armoured face at FRONT (left), rounded propulsion dome at REAR (right).
 * Communicates: heavy frontal defence, slow movement.
 */
function drawBodyShielded(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  armor: number,
  fill: string, glow: string, flash: boolean,
): BodyGeometry {
  const flatX = cx - R * (0.62 + armor * 0.08); // x of the flat shield face (left)
  const domeX = cx + R * (0.62 + armor * 0.06); // x of dome peak (right)
  const halfH = R * (0.88 + armor * 0.06);

  ctx.beginPath();
  ctx.moveTo(flatX, cy - halfH);    // top of shield face
  ctx.lineTo(flatX, cy + halfH);    // bottom of shield face (flat vertical edge)
  ctx.bezierCurveTo(
    domeX + R * 0.48, cy + halfH,   // lower dome ctrl
    domeX + R * 0.48, cy - halfH,   // upper dome ctrl
    flatX, cy - halfH,              // back to top of shield face
  );
  ctx.closePath();
  applyBodyFill(ctx, fill, glow, flash);

  // Shield face panel lines
  if (!flash) {
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth   = 1;
    // Horizontal panel seams on the flat face
    for (const dy of [-halfH * 0.38, 0, halfH * 0.38]) {
      ctx.beginPath();
      ctx.moveTo(flatX, cy + dy);
      ctx.lineTo(flatX + R * 0.28, cy + dy);
      ctx.stroke();
    }
    // Vertical centre line on dome
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfH * 0.72);
    ctx.lineTo(cx, cy + halfH * 0.72);
    ctx.stroke();
  }

  const frontReach = cx - flatX;       // = R * (0.62 + armor * 0.08)
  const domeReach  = domeX + R * 0.48 * 0.7 - cx;  // approximate dome rightmost
  return { frontReach, rearReach: domeReach, sideReach: halfH, R };
}

/** Dispatch to the correct body drawing function and return geometry. */
function drawPrimaryBody(
  ctx:   CanvasRenderingContext2D,
  cx:    number, cy: number, R: number,
  p:     VirusPhenotype,
  fill:  string, glow: string, flash: boolean,
): BodyGeometry {
  switch (p.architecture) {
    case 'elongated':       return drawBodyElongated(ctx, cx, cy, R, p.speed, fill, glow, flash);
    case 'forwardWeighted': return drawBodyForwardWeighted(ctx, cx, cy, R, p.aggression, fill, glow, flash);
    case 'rearWeighted':    return drawBodyRearWeighted(ctx, cx, cy, R, p.mass, fill, glow, flash);
    case 'segmented':       return drawBodySegmented(ctx, cx, cy, R, fill, glow, flash);
    case 'ring':            return drawBodyRing(ctx, cx, cy, R, p.armor, fill, glow, flash);
    case 'radialCore':      return drawBodyRadialCore(ctx, cx, cy, R, p.lobes, fill, glow, flash);
    case 'splitCore':       return drawBodySplitCore(ctx, cx, cy, R, p.n, fill, glow, flash);
    case 'winged':          return drawBodyWinged(ctx, cx, cy, R, p.speed, p.evasion, fill, glow, flash);
    case 'shielded':        return drawBodyShielded(ctx, cx, cy, R, p.armor, fill, glow, flash);
    default:                return drawBodyCompact(ctx, cx, cy, R, fill, glow, flash);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7  Structural grammar — anchor-driven
//
//  All geometry is expressed relative to (cx, cy) using the body's actual
//  frontReach / rearReach / sideReach from BodyGeometry rather than a nominal R.
//
//  Sizing (lineWidth, node radius, etc.) still uses geo.R.
//
//  Layer order (same for all symmetry types):
//    1. Locomotion  (rear structures)
//    2. Weapons     (front / perimeter)
//    3. Armor       (perimeter)
//    4. Sensors     (forward-top)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── A. BILATERAL structures ──────────────────────────────────────────────────

function bilateralFins(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, speed: number, alpha: number,
): void {
  const R = geo.R;
  const reach  = geo.rearReach;
  const height = R * (0.46 + speed * 0.28);
  const spread = 0.34;

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.78})`;
  ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.18})`;
  ctx.lineWidth   = 1.5;

  for (const side of [-1, 1]) {
    const baseAngle = REAR + side * spread;
    const bx = cx + reach * 0.90 * Math.cos(baseAngle);
    const by = cy + reach * 0.90 * Math.sin(baseAngle);
    const tipAngle = REAR + side * (spread + 0.26);
    const tx = cx + (reach + height) * Math.cos(tipAngle);
    const ty = cy + (reach + height) * Math.sin(tipAngle);
    const inAngle = REAR + side * (spread - 0.22);
    const ix = cx + reach * 0.62 * Math.cos(inAngle);
    const iy = cy + reach * 0.62 * Math.sin(inAngle);

    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(ix, iy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function bilateralJets(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, mass: number, speed: number, alpha: number,
): void {
  const R = geo.R;
  const reach  = geo.rearReach;
  const portR  = R * (0.10 + mass * 0.05);
  const offset = 0.28;

  ctx.save();
  for (const side of [-1, 1]) {
    const angle = REAR + side * offset;
    const px = cx + reach * 0.90 * Math.cos(angle);
    const py = cy + reach * 0.90 * Math.sin(angle);

    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.82})`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(px, py, portR, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.32})`;
    ctx.beginPath(); ctx.arc(px, py, portR * 0.52, 0, TAU); ctx.fill();

    if (speed > 0.55) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
      ctx.lineWidth   = portR * 1.4;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + R * 0.32, py);   // rearward plume
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }
  ctx.restore();
}

function bilateralClaws(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, aggression: number, alpha: number,
): void {
  const R = geo.R;
  const reach  = geo.frontReach;
  const length = R * (0.44 + aggression * 0.24);
  const spread = 0.30 + aggression * 0.06;

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.88})`;
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';

  for (const side of [-1, 1]) {
    const baseAngle = FRONT + side * spread;
    const bx = cx + reach * 0.88 * Math.cos(baseAngle);
    const by = cy + reach * 0.88 * Math.sin(baseAngle);
    const tipAngle = FRONT + side * spread * 0.28;
    const tx = cx + (reach + length) * Math.cos(tipAngle);
    const ty = cy + (reach + length) * Math.sin(tipAngle);
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

function bilateralBarrels(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, mass: number, sensorRadius: number, alpha: number,
): void {
  const R = geo.R;
  const reach        = geo.frontReach;
  const dual         = sensorRadius > 0.58;
  const barrelLength = R * (0.50 + mass * 0.18);
  const barrelWidth  = R * (0.07 + mass * 0.04);
  const spread       = 0.17;
  const offsets      = dual ? [-1, 1] : [0];

  ctx.save();
  ctx.lineCap = 'butt';

  for (const s of offsets) {
    const angle = FRONT + s * spread;
    const bx = cx + reach * 0.80 * Math.cos(angle);
    const by = cy + reach * 0.80 * Math.sin(angle);
    const ex = cx + (reach + barrelLength) * Math.cos(angle);
    const ey = cy + (reach + barrelLength) * Math.sin(angle);

    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.80})`;
    ctx.lineWidth   = barrelWidth * 2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.95})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(ex, ey, barrelWidth * 0.90, 0, TAU); ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.restore();
}

function bilateralPulseEmitters(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, alpha: number,
): void {
  const R = geo.R;
  const nodeR = R * 0.13;
  const dist  = geo.sideReach * 0.90;

  ctx.save();
  for (const angle of [UP, DOWN]) {
    const nx = cx + dist * Math.cos(angle);
    const ny = cy + dist * Math.sin(angle);

    ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.40})`;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function bilateralArmorArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, armor: number, alpha: number,
): void {
  const R = geo.R;
  const coverage = Math.PI * (0.40 + armor * 0.25);
  const shellR   = geo.frontReach * 0.95;
  const thick    = R * (0.09 + armor * 0.08);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.50 + armor * 0.22)})`;
  ctx.lineWidth   = thick;
  ctx.beginPath();
  ctx.arc(cx, cy, shellR, FRONT - coverage, FRONT + coverage);
  ctx.stroke();
  // Panel seam lines
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

function bilateralFlankPlates(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, armor: number, alpha: number,
): void {
  const R = geo.R;
  const arcSpan = Math.PI * (0.28 + armor * 0.14);
  const plateR  = geo.sideReach * 0.92;
  const thick   = R * (0.07 + armor * 0.06);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.44 + armor * 0.18)})`;
  ctx.lineWidth   = thick;
  for (const center of [UP, DOWN]) {
    ctx.beginPath();
    ctx.arc(cx, cy, plateR, center - arcSpan, center + arcSpan);
    ctx.stroke();
  }
  ctx.restore();
}

function bilateralAntennae(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, sensorRadius: number, aggression: number, alpha: number,
): void {
  const R = geo.R;
  const length      = R * (0.48 + sensorRadius * 0.34);
  const spread      = 0.22 + sensorRadius * 0.12;
  const centerAngle = aggression > 0.55 ? UP + 0.14 : UP;
  const nodeR       = R * (0.042 + sensorRadius * 0.024);
  const sideR       = geo.sideReach;

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.72})`;
  ctx.lineWidth   = 1.5;

  for (const side of [-1, 1]) {
    const baseAngle = centerAngle + side * spread;
    const bx = cx + sideR * 0.86 * Math.cos(baseAngle);
    const by = cy + sideR * 0.86 * Math.sin(baseAngle);
    const tipAngle = baseAngle + side * 0.12;
    const tx = cx + (sideR + length) * Math.cos(tipAngle);
    const ty = cy + (sideR + length) * Math.sin(tipAngle);

    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.90})`;
    ctx.beginPath(); ctx.arc(tx, ty, nodeR, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ─── B. RADIAL structures ─────────────────────────────────────────────────────

function radialFins(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, lobes: number, speed: number, alpha: number,
): void {
  const R = geo.R;
  const count  = Math.min(lobes, 6);
  const reach  = (geo.frontReach + geo.rearReach) / 2;
  const height = R * (0.38 + speed * 0.20);
  const half   = Math.PI / count * 0.36;

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.72})`;
  ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.16})`;
  ctx.lineWidth   = 1.5;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU - Math.PI / 2;
    const bxL = cx + reach * 0.82 * Math.cos(a - half);
    const byL = cy + reach * 0.82 * Math.sin(a - half);
    const bxR = cx + reach * 0.82 * Math.cos(a + half);
    const byR = cy + reach * 0.82 * Math.sin(a + half);
    const tx  = cx + (reach + height) * Math.cos(a);
    const ty  = cy + (reach + height) * Math.sin(a);

    ctx.beginPath();
    ctx.moveTo(bxL, byL); ctx.lineTo(tx, ty); ctx.lineTo(bxR, byR);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function radialShell(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, armor: number, lobes: number, alpha: number,
): void {
  const R = geo.R;
  const shellR = (geo.frontReach + geo.rearReach) / 2 * 0.93;
  const thick  = R * (0.09 + armor * 0.09);
  const seams  = Math.min(lobes, 6);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.48 + armor * 0.22)})`;
  ctx.lineWidth   = thick;
  ctx.beginPath(); ctx.arc(cx, cy, shellR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.38})`;
  ctx.lineWidth   = 1;
  for (let i = 0; i < seams; i++) {
    const a = (i / seams) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + (shellR - thick * 0.55) * Math.cos(a), cy + (shellR - thick * 0.55) * Math.sin(a));
    ctx.lineTo(cx + (shellR + thick * 0.55) * Math.cos(a), cy + (shellR + thick * 0.55) * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();
}

function radialWeapon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, lobes: number,
  attackStyle: 'melee' | 'pulse' | 'ranged',
  aggression: number, alpha: number,
): void {
  const R = geo.R;
  const count = Math.min(lobes, 6);
  const reach = (geo.frontReach + geo.rearReach) / 2;
  ctx.save();

  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU - Math.PI / 2;

    if (attackStyle === 'ranged') {
      const barrelLen = R * (0.28 + aggression * 0.10);
      const barrelW   = R * 0.06;
      const bx = cx + reach * 0.78 * Math.cos(a);
      const by = cy + reach * 0.78 * Math.sin(a);
      const ex = cx + (reach + barrelLen) * Math.cos(a);
      const ey = cy + (reach + barrelLen) * Math.sin(a);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.82})`;
      ctx.lineWidth   = barrelW * 2;
      ctx.lineCap     = 'butt';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineCap     = 'round';
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.95})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.arc(ex, ey, barrelW * 0.85, 0, TAU); ctx.stroke();

    } else if (attackStyle === 'melee') {
      const spineLen = R * (0.34 + aggression * 0.16);
      const bx = cx + reach * 0.84 * Math.cos(a);
      const by = cy + reach * 0.84 * Math.sin(a);
      const ex = cx + (reach + spineLen) * Math.cos(a);
      const ey = cy + (reach + spineLen) * Math.sin(a);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.88})`;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineCap     = 'butt';

    } else {
      const nodeR = R * 0.10;
      const nx = cx + reach * 0.86 * Math.cos(a);
      const ny = cy + reach * 0.86 * Math.sin(a);
      ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.42})`;
      ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.62})`;
      ctx.lineWidth   = 1.8;
      ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.20})`;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.0, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
}

function radialSensorNodes(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, sensorRadius: number, lobes: number, alpha: number,
): void {
  const R = geo.R;
  const count = Math.min(lobes, 8);
  const nodeR = R * (0.042 + sensorRadius * 0.022);
  const dist  = (geo.frontReach + geo.rearReach) / 2 * 0.90;

  ctx.save();
  for (let i = 0; i < count; i++) {
    const a  = (i / count) * TAU - Math.PI / 2;
    const nx = cx + dist * Math.cos(a);
    const ny = cy + dist * Math.sin(a);
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.88})`;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30})`;
    ctx.lineWidth   = 0.8;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.2, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ─── C. ASYMMETRIC structures ─────────────────────────────────────────────────

function asymmetricFin(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, n: number, speed: number, alpha: number,
): void {
  const R    = geo.R;
  const side = normalizedHash(n, 37) > 0.5 ? 1 : -1;
  const reach  = geo.rearReach;
  const height = R * (0.52 + speed * 0.28);
  const offA   = side * 0.40;

  const baseAngle = REAR + offA;
  const bx = cx + reach * 0.88 * Math.cos(baseAngle);
  const by = cy + reach * 0.88 * Math.sin(baseAngle);
  const tipAngle = REAR + side * (Math.abs(offA) + 0.24);
  const tx = cx + (reach + height) * Math.cos(tipAngle);
  const ty = cy + (reach + height) * Math.sin(tipAngle);
  const inAngle = REAR + side * (Math.abs(offA) - 0.20);
  const ix = cx + reach * 0.60 * Math.cos(inAngle);
  const iy = cy + reach * 0.60 * Math.sin(inAngle);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.80})`;
  ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.22})`;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(ix, iy);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function asymmetricWeapon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, n: number,
  attackStyle: 'melee' | 'pulse' | 'ranged',
  aggression: number, mass: number, alpha: number,
): void {
  const R = geo.R;
  const reach = geo.frontReach;
  const side  = normalizedHash(n, 39) > 0.5 ? 1 : -1;
  const offA  = side * (0.20 + normalizedHash(n, 41) * 0.14);

  ctx.save();

  if (attackStyle === 'melee') {
    const length    = R * (0.50 + aggression * 0.26);
    const baseAngle = FRONT + offA;
    const bx = cx + reach * 0.88 * Math.cos(baseAngle);
    const by = cy + reach * 0.88 * Math.sin(baseAngle);
    const tipAngle = FRONT + offA * 0.25;
    const tx = cx + (reach + length) * Math.cos(tipAngle);
    const ty = cy + (reach + length) * Math.sin(tipAngle);
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
    const barrelLength = R * (0.52 + mass * 0.16);
    const barrelWidth  = R * (0.08 + mass * 0.04);
    const angle = FRONT + offA;
    const bx = cx + reach * 0.80 * Math.cos(angle);
    const by = cy + reach * 0.80 * Math.sin(angle);
    const ex = cx + (reach + barrelLength) * Math.cos(angle);
    const ey = cy + (reach + barrelLength) * Math.sin(angle);
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.82})`;
    ctx.lineWidth   = barrelWidth * 2;
    ctx.lineCap     = 'butt';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineCap     = 'round';
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.96})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(ex, ey, barrelWidth * 0.90, 0, TAU); ctx.stroke();

  } else {
    const nodeR = R * 0.16;
    const angle = side === -1 ? UP + 0.18 : DOWN - 0.18;
    const dist  = geo.sideReach * 0.88;
    const nx = cx + dist * Math.cos(angle);
    const ny = cy + dist * Math.sin(angle);
    ctx.fillStyle   = `rgba(255,255,255,${alpha * 0.45})`;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.68})`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR * 2.2, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function asymmetricArmorPatch(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, n: number, armor: number, alpha: number,
): void {
  const R = geo.R;
  const side    = normalizedHash(n, 43) > 0.5 ? 1 : -1;
  const center  = side === -1 ? UP + 0.20 : DOWN - 0.20;
  const arcSpan = Math.PI * (0.32 + armor * 0.20);
  const thick   = R * (0.09 + armor * 0.07);
  const plateR  = geo.sideReach * 0.94;

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.48 + armor * 0.20)})`;
  ctx.lineWidth   = thick;
  ctx.beginPath();
  ctx.arc(cx, cy, plateR, center - arcSpan, center + arcSpan);
  ctx.stroke();
  ctx.restore();
}

function asymmetricAntenna(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry, n: number, sensorRadius: number, alpha: number,
): void {
  const R = geo.R;
  const side   = normalizedHash(n, 45) > 0.5 ? -1 : 1;
  const angle  = UP + side * 0.22;
  const length = R * (0.50 + sensorRadius * 0.36);
  const nodeR  = R * (0.044 + sensorRadius * 0.024);
  const dist   = geo.sideReach * 0.84;

  const bx = cx + dist * Math.cos(angle);
  const by = cy + dist * Math.sin(angle);
  const tx = cx + (dist + length) * Math.cos(angle + side * 0.10);
  const ty = cy + (dist + length) * Math.sin(angle + side * 0.10);

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.74})`;
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.92})`;
  ctx.beginPath(); ctx.arc(tx, ty, nodeR, 0, TAU); ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  Phenotype renderer — assembles structural layers from phenotype + geometry
// ═══════════════════════════════════════════════════════════════════════════════

function drawPhenotypeStructures(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  geo: BodyGeometry,
  p: VirusPhenotype,
  refinement: number,
): void {
  const r = refinement;

  if (p.symmetry === 'bilateral') {
    // Layer 1: Locomotion (rear)
    if (p.locomotionType === 'jets') {
      bilateralJets(ctx, cx, cy, geo, p.mass, p.speed, 0.55 + r * 0.28);
    } else if (p.locomotionType === 'fins') {
      bilateralFins(ctx, cx, cy, geo, p.speed, 0.55 + r * 0.28);
    }

    // Layer 2: Weapons (front)
    const weapAlpha = 0.65 + r * 0.22;
    if (p.attackStyle === 'melee') {
      bilateralClaws(ctx, cx, cy, geo, p.aggression, weapAlpha);
    } else if (p.attackStyle === 'ranged') {
      bilateralBarrels(ctx, cx, cy, geo, p.mass, p.sensorRadius, weapAlpha);
    } else {
      bilateralPulseEmitters(ctx, cx, cy, geo, weapAlpha);
    }

    // Layer 3: Armor (perimeter) — unlocks with refinement
    if (p.armor > 0.38 && r > 0.08) {
      const armorAlpha = Math.min(1, (r - 0.08) / 0.40) * 0.62 + 0.18;
      if (p.armor > 0.62) {
        bilateralArmorArc(ctx, cx, cy, geo, p.armor, armorAlpha);
      } else {
        bilateralFlankPlates(ctx, cx, cy, geo, p.armor, armorAlpha);
      }
    }

    // Layer 4: Sensors (forward-top)
    if (p.sensorRadius > 0.40 && r > 0.28) {
      const sensorAlpha = Math.min(1, (r - 0.28) / 0.40) * 0.65 + 0.15;
      bilateralAntennae(ctx, cx, cy, geo, p.sensorRadius, p.aggression, sensorAlpha);
    }

  } else if (p.symmetry === 'radial') {
    // Layer 1: Locomotion
    if (p.locomotionType !== 'passive') {
      radialFins(ctx, cx, cy, geo, p.lobes, p.speed, 0.48 + r * 0.30);
    }

    // Layer 2: Weapons
    radialWeapon(ctx, cx, cy, geo, p.lobes, p.attackStyle, p.aggression, 0.50 + r * 0.32);

    // Layer 3: Armor shell
    if (p.armor > 0.30) {
      radialShell(ctx, cx, cy, geo, p.armor, p.lobes, 0.50 + r * 0.24);
    }

    // Layer 4: Sensors
    if (p.sensorRadius > 0.48 && r > 0.35) {
      const sensorAlpha = Math.min(1, (r - 0.35) / 0.40) * 0.60 + 0.18;
      radialSensorNodes(ctx, cx, cy, geo, p.sensorRadius, p.lobes, sensorAlpha);
    }

  } else {
    // asymmetric
    // Layer 1: Locomotion
    if (p.locomotionType !== 'passive') {
      asymmetricFin(ctx, cx, cy, geo, p.n, p.speed, 0.58 + r * 0.26);
    }

    // Layer 2: Weapon (dominant single structure)
    asymmetricWeapon(ctx, cx, cy, geo, p.n, p.attackStyle, p.aggression, p.mass, 0.68 + r * 0.20);

    // Layer 3: Armor patch
    if (p.armor > 0.38 && r > 0.18) {
      const armorAlpha = Math.min(1, (r - 0.18) / 0.42) * 0.58 + 0.18;
      asymmetricArmorPatch(ctx, cx, cy, geo, p.n, p.armor, armorAlpha);
    }

    // Layer 4: Sensor antenna
    if (p.sensorRadius > 0.44 && r > 0.32) {
      const sensorAlpha = Math.min(1, (r - 0.32) / 0.40) * 0.62 + 0.15;
      asymmetricAntenna(ctx, cx, cy, geo, p.n, p.sensorRadius, sensorAlpha);
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

  // ── 1 + 2. Primary body + class decoration (flash = fill only, no structures) ─
  const phenotype = getVirusPhenotype(n);
  const geo = drawPrimaryBody(ctx, cx, cy, R, phenotype, fill, glow, flash);

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

  // ── 4. Phenotype structures (anchor-driven, skipped on flash / green) ────────
  if (!flash && !green) {
    drawPhenotypeStructures(ctx, cx, cy, geo, phenotype, refinement);
  }

  // ── 5. Refinement tiers (purely additive) ────────────────────────────────────
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
