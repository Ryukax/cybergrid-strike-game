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
//  Design rules (from spec):
//    • Each architecture changes TOPOLOGY, not just proportions.
//    • Multi-mass bodies are drawn as separate circles/rects with visible gaps.
//    • NO universal outer hull enclosing all masses — that collapses them to blobs.
//    • Structural ratios are exaggerated (2–3× differences), not 10–20%.
//    • Negative space (gaps, bridges, hollow centers) is a primary design tool.
//    • At R ≈ 12px (typical gameplay), each silhouette must be unambiguous.
// ═══════════════════════════════════════════════════════════════════════════════

/** Apply fill + optional glow + edge stroke to the current path. */
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

/** Helper: filled circle. */
function filledCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);
}

/**
 * compact — one dense near-circular mass.
 * Topology: 1 mass.  Readable as: "ball / hub".
 */
function drawBodyCompact(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const r = R * 0.90;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);
  return { frontReach: r, rearReach: r, sideReach: r, R };
}

/**
 * elongated — torpedo pill shape, 3:1 length-to-height ratio.
 * Topology: 1 elongated mass.  Readable as: "rod / torpedo".
 */
function drawBodyElongated(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  // Very strongly stretched: width = 3× height so it can't be confused with compact.
  const rX = R * 1.55;
  const rY = R * 0.30;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rX, rY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, debug);
  return { frontReach: rX, rearReach: rX, sideReach: rY, R };
}

/**
 * forwardWeighted — large front attack mass + small rear propulsion nub.
 * Topology: 2 masses (front circle 2.5× rear circle), thin bridge.
 * FRONT = left.  The big circle is at the left (attack) end.
 * Readable as: "hammerhead / big fist leading".
 */
function drawBodyForwardWeighted(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const frontR  = R * 0.78;          // large attack mass
  const rearR   = R * 0.32;          // small propulsion nub (2.4× smaller)
  const gap     = R * 0.30;          // visible gap between circles
  // Center the pair so the virus position (cx) is roughly the body midpoint
  const totalHalfWidth = frontR + gap + rearR;
  const frontCx = cx - totalHalfWidth * 0.38;   // front circle center (left)
  const rearCx  = frontCx + frontR + gap + rearR; // rear circle center (right)
  const bridgeH = R * 0.14;          // narrow connector

  const d = debug;
  const glowColor = debug ? 'transparent' : glow;

  // Bridge first (underneath circles)
  const bridgeX1 = frontCx + frontR - R * 0.04;
  const bridgeX2 = rearCx  - rearR  + R * 0.04;
  ctx.beginPath();
  ctx.rect(bridgeX1, cy - bridgeH, bridgeX2 - bridgeX1, bridgeH * 2);
  applyBodyFill(ctx, fill, glowColor, flash, d);

  // Front mass (large)
  ctx.shadowColor = debug ? 'transparent' : glow;
  ctx.shadowBlur  = flash || debug ? 0 : 10;
  filledCircle(ctx, frontCx, cy, frontR, fill, glow, flash, d);
  ctx.shadowBlur = 0;

  // Rear nub (small)
  filledCircle(ctx, rearCx, cy, rearR, fill, glow, flash, d);

  return {
    frontReach: cx - (frontCx - frontR),
    rearReach:  (rearCx + rearR) - cx,
    sideReach:  frontR,
    R,
  };
}

/**
 * rearWeighted — small front attack tip + large rear propulsion mass.
 * Topology: 2 masses (rear circle 2.5× front circle), thin bridge.
 * FRONT = left.  The small tip is at the left; the big mass is at right.
 * Readable as: "spear tip / engine-back".
 * Visually opposite of forwardWeighted.
 */
function drawBodyRearWeighted(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const frontR  = R * 0.32;          // small attack tip
  const rearR   = R * 0.78;          // large propulsion mass
  const gap     = R * 0.30;
  const totalHalfWidth = frontR + gap + rearR;
  const frontCx = cx - totalHalfWidth * 0.62;   // tip left
  const rearCx  = frontCx + frontR + gap + rearR;
  const bridgeH = R * 0.14;

  const d = debug;

  // Bridge
  const bridgeX1 = frontCx + frontR - R * 0.04;
  const bridgeX2 = rearCx  - rearR  + R * 0.04;
  ctx.beginPath();
  ctx.rect(bridgeX1, cy - bridgeH, bridgeX2 - bridgeX1, bridgeH * 2);
  applyBodyFill(ctx, fill, glow, flash, d);

  // Front tip (small)
  filledCircle(ctx, frontCx, cy, frontR, fill, glow, flash, d);

  // Rear mass (large)
  filledCircle(ctx, rearCx, cy, rearR, fill, glow, flash, d);

  return {
    frontReach: cx - (frontCx - frontR),
    rearReach:  (rearCx + rearR) - cx,
    sideReach:  rearR,
    R,
  };
}

/**
 * segmented — THREE clearly separated circular modules in a line.
 * Topology: 3 distinct masses with visible gaps; narrow rectangular connectors.
 * Readable as: "caterpillar / train".
 */
function drawBodySegmented(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const coreR   = R * 0.44;    // center module
  const sideR   = R * 0.36;    // front and rear modules (smaller)
  const spacing = R * 1.04;    // center-to-center — ensures visible gap
  const bridgeH = R * 0.15;    // thin connector height

  const frontCx = cx - spacing;
  const rearCx  = cx + spacing;

  const d = debug;

  // Bridges first (underneath circles)
  for (const [x1, x2] of [[frontCx + sideR - R * 0.02, cx - coreR + R * 0.02], [cx + coreR - R * 0.02, rearCx - sideR + R * 0.02]] as [number, number][]) {
    ctx.beginPath();
    ctx.rect(x1, cy - bridgeH, x2 - x1, bridgeH * 2);
    applyBodyFill(ctx, fill, glow, flash, d);
  }

  // Front module (left)
  filledCircle(ctx, frontCx, cy, sideR, fill, glow, flash, d);
  // Center module (largest)
  filledCircle(ctx, cx, cy, coreR, fill, glow, flash, d);
  // Rear module (right)
  filledCircle(ctx, rearCx, cy, sideR, fill, glow, flash, d);

  return {
    frontReach: spacing + sideR,
    rearReach:  spacing + sideR,
    sideReach:  coreR,
    R,
  };
}

/**
 * ring — annular mass with a large, obvious hollow center.
 * Topology: 1 closed loop with clear negative space (hole ≥ 65% of outer).
 * Readable as: "donut / torus".
 */
function drawBodyRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const outerR = R * 0.95;
  const innerR = R * 0.58;   // hole = 61% of outer — unmistakably hollow

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, TAU, false);
  ctx.arc(cx, cy, innerR, 0, TAU, true);    // CW = hole

  if (debug) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,0.60)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, TAU); ctx.stroke();
  } else {
    ctx.shadowColor = glow;
    ctx.shadowBlur  = flash ? 4 : 10;
    ctx.fillStyle   = fill;
    ctx.fill('evenodd');
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = flash ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.24)';
    ctx.lineWidth   = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, TAU); ctx.stroke();
  }

  return { frontReach: outerR, rearReach: outerR, sideReach: outerR, R };
}

/**
 * radialCore — central hub with 3 large structural arms at 120° intervals.
 * Topology: 1 hub + 3 arms.  NOT a star polygon or flower.
 * Readable as: "three-armed hub / Y-shape".
 */
function drawBodyRadialCore(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const hubR   = R * 0.42;   // central hub circle
  const armW   = R * 0.22;   // arm width (half)
  const armLen = R * 0.60;   // arm extension beyond hub edge

  const d = debug;

  // Draw 3 arms at 90°, 210°, 330° (one pointing REAR for visual stability)
  const armAngles = [REAR, REAR + TAU / 3, REAR + (2 * TAU) / 3];

  ctx.save();
  for (const angle of armAngles) {
    // Arm as a rotated rectangle extending from hub surface to tip
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.rect(hubR - R * 0.04, -armW, armLen + R * 0.04, armW * 2);
    applyBodyFill(ctx, fill, glow, flash, d);
    ctx.restore();
  }

  // Central hub on top
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, d);
  ctx.restore();

  const armTip = hubR + armLen;
  return { frontReach: armTip, rearReach: armTip, sideReach: armTip, R };
}

/**
 * splitCore — two circles stacked vertically, connected by a narrow bridge.
 * Topology: 2 dominant masses + visible gap around bridge.
 * Readable as: "figure-8 / bimodal mass".
 */
function drawBodySplitCore(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const lobeR    = R * 0.52;
  const sep      = R * 0.60;    // center-to-center — ensures visible gap between lobes
  const bridgeW  = R * 0.28;    // narrow connector width

  const d = debug;

  // Narrow bridge first
  ctx.beginPath();
  ctx.rect(cx - bridgeW, cy - sep, bridgeW * 2, sep * 2);
  applyBodyFill(ctx, fill, glow, flash, d);

  // Top lobe
  filledCircle(ctx, cx, cy - sep, lobeR, fill, glow, flash, d);
  // Bottom lobe
  filledCircle(ctx, cx, cy + sep, lobeR, fill, glow, flash, d);

  return { frontReach: lobeR, rearReach: lobeR, sideReach: sep + lobeR, R };
}

/**
 * winged — narrow central fuselage with dominant swept wing surfaces.
 * Topology: 1 thin body + 2 large wings (wing span = 2.8× body width).
 * Readable as: "aircraft / delta wing".
 */
function drawBodyWinged(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  const bodyRX  = R * 0.50;          // fuselage half-length
  const bodyRY  = R * 0.18;          // fuselage half-height — very thin
  const wingSpan = R * 1.10;         // wing tip distance from center (2.8× body half-height)
  // Wings sweep from front-center rearward — delta wing shape
  const wingFrontX = cx - bodyRX * 0.55;   // wing root at ~55% forward
  const wingTipX   = cx + bodyRX * 0.80;   // tip sweeps back past the body rear

  const d = debug;

  // Draw wings first so fuselage sits on top
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(wingFrontX, cy);                           // leading edge root (near front)
    ctx.lineTo(wingTipX,   cy + side * wingSpan);         // tip — far out and rear
    ctx.lineTo(cx + bodyRX * 1.05, cy + side * bodyRY);  // trailing edge at rear
    ctx.closePath();
    applyBodyFill(ctx, fill, glow, flash, d);
  }

  // Fuselage ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyRX, bodyRY, 0, 0, TAU);
  applyBodyFill(ctx, fill, glow, flash, d);

  return {
    frontReach: cx - wingFrontX,
    rearReach:  wingTipX - cx,
    sideReach:  wingSpan,
    R,
  };
}

/**
 * shielded — large flat frontal shield wall + small circular protected core.
 * Topology: 2 distinct masses (shield plate + rear core), clear structural gap.
 * FRONT = left = the broad shield face.
 * Readable as: "tower shield with core behind it".
 */
function drawBodyShielded(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number,
  fill: string, glow: string, flash: boolean, debug: boolean,
): BodyGeometry {
  // Shield plate: tall flat rectangle at front (left side)
  const shieldW  = R * 0.28;          // plate thickness
  const shieldH  = R * 0.95;          // half-height — 2× the core radius
  const shieldX  = cx - R * 0.68;     // left edge of shield
  // Core: small circle behind the shield
  const coreR    = R * 0.44;          // core radius — 2× smaller than shield height
  const coreCx   = shieldX + shieldW + R * 0.20 + coreR; // core center, sits behind shield

  const d = debug;

  // Core first (behind shield visually)
  filledCircle(ctx, coreCx, cy, coreR, fill, glow, flash, d);

  // Shield plate (drawn on top — dominates the front silhouette)
  ctx.beginPath();
  ctx.rect(shieldX, cy - shieldH, shieldW, shieldH * 2);
  applyBodyFill(ctx, fill, glow, flash, d);

  // Panel seam lines on shield face (not in debug mode)
  if (!flash && !debug) {
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth   = 1;
    for (const dy of [-shieldH * 0.45, 0, shieldH * 0.45]) {
      ctx.beginPath();
      ctx.moveTo(shieldX + shieldW * 0.15, cy + dy);
      ctx.lineTo(shieldX + shieldW * 0.85, cy + dy);
      ctx.stroke();
    }
  }

  const frontReach = cx - shieldX;
  const rearReach  = (coreCx + coreR) - cx;
  return { frontReach, rearReach, sideReach: shieldH, R };
}

/** Dispatch to the correct body drawing function and return geometry. */
function drawPrimaryBody(
  ctx:   CanvasRenderingContext2D,
  cx:    number, cy: number, R: number,
  p:     VirusPhenotype,
  fill:  string, glow: string, flash: boolean,
  debug: boolean = false,
): BodyGeometry {
  switch (p.architecture) {
    case 'elongated':       return drawBodyElongated(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'forwardWeighted': return drawBodyForwardWeighted(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'rearWeighted':    return drawBodyRearWeighted(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'segmented':       return drawBodySegmented(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'ring':            return drawBodyRing(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'radialCore':      return drawBodyRadialCore(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'splitCore':       return drawBodySplitCore(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'winged':          return drawBodyWinged(ctx, cx, cy, R, fill, glow, flash, debug);
    case 'shielded':        return drawBodyShielded(ctx, cx, cy, R, fill, glow, flash, debug);
    default:                return drawBodyCompact(ctx, cx, cy, R, fill, glow, flash, debug);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6b  Silhouette debug grid
//
//  Call drawSilhouetteDebugGrid(ctx, width, height) to render all 10 body
//  architectures as flat-white silhouettes on black.  Use this to verify
//  visual distinctiveness before enabling structures.
// ═══════════════════════════════════════════════════════════════════════════════

export function drawSilhouetteDebugGrid(
  ctx:    CanvasRenderingContext2D,
  width:  number,
  height: number,
): void {
  const archs: BodyArchitecture[] = [
    'compact', 'elongated', 'forwardWeighted', 'rearWeighted', 'segmented',
    'ring', 'radialCore', 'splitCore', 'winged', 'shielded',
  ];

  const cols    = 5;
  const rows    = 2;
  const cellW   = width  / cols;
  const cellH   = height / rows;
  const R       = Math.min(cellW, cellH) * 0.24;

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  archs.forEach((arch, i) => {
    const col  = i % cols;
    const row  = Math.floor(i / cols);
    const cx   = cellW * (col + 0.5);
    const cy   = cellH * (row + 0.5) - R * 0.25;  // slight upward shift for label

    // Fake phenotype with neutral trait values
    const fakePhenotype: VirusPhenotype = {
      n: 7, cls: 'prime', lobes: 5, spikes: [], spikeCount: 3,
      speed: 0.5, armor: 0.5, mass: 0.5, attackRange: 0.5,
      sensorRadius: 0.5, aggression: 0.5, regen: 0.5, evasion: 0.5,
      symmetry: 'bilateral', attackStyle: 'melee', locomotionType: 'fins',
      architecture: arch,
    };

    drawPrimaryBody(ctx, cx, cy, R, fakePhenotype, '#fff', 'transparent', false, true);

    // Label
    ctx.fillStyle  = 'rgba(255,255,255,0.70)';
    ctx.font       = `${Math.max(9, R * 0.55)}px monospace`;
    ctx.textAlign  = 'center';
    ctx.fillText(arch, cx, cy + R * 1.65);
  });
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
  const geo = drawPrimaryBody(ctx, cx, cy, R, phenotype, fill, glow, flash, MORPHOLOGY_SILHOUETTE_DEBUG);

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
