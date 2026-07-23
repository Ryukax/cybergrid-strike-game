/**
 * Virus Morphology Encoding Standard v1 — with Universal Archetype Interpretation
 *
 * Pipeline:
 *   Virus Integer
 *     → Numerical Morphology   (lobes, spikes, notches, class)
 *     → Geometric Constraints  (radius, symmetry, structure)
 *     → Archetype Profile      (primary + secondary archetype + structural levels)
 *     → Nearest Physical Model (rendered overlay interpretation)
 *     → Final Coherent Virus
 *
 * The numerical morphology is authoritative. The archetype system interprets it,
 * never replaces it. Every integer always produces the same profile and appearance.
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

export type VirusArchetype =
  | 'biological'
  | 'humanoid'
  | 'animal'
  | 'insectoid'
  | 'mechanical'
  | 'armored'
  | 'crystalline'
  | 'mineral'
  | 'plant'
  | 'synthetic'
  | 'robotic'
  | 'amorphous'
  | 'geometric'
  | 'energy'
  | 'cybernetic'
  | 'skeletal'
  | 'fluid';

/**
 * Full model profile derived deterministically from a virus integer.
 * Structural levels are all in [0, 1].
 */
export interface VirusModelProfile {
  primaryArchetype:   VirusArchetype;
  secondaryArchetype: VirusArchetype;
  primaryWeight:   number; // 0.6–1.0
  secondaryWeight: number; // 1 − primaryWeight
  structureLevel:    number; // rigid (1) ↔ loose/amorphous (0)
  symmetryLevel:     number; // radially symmetric (1) ↔ asymmetric (0)
  armorLevel:        number;
  organicLevel:      number;
  mechanicalLevel:   number;
  crystallineLevel:  number;
  energyLevel:       number;
}

/**
 * Discrete model family definition — used when image/3-D assets are introduced.
 * Unused at render time for now; included so the architecture supports it.
 */
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
// § 2  Deterministic hash utility
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps (value, salt) → [0, 1) deterministically.
 * Same inputs always produce the same output. No RNG at render time.
 */
function normalizedHash(value: number, salt: number): number {
  const x = Math.sin(value * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  Archetype profile generation
// ═══════════════════════════════════════════════════════════════════════════════

const ARCHETYPES: VirusArchetype[] = [
  'biological', 'humanoid', 'animal',   'insectoid',  'mechanical',
  'armored',    'crystalline', 'mineral', 'plant',     'synthetic',
  'robotic',    'amorphous',  'geometric', 'energy',   'cybernetic',
  'skeletal',   'fluid',
];

export function getVirusModelProfile(value: number): VirusModelProfile {
  const primaryIndex   = Math.floor(normalizedHash(value, 1) * ARCHETYPES.length);
  let secondaryIndex   = Math.floor(normalizedHash(value, 2) * ARCHETYPES.length);
  if (secondaryIndex === primaryIndex) secondaryIndex = (secondaryIndex + 1) % ARCHETYPES.length;

  const primaryWeight   = 0.6 + normalizedHash(value, 3) * 0.4;
  const secondaryWeight = 1 - primaryWeight;

  return {
    primaryArchetype:   ARCHETYPES[primaryIndex],
    secondaryArchetype: ARCHETYPES[secondaryIndex],
    primaryWeight,
    secondaryWeight,
    structureLevel:   normalizedHash(value,  4),
    symmetryLevel:    normalizedHash(value,  5),
    armorLevel:       normalizedHash(value,  6),
    organicLevel:     normalizedHash(value,  7),
    mechanicalLevel:  normalizedHash(value,  8),
    crystallineLevel: normalizedHash(value,  9),
    energyLevel:      normalizedHash(value, 10),
  };
}

/**
 * Weighted compatibility score for matching a profile to a VirusVisualModel.
 * Lower = better match.
 */
export function getCompatibilityScore(
  profile: VirusModelProfile,
  model: VirusVisualModel,
  lobes: number,
  symmetryLevel: number,
): number {
  const archetypeMatch  = model.archetypes.includes(profile.primaryArchetype) ? 1 :
                          model.archetypes.includes(profile.secondaryArchetype) ? 0.5 : 0;
  const normalizedLobes = (lobes - 3) / 5; // 0–1
  const minL = model.compatibleFeatures.minLobes ?? 3;
  const maxL = model.compatibleFeatures.maxLobes ?? 8;
  const geometryMatch   = lobes >= minL && lobes <= maxL ? 1 : 0;
  const [sMin, sMax]    = model.compatibleFeatures.symmetryRange ?? [0, 1];
  const symmetryMatch   = symmetryLevel >= sMin && symmetryLevel <= sMax ? 1 : 0;
  void normalizedLobes;
  return archetypeMatch * 0.40 + geometryMatch * 0.25 + symmetryMatch * 0.15;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  Number theory helpers
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

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  Morphology parameters
// ═══════════════════════════════════════════════════════════════════════════════

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
// § 6  Color palette  (class-based; archetype modifies interpretation, not hue)
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
// § 7  Chassis silhouettes
//
//  8 chassis templates derived from n % 8.  Curves are used selectively:
//   • Organic/biological chassis (CRAWLER, STALKER, BRUISER, STRIKER) use
//     quadratic / bezier curves for shell contours, belly membranes, and
//     muscle-like transitions.
//   • Mechanical chassis (WEDGE, TANK, ARTILLERY, SPECTER) keep hard polygon
//     edges to communicate armor, weapons, and rigid structure.
//  No rose curves, no radial oscillators, no universal blobs.
//  All shapes face LEFT (direction of travel toward the player).
// ═══════════════════════════════════════════════════════════════════════════════

// ── Distribution ──────────────────────────────────────────────────────────────
// 12-slot weighted sequence; each slot maps n % 12 → chassis 0-7.
//
// Goals vs n%8 baseline:
//  • Y-shapes (3 ARTILLERY + 6 SPECTER): 2/12 = 17% (was 25%)
//  • Segmented-chain (5 BRUISER):        2/12 = 17% (was 13%)
//  • Crescent (4 CRAWLER):               2/12 = 17% (was 13%)
//  • D-lobe bilateral (1 STRIKER):       2/12 = 17% (was 13%)
//  • Elongated-serial (7 STALKER):       2/12 = 17% (was 13%)
//  • Axial-wing (0 WEDGE):               1/12 =  8% (was 13%)
//  • Compact-shell (2 TANK):             1/12 =  8% (was 13%)
//
// Sequence ordered so no two adjacent entries share the same chassis or
// the same broad family (Y-shapes never touch, etc.).
const CHASSIS_SEQ = [0, 4, 1, 5, 2, 7, 4, 3, 1, 6, 5, 7] as const;

/** Returns chassis index 0–7 from n. */
function getChassisType(n: number): number {
  return CHASSIS_SEQ[n % CHASSIS_SEQ.length];
}

/**
 * Returns variant index 0–2 for a given n.
 *
 * Within each 12-slot cycle, the same chassis appears at two different
 * positions (4+ slots apart), so floor((n%12)/4) gives different thirds
 * of the cycle.  Adding the cycle count rotates which variant is "first"
 * each cycle, ensuring consecutive encounters of the same chassis type
 * across waves look visually distinct.
 */
function getChassisVariant(n: number): number {
  return (Math.floor(n / CHASSIS_SEQ.length) + Math.floor((n % CHASSIS_SEQ.length) / 4)) % 3;
}

/**
 * Builds the chassis outer-silhouette path.
 * Vertices and control points are absolute canvas coordinates centered on (cx, cy).
 *
 * Body-plan topology catalogue — each chassis commits to a distinct plan;
 * secondary anatomy must reinforce, not decorate, the plan topology.
 *
 *   0  WEDGE      — AXIAL SWEPT WING        wing IS the body, no fuselage (mechanical)
 *   1  STRIKER    — BILATERAL ASYMMETRIC    dominant dorsal; vestigial ventral (biomech)
 *   2  TANK       — FRONTAL MASS DOMINANT   forward plow + layered side batters (armor)
 *   3  ARTILLERY  — RADIAL 3-SPOKE          small hub + 3 barrels at 120° (mechanical)
 *   4  CRAWLER    — CRESCENT / ARC          C-body, opening forward; claws at horns (bio)
 *   5  BRUISER    — SEGMENTED CHAIN         thorax → abdomen → tail, trilobite (biomech)
 *   6  SPECTER    — BRANCHING CRYSTAL       small node + 3 crystal arms, Y-radial (energy)
 *   7  STALKER    — ELONGATED SPINE SERIES  rod with sequential dorsal fins (organic)
 */
function buildChassisPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, R: number,
): void {
  const chassis = getChassisType(n);
  ctx.beginPath();

  switch (chassis) {

    case 0: // WEDGE — true wide delta wing; span >> chord; the wing IS the body
      // Axial topology: wingspan (Y) ≈ 2.7× chord length (X).
      // No separate fuselage, no rear block, no detached pods.  All hard lineTo.
      // Primary silhouette is an unmistakably wing-shaped polygon.
      ctx.moveTo(cx - R * 0.52, cy);                  // nose tip
      ctx.lineTo(cx - R * 0.02, cy - R * 2.05);       // upper wingtip (far span)
      ctx.lineTo(cx + R * 1.05, cy - R * 0.12);       // upper trailing corner
      ctx.lineTo(cx + R * 1.05, cy + R * 0.12);       // lower trailing corner
      ctx.lineTo(cx - R * 0.02, cy + R * 2.05);       // lower wingtip (far span)
      // closePath draws lower wingtip → nose: the swept leading edge
      break;

    case 1: // STRIKER — D-lobe asymmetric; the BODY ITSELF is a D-shape
      // True asymmetric bilateral: flat ventral underside (closePath line) +
      // large convex dorsal arc.  No bilateral axis; no symmetric secondary.
      // The organism IS the asymmetry at the primary silhouette level (biomech).
      ctx.moveTo(cx - R * 0.82, cy + R * 0.24);       // FL — front-lower (ventral)
      ctx.bezierCurveTo(                               // front face: slight concave curve
        cx - R * 1.10, cy + R * 0.10,
        cx - R * 1.10, cy - R * 0.10,
        cx - R * 0.82, cy - R * 0.24,                 // FU — front-upper
      );
      ctx.bezierCurveTo(                               // large dorsal D-arc
        cx - R * 0.40, cy - R * 1.55,
        cx + R * 0.55, cy - R * 1.52,
        cx + R * 0.90, cy - R * 0.35,                 // RU — rear-upper
      );
      ctx.lineTo(cx + R * 0.90, cy + R * 0.24);       // RL — rear-lower
      // closePath: RL → FL = flat ventral baseline (no curves, no decorations)
      break;

    case 2: // TANK — compact hexagonal shell; width ≈ height; not a wedge
      // Compact shell topology: roughly-square hexagon with one forward point (L)
      // and one rear point (R).  The shell IS the organism — mass is in the walls.
      // Secondary anatomy attaches FLUSH to hex edges, never overrides the shell read.
      ctx.moveTo(cx - R * 0.85, cy);                  // L — forward point
      ctx.lineTo(cx - R * 0.45, cy - R * 0.95);       // TL
      ctx.lineTo(cx + R * 0.45, cy - R * 0.95);       // TR
      ctx.lineTo(cx + R * 0.85, cy);                  // R — rear point
      ctx.lineTo(cx + R * 0.45, cy + R * 0.95);       // BR
      ctx.lineTo(cx - R * 0.45, cy + R * 0.95);       // BL
      // closePath: BL → L (lower-left diagonal face)
      break;

    case 3: // ARTILLERY — radial 3-spoke; small hexagonal hub, all hard edges
      // 3-fold radial topology: three barrels radiate from center at ~120° spacing.
      // No bilateral axis; no legs; no rear block.  Pure weapon platform.
      ctx.moveTo(cx,             cy - R * 0.42);       // top vertex
      ctx.lineTo(cx + R * 0.36, cy - R * 0.21);       // TR
      ctx.lineTo(cx + R * 0.36, cy + R * 0.21);       // BR
      ctx.lineTo(cx,             cy + R * 0.42);       // bottom
      ctx.lineTo(cx - R * 0.36, cy + R * 0.21);       // BL
      ctx.lineTo(cx - R * 0.36, cy - R * 0.21);       // TL
      break;

    case 4: // CRAWLER — thin boomerang crescent; band width ≈ 0.55R; span ≈ 2.2R
      // Crescent topology: body IS the thin arc.  The hollow interior must read
      // clearly at in-game scale.  Horn tips are the attachment roots for claws.
      // Concave opening faces forward-left (toward player).  Organic bezier curves.
      ctx.moveTo(cx - R * 0.68, cy - R * 1.08);       // upper horn (sharp tip)
      ctx.bezierCurveTo(                               // outer arc — wide sweep rightward
        cx + R * 0.05, cy - R * 1.58,
        cx + R * 1.55, cy - R * 0.62,
        cx + R * 1.55, cy,                            // outer apex (rightmost)
      );
      ctx.bezierCurveTo(
        cx + R * 1.55, cy + R * 0.62,
        cx + R * 0.05, cy + R * 1.58,
        cx - R * 0.68, cy + R * 1.08,                 // lower horn (sharp tip)
      );
      ctx.bezierCurveTo(                               // inner arc — tight, concave
        cx - R * 0.30, cy + R * 0.88,
        cx + R * 0.55, cy + R * 0.56,
        cx + R * 0.98, cy,                            // inner apex (≈ 0.57R inside outer)
      );
      ctx.bezierCurveTo(
        cx + R * 0.55, cy - R * 0.56,
        cx - R * 0.30, cy - R * 0.88,
        cx - R * 0.68, cy - R * 1.08,                 // back to upper horn
      );
      break;

    case 5: // BRUISER — segmented chain; front thorax only (secondary adds abdomen + tail)
      // Segmented topology: three overlapping body segments; no "core + appendages".
      // Front face is organic (muscle); rear is hard; secondary continues the chain.
      ctx.moveTo(cx - R * 0.65, cy - R * 0.72);       // TF — top-front
      ctx.lineTo(cx + R * 0.62, cy - R * 0.72);       // TR
      ctx.lineTo(cx + R * 0.80, cy);                  // RP — right point
      ctx.lineTo(cx + R * 0.62, cy + R * 0.72);       // BR
      ctx.lineTo(cx - R * 0.65, cy + R * 0.72);       // BF — bottom-front
      ctx.quadraticCurveTo(cx - R * 1.12, cy, cx - R * 0.65, cy - R * 0.72); // front muscle curve
      break;

    case 6: // SPECTER — asymmetric dendritic crystal; diamond node (NOT hexagon)
      // Dendritic branching topology.  Node is a rhombus/diamond — visually distinct
      // from Artillery's hexagon hub.  Arms are UNEQUAL and at non-120° angles.
      // This organism has NO rotational symmetry (contrast: Artillery has 3-fold).
      ctx.moveTo(cx,             cy - R * 0.52);       // top
      ctx.lineTo(cx + R * 0.50, cy);                  // right
      ctx.lineTo(cx,             cy + R * 0.52);       // bottom
      ctx.lineTo(cx - R * 0.50, cy);                  // left
      break;

    default: // STALKER (7) — elongated spine; horizontal rod, flat head, tapered tail
      // Sequential axial topology: spines are positioned along the rod in series.
      // No bilateral symmetry in the secondary; features are distributed along the length.
      ctx.moveTo(cx - R * 1.15, cy - R * 0.30);       // front-top (head face)
      ctx.lineTo(cx - R * 1.15, cy + R * 0.30);       // front-bottom
      ctx.lineTo(cx + R * 1.35, cy + R * 0.18);       // rear taper lower
      ctx.lineTo(cx + R * 1.52, cy);                  // tail tip
      ctx.lineTo(cx + R * 1.35, cy - R * 0.18);       // rear taper upper
      break;
  }

  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7b  Secondary + tertiary chassis anatomy
//
//  Target: secondary/tertiary masses contribute 40–60 % of the visible footprint.
//  Every chassis has 3–4 substantial anatomical regions that extend OUTWARD and
//  materially reshape the outer silhouette — limbs, wings, fins, shields, barrels,
//  haunches, spines, claws — not small centred overlays.
//
//  Curve discipline (mirrors § 7 primary):
//   Mechanical / armor  →  hard lineTo edges throughout
//   Organic / hybrid    →  quadraticCurveTo / bezierCurveTo for muscle mass,
//                          membrane contours, and shell/joint transitions
//
//  Draw order: called AFTER primary fill+stroke, BEFORE archetype overlays.
//  Shapes that represent anatomy "behind" the core body are drawn first inside
//  each case so the primary core sits visually on top of them.
// ═══════════════════════════════════════════════════════════════════════════════

function drawChassisSecondary(
  ctx:   CanvasRenderingContext2D,
  cx: number, cy: number,
  n:     number, R: number,
  fill:  string,
  glow:  string,
  flash: boolean,
): void {
  const chassis = getChassisType(n);
  ctx.save();

  const sep  = flash ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.20)';
  const blur = flash ? 3 : 7;

  /** Hard-edged filled polygon. */
  const poly = (pts: [number, number][], alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = fill;
    ctx.shadowColor = glow;
    ctx.shadowBlur  = blur;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = sep;
    ctx.lineWidth   = 0.9;
    ctx.stroke();
  };

  /** Curved-path fill — caller builds the path via pathFn. */
  const curved = (pathFn: () => void, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = fill;
    ctx.shadowColor = glow;
    ctx.shadowBlur  = blur;
    ctx.beginPath();
    pathFn();
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = sep;
    ctx.lineWidth   = 0.9;
    ctx.stroke();
  };

  switch (chassis) {

    // ── 0  WEDGE — true wide delta wing ─────────────────────────────────────────
    // Primary: nose(cx-R*.52,cy), wingtips(cx-R*.02,cy±R*2.05),
    //          trailing corners(cx+R*1.05,cy±R*.12).  Span≈4.1R, chord≈1.57R.
    // Grammar: everything in the plane of the wing; all spanwise; all hard edges.
    // Secondary anatomy = structural wing members, NOT pods or appendages.
    case 0: {
      // Upper cranked outer-wing panel — extends wingtip into a swept crank, adds
      // apparent wingspan beyond the primary polygon edge.
      poly([
        [cx - R * 0.02, cy - R * 2.05],   // ← exact upper wingtip vertex
        [cx - R * 0.42, cy - R * 2.58],   // outboard crank tip
        [cx + R * 0.38, cy - R * 2.52],   // swept crank trailing
        [cx + R * 0.52, cy - R * 2.02],   // re-entry on wingtip chord
        [cx + R * 0.22, cy - R * 1.95],
      ], 0.76);
      // Lower cranked outer-wing panel — mirrored
      poly([
        [cx - R * 0.02, cy + R * 2.05],   // ← exact lower wingtip vertex
        [cx - R * 0.42, cy + R * 2.58],
        [cx + R * 0.38, cy + R * 2.52],
        [cx + R * 0.52, cy + R * 2.02],
        [cx + R * 0.22, cy + R * 1.95],
      ], 0.76);
      // Wing-root fairing — hard polygon bridging nose into upper/lower leading edges
      // Roots from nose(cx-R*.52,cy) and projects along the inner leading edge.
      poly([
        [cx - R * 0.52, cy - R * 0.08],   // ← near nose, upper
        [cx - R * 0.52, cy + R * 0.08],   // ← near nose, lower
        [cx - R * 0.22, cy + R * 0.60],   // lower leading-edge merge
        [cx - R * 0.22, cy - R * 0.60],   // upper leading-edge merge
      ], 0.72);
      // Trailing-edge elevons — two hard tabs at trailing corners
      poly([
        [cx + R * 0.55, cy - R * 0.12],
        [cx + R * 1.05, cy - R * 0.12],   // ← exact upper trailing corner
        [cx + R * 1.38, cy - R * 0.62],
        [cx + R * 1.02, cy - R * 0.58],
      ], 0.70);
      poly([
        [cx + R * 0.55, cy + R * 0.12],
        [cx + R * 1.05, cy + R * 0.12],   // ← exact lower trailing corner
        [cx + R * 1.38, cy + R * 0.62],
        [cx + R * 1.02, cy + R * 0.58],
      ], 0.70);
      break;
    }

    // ── 1  STRIKER — D-lobe asymmetric body ──────────────────────────────────────
    // Primary: FL(cx-R*.82,cy+R*.24), FU(cx-R*.82,cy-R*.24), dorsal arc peaks
    //          ~(cx,cy-R*1.52), RU(cx+R*.90,cy-R*.35), RL(cx+R*.90,cy+R*.24).
    //          Flat ventral baseline at cy+R*.24 (closePath line FL→RL).
    // Grammar: ALL anatomy ABOVE the ventral baseline; the bare underside is
    //          the asymmetry signal — never violated.
    // Variants — v=getChassisVariant(n):
    //   v=0  tall narrow dorsal fin + large forward head lobe + rear thorn
    //   v=1  wide swept-back dorsal crest + compact snout + two rear spines
    //   v=2  split dorsal (two lobes with gap) + wide forward head mass
    case 1: {
      const v = getChassisVariant(n);
      if (v === 0) {
        // Tall narrow dorsal fin
        curved(() => {
          ctx.moveTo(cx-R*.28, cy-R*1.38);
          ctx.bezierCurveTo(cx-R*.58,cy-R*1.82, cx-R*.52,cy-R*2.28, cx-R*.15,cy-R*2.32);
          ctx.bezierCurveTo(cx+R*.18,cy-R*2.12, cx+R*.35,cy-R*1.68, cx+R*.28,cy-R*1.38);
          ctx.quadraticCurveTo(cx,cy-R*1.50, cx-R*.28,cy-R*1.38);
        }, 0.74);
        // Large forward head lobe from FU vertex
        curved(() => {
          ctx.moveTo(cx-R*.82,cy-R*.24);
          ctx.bezierCurveTo(cx-R*1.12,cy-R*.42, cx-R*1.52,cy-R*1.08, cx-R*1.22,cy-R*1.58);
          ctx.bezierCurveTo(cx-R*.88,cy-R*1.62, cx-R*.62,cy-R*1.28, cx-R*.52,cy-R*.82);
          ctx.quadraticCurveTo(cx-R*.62,cy-R*.42, cx-R*.82,cy-R*.24);
        }, 0.68);
        // Rear dorsal thorn from RU vertex
        poly([[cx+R*.90,cy-R*.35],[cx+R*1.18,cy-R*.28],[cx+R*1.30,cy-R*.90],[cx+R*1.05,cy-R*.95]], 0.72);

      } else if (v === 1) {
        // Wide swept-back dorsal crest (broader base, apex shifted rearward vs V0)
        curved(() => {
          ctx.moveTo(cx-R*.52,cy-R*1.22);
          ctx.bezierCurveTo(cx-R*.72,cy-R*1.58, cx-R*.20,cy-R*1.98, cx+R*.35,cy-R*1.80);
          ctx.bezierCurveTo(cx+R*.65,cy-R*1.55, cx+R*.62,cy-R*1.20, cx+R*.48,cy-R*1.18);
          ctx.quadraticCurveTo(cx+R*.05,cy-R*1.32, cx-R*.52,cy-R*1.22);
        }, 0.74);
        // Compact forward snout (smaller apex than V0)
        curved(() => {
          ctx.moveTo(cx-R*.82,cy-R*.24);
          ctx.bezierCurveTo(cx-R*1.08,cy-R*.38, cx-R*1.40,cy-R*.80, cx-R*1.12,cy-R*1.25);
          ctx.bezierCurveTo(cx-R*.88,cy-R*1.30, cx-R*.68,cy-R*1.00, cx-R*.58,cy-R*.68);
          ctx.quadraticCurveTo(cx-R*.66,cy-R*.38, cx-R*.82,cy-R*.24);
        }, 0.68);
        // Two rear spines instead of one thorn
        poly([[cx+R*.90,cy-R*.35],[cx+R*1.12,cy-R*.30],[cx+R*1.22,cy-R*.82],[cx+R*1.02,cy-R*.85]], 0.72);
        poly([[cx+R*.90,cy-R*.35],[cx+R*1.20,cy-R*.28],[cx+R*1.35,cy-R*.58],[cx+R*1.12,cy-R*.62]], 0.60);

      } else {
        // Split dorsal — two separate lobes with a visible gap between them
        // Upper lobe
        curved(() => {
          ctx.moveTo(cx-R*.30,cy-R*1.35);
          ctx.bezierCurveTo(cx-R*.52,cy-R*1.78, cx-R*.42,cy-R*2.22, cx-R*.12,cy-R*2.24);
          ctx.bezierCurveTo(cx+R*.10,cy-R*2.08, cx+R*.20,cy-R*1.72, cx+R*.08,cy-R*1.38);
          ctx.quadraticCurveTo(cx-R*.10,cy-R*1.42, cx-R*.30,cy-R*1.35);
        }, 0.74);
        // Lower lobe (gap visible between lobe pair)
        curved(() => {
          ctx.moveTo(cx+R*.18,cy-R*1.25);
          ctx.bezierCurveTo(cx+R*.05,cy-R*1.48, cx+R*.18,cy-R*1.88, cx+R*.50,cy-R*1.85);
          ctx.bezierCurveTo(cx+R*.75,cy-R*1.68, cx+R*.75,cy-R*1.38, cx+R*.52,cy-R*1.25);
          ctx.quadraticCurveTo(cx+R*.35,cy-R*1.22, cx+R*.18,cy-R*1.25);
        }, 0.68);
        // Wide forward head mass — no rear thorn in V2
        curved(() => {
          ctx.moveTo(cx-R*.82,cy-R*.24);
          ctx.bezierCurveTo(cx-R*1.05,cy-R*.55, cx-R*1.62,cy-R*.95, cx-R*1.52,cy-R*1.45);
          ctx.bezierCurveTo(cx-R*1.22,cy-R*1.60, cx-R*.88,cy-R*1.28, cx-R*.68,cy-R*.85);
          ctx.quadraticCurveTo(cx-R*.72,cy-R*.45, cx-R*.82,cy-R*.24);
        }, 0.68);
      }
      break;
    }

    // ── 2  TANK — compact hexagonal shell ────────────────────────────────────────
    // Primary: L(cx-R*.85,cy), TL(cx-R*.45,cy-R*.95), TR(cx+R*.45,cy-R*.95),
    //          R(cx+R*.85,cy), BR(cx+R*.45,cy+R*.95), BL(cx-R*.45,cy+R*.95).
    // Grammar: compact SHELL — width≈height; mass lives in shell walls, not shape.
    // Secondary anatomy attaches FLUSH to hex edges; no detached pods.  Hard edges.
    case 2: {
      // Forward V-plow — roots from L vertex (forward point of hex, exact)
      // Fills the structural role of a forward weapon without changing shell topology.
      poly([
        [cx - R * 0.85, cy - R * 0.22],   // ← near L vertex, upper
        [cx - R * 0.85, cy + R * 0.22],   // ← near L vertex, lower
        [cx - R * 1.38, cy + R * 0.40],
        [cx - R * 1.90, cy],              // plow tip
        [cx - R * 1.38, cy - R * 0.40],
      ], 0.84);
      // Upper armor batter — extends from TL→TR top edge, perpendicular to shell face
      // Hard plates reading as lateral fortification of the shell's top face.
      poly([
        [cx - R * 0.45, cy - R * 0.95],   // ← exact TL vertex
        [cx + R * 0.45, cy - R * 0.95],   // ← exact TR vertex
        [cx + R * 0.60, cy - R * 1.68],
        [cx,             cy - R * 1.82],
        [cx - R * 0.60, cy - R * 1.68],
      ], 0.72);
      // Lower armor batter — mirrors top batter from BL→BR bottom edge
      poly([
        [cx - R * 0.45, cy + R * 0.95],   // ← exact BL vertex
        [cx + R * 0.45, cy + R * 0.95],   // ← exact BR vertex
        [cx + R * 0.60, cy + R * 1.68],
        [cx,             cy + R * 1.82],
        [cx - R * 0.60, cy + R * 1.68],
      ], 0.72);
      // Rear command pod — hard blunt protrusion from R vertex (rear point)
      poly([
        [cx + R * 0.85, cy - R * 0.20],   // ← near R vertex, upper
        [cx + R * 0.85, cy + R * 0.20],   // ← near R vertex, lower
        [cx + R * 1.48, cy + R * 0.12],
        [cx + R * 1.60, cy],
        [cx + R * 1.48, cy - R * 0.12],
      ], 0.70);
      break;
    }

    // ── 3  ARTILLERY — radial weapons platform ────────────────────────────────
    // Primary: small hexagon hub (unchanged).
    // Variants — v=getChassisVariant(n):
    //   v=0  Y-arrangement: forward + upper-right + lower-right (120° spacing, current)
    //   v=1  T-arrangement: forward + straight-up + straight-down (90° spacing)
    //   v=2  L-arrangement: long forward + one steep lateral + short rear stub
    case 3: {
      const v = getChassisVariant(n);
      if (v === 0) {
        // V0: Y-triskelion (current)
        curved(() => {
          ctx.moveTo(cx-R*.36,cy-R*.21);
          ctx.lineTo(cx-R*.36,cy+R*.21);
          ctx.lineTo(cx-R*2.55,cy+R*.12);
          ctx.arc(cx-R*2.55,cy, R*.12, Math.PI*.5,-Math.PI*.5,true);
          ctx.lineTo(cx-R*2.55,cy-R*.12);
        }, 0.82);
        poly([[cx+R*.40,cy-R*.18],[cx+R*.14,cy-R*.44],[cx+R*1.62,cy-R*1.78],[cx+R*1.74,cy-R*1.66]], 0.80);
        poly([[cx+R*.40,cy+R*.18],[cx+R*.14,cy+R*.44],[cx+R*1.62,cy+R*1.78],[cx+R*1.74,cy+R*1.66]], 0.80);

      } else if (v === 1) {
        // V1: T-arrangement — forward barrel + straight-up + straight-down (90° apart)
        // Reads as a + / T cross-weapon, NOT a Y.
        curved(() => {
          ctx.moveTo(cx-R*.36,cy-R*.21);
          ctx.lineTo(cx-R*.36,cy+R*.21);
          ctx.lineTo(cx-R*2.45,cy+R*.12);
          ctx.arc(cx-R*2.45,cy, R*.12, Math.PI*.5,-Math.PI*.5,true);
          ctx.lineTo(cx-R*2.45,cy-R*.12);
        }, 0.82);
        poly([[cx-R*.16,cy-R*.42],[cx+R*.16,cy-R*.42],[cx+R*.10,cy-R*2.30],[cx-R*.10,cy-R*2.30]], 0.80);
        poly([[cx-R*.16,cy+R*.42],[cx+R*.16,cy+R*.42],[cx+R*.10,cy+R*2.30],[cx-R*.10,cy+R*2.30]], 0.80);

      } else {
        // V2: L-arrangement — long forward + one steep-angled lateral + short rear stub
        // No bilateral mirroring at all — reads as an L, not a Y.
        curved(() => {
          ctx.moveTo(cx-R*.36,cy-R*.21);
          ctx.lineTo(cx-R*.36,cy+R*.21);
          ctx.lineTo(cx-R*2.75,cy+R*.11);
          ctx.arc(cx-R*2.75,cy, R*.11, Math.PI*.5,-Math.PI*.5,true);
          ctx.lineTo(cx-R*2.75,cy-R*.11);
        }, 0.82);
        // Single steep lateral barrel (~70° upward, no mirror)
        poly([[cx+R*.35,cy-R*.20],[cx+R*.08,cy-R*.42],[cx+R*.78,cy-R*2.08],[cx+R*.96,cy-R*1.92]], 0.80);
        // Short rear stub (asymmetric counterbalance, NOT a third full barrel)
        poly([[cx+R*.36,cy-R*.10],[cx+R*.36,cy+R*.10],[cx+R*1.08,cy+R*.06],[cx+R*1.08,cy-R*.06]], 0.68);
      }
      break;
    }

    // ── 4  CRAWLER — thin boomerang crescent ──────────────────────────────────
    // Primary: upper horn(cx-R*.68,cy-R*1.08), outer apex(cx+R*1.55,cy),
    //          lower horn(cx-R*.68,cy+R*1.08), inner apex(cx+R*.98,cy).
    // Variants — v=getChassisVariant(n):
    //   v=0  membrane + dominant upper claw + shorter lower claw (asymmetric)
    //   v=1  membrane + equal-length bilateral claws (symmetric crescent)
    //   v=2  dense membrane + single mega-claw upper + lower horn stub only (extreme)
    case 4: {
      const v = getChassisVariant(n);
      // Web membrane is drawn in all variants (alpha varies)
      curved(() => {
        ctx.moveTo(cx-R*.68,cy-R*1.08);
        ctx.bezierCurveTo(cx-R*1.08,cy-R*.55, cx-R*1.08,cy+R*.55, cx-R*.68,cy+R*1.08);
        ctx.bezierCurveTo(cx-R*.30,cy+R*.88, cx+R*.55,cy+R*.56, cx+R*.98,cy);
        ctx.bezierCurveTo(cx+R*.55,cy-R*.56, cx-R*.30,cy-R*.88, cx-R*.68,cy-R*1.08);
      }, v === 2 ? 0.42 : 0.35);

      if (v === 0) {
        // Dominant upper claw + shorter lower claw (asymmetric bilateral)
        curved(() => {
          ctx.moveTo(cx-R*.68,cy-R*1.08);
          ctx.bezierCurveTo(cx-R*1.05,cy-R*1.20, cx-R*1.60,cy-R*.88, cx-R*2.08,cy-R*1.38);
          ctx.lineTo(cx-R*1.82,cy-R*1.60);
          ctx.bezierCurveTo(cx-R*1.45,cy-R*1.08, cx-R*.98,cy-R*1.30, cx-R*.82,cy-R*1.18);
        }, 0.76);
        curved(() => {
          ctx.moveTo(cx-R*.68,cy+R*1.08);
          ctx.bezierCurveTo(cx-R*1.00,cy+R*1.18, cx-R*1.45,cy+R*.82, cx-R*1.75,cy+R*1.18);
          ctx.lineTo(cx-R*1.52,cy+R*1.38);
          ctx.bezierCurveTo(cx-R*1.28,cy+R*.98, cx-R*.92,cy+R*1.22, cx-R*.80,cy+R*1.15);
        }, 0.68);

      } else if (v === 1) {
        // Equal-length bilateral claws — crescent reads as bilateral, not asymmetric
        curved(() => {
          ctx.moveTo(cx-R*.68,cy-R*1.08);
          ctx.bezierCurveTo(cx-R*1.02,cy-R*1.15, cx-R*1.52,cy-R*.82, cx-R*1.88,cy-R*1.18);
          ctx.lineTo(cx-R*1.65,cy-R*1.38);
          ctx.bezierCurveTo(cx-R*1.32,cy-R*.98, cx-R*.90,cy-R*1.24, cx-R*.78,cy-R*1.16);
        }, 0.74);
        curved(() => {
          ctx.moveTo(cx-R*.68,cy+R*1.08);
          ctx.bezierCurveTo(cx-R*1.02,cy+R*1.15, cx-R*1.52,cy+R*.82, cx-R*1.88,cy+R*1.18);
          ctx.lineTo(cx-R*1.65,cy+R*1.38);
          ctx.bezierCurveTo(cx-R*1.32,cy+R*.98, cx-R*.90,cy+R*1.24, cx-R*.78,cy+R*1.16);
        }, 0.74);

      } else {
        // Single mega-claw upper + lower horn stub (extreme asymmetry)
        curved(() => {
          ctx.moveTo(cx-R*.68,cy-R*1.08);
          ctx.bezierCurveTo(cx-R*1.08,cy-R*1.22, cx-R*1.72,cy-R*.92, cx-R*2.30,cy-R*1.62);
          ctx.lineTo(cx-R*2.05,cy-R*1.88);
          ctx.bezierCurveTo(cx-R*1.58,cy-R*1.18, cx-R*1.05,cy-R*1.38, cx-R*.85,cy-R*1.22);
        }, 0.80);
        // Lower horn stub — no claw; its absence is the asymmetry signal
        curved(() => {
          ctx.moveTo(cx-R*.68,cy+R*1.08);
          ctx.bezierCurveTo(cx-R*.95,cy+R*1.12, cx-R*1.08,cy+R*1.02, cx-R*.95,cy+R*.88);
          ctx.bezierCurveTo(cx-R*.80,cy+R*.78, cx-R*.68,cy+R*.85, cx-R*.68,cy+R*1.08);
        }, 0.52);
      }
      break;
    }

    // ── 5  BRUISER — segmented chain (trilobite) ──────────────────────────────
    // Primary: front thorax segment (unchanged).
    // Variants — v=getChassisVariant(n):
    //   v=0  abdomen + pointed tail (3-segment — current)
    //   v=1  single wide abdomen, no tail (2-segment, broader mass)
    //   v=2  narrow abdomen + mid abdomen + small tail cap (4-segment cascade)
    case 5: {
      const v = getChassisVariant(n);
      if (v === 0) {
        // V0: thorax → abdomen → pointed tail (3-segment)
        poly([[cx+R*.48,cy-R*.60],[cx+R*1.42,cy-R*.50],[cx+R*1.62,cy],[cx+R*1.42,cy+R*.50],[cx+R*.48,cy+R*.60],[cx+R*.80,cy]], 0.80);
        poly([[cx+R*1.30,cy-R*.36],[cx+R*1.90,cy-R*.22],[cx+R*2.08,cy],[cx+R*1.90,cy+R*.22],[cx+R*1.30,cy+R*.36],[cx+R*1.62,cy]], 0.72);

      } else if (v === 1) {
        // V1: thorax → single wide abdomen, no tail (2-segment; broader silhouette)
        poly([
          [cx+R*.42,cy-R*.68],   // near TR, wider root
          [cx+R*1.58,cy-R*.60],
          [cx+R*2.02,cy-R*.18],
          [cx+R*2.08,cy],        // blunt rear (no pointed tail)
          [cx+R*2.02,cy+R*.18],
          [cx+R*1.58,cy+R*.60],
          [cx+R*.42,cy+R*.68],   // near BR
          [cx+R*.80,cy],
        ], 0.82);

      } else {
        // V2: thorax → narrow abdomen → mid abdomen → small tail cap (4-segment)
        poly([[cx+R*.50,cy-R*.55],[cx+R*1.22,cy-R*.42],[cx+R*1.38,cy],[cx+R*1.22,cy+R*.42],[cx+R*.50,cy+R*.55],[cx+R*.80,cy]], 0.82);
        poly([[cx+R*1.18,cy-R*.30],[cx+R*1.82,cy-R*.25],[cx+R*1.98,cy],[cx+R*1.82,cy+R*.25],[cx+R*1.18,cy+R*.30],[cx+R*1.38,cy]], 0.74);
        poly([[cx+R*1.72,cy-R*.16],[cx+R*2.28,cy-R*.12],[cx+R*2.38,cy],[cx+R*2.28,cy+R*.12],[cx+R*1.72,cy+R*.16],[cx+R*1.98,cy]], 0.62);
      }
      break;
    }

    // ── 6  SPECTER — asymmetric dendritic crystal ─────────────────────────────
    // Primary: diamond node (unchanged).
    // Variants — v=getChassisVariant(n):
    //   v=0  3 asymmetric arms: forward+sub-shard, upper-right, straight-down
    //   v=1  bifurcating trunk: forward trunk → two fork sub-arms + short upper arm
    //   v=2  4-arm unequal cross: 0°/90°/180°/270° — clearly NOT a Y
    case 6: {
      const v = getChassisVariant(n);
      if (v === 0) {
        // V0: 3 asymmetric arms at non-120° spacing (current)
        poly([[cx-R*.50,cy-R*.14],[cx-R*.50,cy+R*.14],[cx-R*2.45,cy+R*.12],[cx-R*2.60,cy],[cx-R*2.45,cy-R*.12]], 0.84);
        // Sub-shard branches off forward arm at ~58%
        poly([[cx-R*1.52,cy-R*.10],[cx-R*1.52,cy+R*.08],[cx-R*2.05,cy-R*.60],[cx-R*1.88,cy-R*.75]], 0.72);
        poly([[cx+R*.30,cy-R*.24],[cx+R*.05,cy-R*.50],[cx+R*1.55,cy-R*1.85],[cx+R*1.70,cy-R*1.68]], 0.82);
        poly([[cx-R*.14,cy+R*.52],[cx+R*.14,cy+R*.52],[cx+R*.10,cy+R*2.12],[cx-R*.10,cy+R*2.12]], 0.82);

      } else if (v === 1) {
        // V1: bifurcating trunk — short forward trunk splits into two sub-arms (tree-fork)
        // Trunk (shorter than V0's forward arm)
        poly([[cx-R*.50,cy-R*.14],[cx-R*.50,cy+R*.14],[cx-R*1.78,cy+R*.12],[cx-R*1.78,cy-R*.12]], 0.84);
        // Upper fork branch from trunk end
        poly([[cx-R*1.78,cy-R*.12],[cx-R*1.78,cy+R*.06],[cx-R*2.62,cy-R*.68],[cx-R*2.48,cy-R*.82]], 0.78);
        // Lower fork branch from trunk end
        poly([[cx-R*1.78,cy-R*.06],[cx-R*1.78,cy+R*.12],[cx-R*2.62,cy+R*.68],[cx-R*2.48,cy+R*.82]], 0.78);
        // Short upper arm (no symmetric counterpart — asymmetry preserved)
        poly([[cx+R*.28,cy-R*.22],[cx+R*.05,cy-R*.50],[cx+R*.82,cy-R*1.32],[cx+R*.98,cy-R*1.18]], 0.75);

      } else {
        // V2: 4-arm unequal cross — 0°/90°/180°/270° at DIFFERENT lengths
        // Nothing is symmetric: forward ≠ backward, up ≠ down → NOT a Y, NOT radial
        // Forward arm — longest
        poly([[cx-R*.50,cy-R*.14],[cx-R*.50,cy+R*.14],[cx-R*2.45,cy+R*.12],[cx-R*2.60,cy],[cx-R*2.45,cy-R*.12]], 0.84);
        // Upward arm — second longest
        poly([[cx-R*.14,cy-R*.52],[cx+R*.14,cy-R*.52],[cx+R*.10,cy-R*2.02],[cx-R*.10,cy-R*2.02]], 0.82);
        // Rightward arm — shortest (opposing forward; short stub reads as asymmetric)
        poly([[cx+R*.50,cy-R*.13],[cx+R*.50,cy+R*.13],[cx+R*1.22,cy+R*.09],[cx+R*1.22,cy-R*.09]], 0.72);
        // Downward arm — medium (not equal to upward arm)
        poly([[cx-R*.13,cy+R*.52],[cx+R*.13,cy+R*.52],[cx+R*.09,cy+R*1.72],[cx-R*.09,cy+R*1.72]], 0.80);
      }
      break;
    }

    // ── 7  STALKER — elongated spine series ───────────────────────────────────
    // Primary: horizontal rod (unchanged).
    // Variants — v=getChassisVariant(n):
    //   v=0  jaw + 3 dorsal spines diminuendo + bilateral tail fan (current)
    //   v=1  enlarged jaw + 2 taller spines + single upper-only tail fan
    //   v=2  4 spines crescendo (small→tall) + no jaw + tail cross
    default: {
      const v = getChassisVariant(n);
      if (v === 0) {
        // V0: standard jaw + 3-spine diminuendo + bilateral tail fan
        poly([[cx-R*1.15,cy-R*.30],[cx-R*1.15,cy+R*.30],[cx-R*1.48,cy+R*.48],[cx-R*2.02,cy+R*.18],[cx-R*2.15,cy],[cx-R*2.02,cy-R*.18],[cx-R*1.48,cy-R*.48]], 0.80);
        poly([[cx-R*.92,cy-R*.30],[cx-R*.68,cy-R*.30],[cx-R*.75,cy-R*1.45],[cx-R*.85,cy-R*1.45]], 0.76);
        poly([[cx-R*.02,cy-R*.29],[cx+R*.18,cy-R*.28],[cx+R*.12,cy-R*1.05],[cx-R*.02,cy-R*1.05]], 0.68);
        poly([[cx+R*.76,cy-R*.24],[cx+R*.96,cy-R*.22],[cx+R*.88,cy-R*.80],[cx+R*.78,cy-R*.80]], 0.60);
        poly([[cx+R*1.35,cy-R*.18],[cx+R*1.52,cy],[cx+R*1.78,cy-R*.62],[cx+R*1.52,cy-R*.82],[cx+R*1.28,cy-R*.55]], 0.72);
        poly([[cx+R*1.35,cy+R*.18],[cx+R*1.52,cy],[cx+R*1.78,cy+R*.62],[cx+R*1.52,cy+R*.82],[cx+R*1.28,cy+R*.55]], 0.72);

      } else if (v === 1) {
        // V1: enlarged jaw + 2 taller spines + upper-only tail fan (no bilateral)
        poly([[cx-R*1.15,cy-R*.30],[cx-R*1.15,cy+R*.30],[cx-R*1.55,cy+R*.52],[cx-R*2.18,cy+R*.20],[cx-R*2.35,cy],[cx-R*2.18,cy-R*.20],[cx-R*1.55,cy-R*.52]], 0.82);
        // Two taller spines (different widths; fewer but more prominent)
        poly([[cx-R*.82,cy-R*.30],[cx-R*.52,cy-R*.30],[cx-R*.62,cy-R*1.68],[cx-R*.75,cy-R*1.68]], 0.78);
        poly([[cx+R*.12,cy-R*.28],[cx+R*.40,cy-R*.28],[cx+R*.28,cy-R*1.20],[cx+R*.10,cy-R*1.20]], 0.68);
        // Upper-only tail fan (single lobe — not bilateral; reads as dorsal fin)
        poly([[cx+R*1.35,cy-R*.18],[cx+R*1.52,cy],[cx+R*1.88,cy-R*.72],[cx+R*1.60,cy-R*.92],[cx+R*1.28,cy-R*.58]], 0.76);

      } else {
        // V2: 4-spine crescendo (smallest front → tallest rear) + no jaw + tail cross
        // Crescendo reversal of V0's diminuendo — distinct read even at small scale
        poly([[cx-R*1.05,cy-R*.29],[cx-R*.88,cy-R*.29],[cx-R*.92,cy-R*.65],[cx-R*1.00,cy-R*.65]], 0.55);
        poly([[cx-R*.50,cy-R*.29],[cx-R*.28,cy-R*.28],[cx-R*.35,cy-R*.95],[cx-R*.50,cy-R*.95]], 0.64);
        poly([[cx+R*.02,cy-R*.28],[cx+R*.25,cy-R*.28],[cx+R*.15,cy-R*1.22],[cx-R*.02,cy-R*1.22]], 0.72);
        poly([[cx+R*.72,cy-R*.24],[cx+R*.98,cy-R*.24],[cx+R*.88,cy-R*1.55],[cx+R*.75,cy-R*1.55]], 0.82);
        // Tail cross — dorsal + ventral lobes (T-cross tail differs from V0 bilateral fan)
        poly([[cx+R*1.35,cy-R*.18],[cx+R*1.52,cy],[cx+R*1.80,cy-R*.55],[cx+R*1.55,cy-R*.75],[cx+R*1.25,cy-R*.52]], 0.72);
        poly([[cx+R*1.35,cy+R*.18],[cx+R*1.52,cy],[cx+R*1.80,cy+R*.55],[cx+R*1.55,cy+R*.75],[cx+R*1.25,cy+R*.52]], 0.60);
      }
      break;
    }
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  Archetype overlay renderers
//
//  Each function draws ON TOP of the already-filled body.
//  They use white/semi-transparent strokes to stay readable over any class color.
//  `alpha` is the caller-supplied opacity (primaryWeight·k or secondaryWeight·k).
//  They must save/restore ctx state.
// ═══════════════════════════════════════════════════════════════════════════════

type OverlayFn = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  R: number, lobes: number, spikes: boolean[],
  profile: VirusModelProfile, alpha: number,
) => void;

// ── biological ────────────────────────────────────────────────────────────────
// Organelle dots at lobe peaks; faint pore rings at notch sectors
const overlayBiological: OverlayFn = (ctx, cx, cy, R, lobes, spikes, _p, alpha) => {
  ctx.save();
  // Organelles at lobe positions
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.55})`;
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2;
    const d = R * 0.62;
    const r = R * 0.09;
    ctx.beginPath();
    ctx.arc(cx + d * Math.cos(angle), cy + d * Math.sin(angle), r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pore rings at notch sectors
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30})`;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    if (!spikes[i]) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const d = R * 0.55;
      ctx.beginPath();
      ctx.arc(cx + d * Math.cos(angle), cy + d * Math.sin(angle), R * 0.07, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Inner cell membrane
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.38, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.25})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

// ── humanoid ──────────────────────────────────────────────────────────────────
// Two eye-like dots near upper center; vertical bilateral axis; head arc
const overlayHumanoid: OverlayFn = (ctx, cx, cy, R, _l, _s, p, alpha) => {
  ctx.save();
  const eyeR = R * 0.08;
  const eyeY = cy - R * 0.30;
  // Eyes
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.80})`;
  ctx.beginPath();
  ctx.arc(cx - R * 0.18, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + R * 0.18, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  // Head arc (crown)
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy - R * 0.28, R * 0.32, Math.PI, 0);
  ctx.stroke();
  // Bilateral vertical axis — symmetry spine
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.20 * p.symmetryLevel})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy - R * 0.7);
  ctx.lineTo(cx, cy + R * 0.7);
  ctx.stroke();
  ctx.restore();
};

// ── animal ────────────────────────────────────────────────────────────────────
// Ear/fin spurs at upper-side; tail-hint at bottom
const overlayAnimal: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.50})`;
  ctx.lineWidth = 1.2;
  // Left ear spur
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.40, cy - R * 0.55);
  ctx.lineTo(cx - R * 0.55, cy - R * 0.90);
  ctx.lineTo(cx - R * 0.20, cy - R * 0.60);
  ctx.stroke();
  // Right ear spur
  ctx.beginPath();
  ctx.moveTo(cx + R * 0.40, cy - R * 0.55);
  ctx.lineTo(cx + R * 0.55, cy - R * 0.90);
  ctx.lineTo(cx + R * 0.20, cy - R * 0.60);
  ctx.stroke();
  // Tail curve at bottom
  ctx.beginPath();
  ctx.moveTo(cx, cy + R * 0.80);
  ctx.quadraticCurveTo(cx + R * 0.55, cy + R * 1.10, cx + R * 0.40, cy + R * 1.40);
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

// ── insectoid ─────────────────────────────────────────────────────────────────
// Sharp antenna lines at spike positions; segmentation band
const overlayInsectoid: OverlayFn = (ctx, cx, cy, R, _l, spikes, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    if (spikes[i]) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const x0 = cx + R * 0.90 * Math.cos(angle);
      const y0 = cy + R * 0.90 * Math.sin(angle);
      const x1 = cx + R * 1.35 * Math.cos(angle - 0.15);
      const y1 = cy + R * 1.35 * Math.sin(angle - 0.15);
      const x2 = cx + R * 1.35 * Math.cos(angle + 0.15);
      const y2 = cy + R * 1.35 * Math.sin(angle + 0.15);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  // Segmentation arc mid-body
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.28})`;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

// ── mechanical ────────────────────────────────────────────────────────────────
// Gear teeth at lobe boundaries; inner crosshatch
const overlayMechanical: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  // Gear teeth stubs at lobe angular positions
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.45})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2;
    const r0 = R * 0.82;
    const r1 = R * 1.05;
    ctx.beginPath();
    ctx.moveTo(cx + r0 * Math.cos(angle - 0.12), cy + r0 * Math.sin(angle - 0.12));
    ctx.lineTo(cx + r1 * Math.cos(angle - 0.12), cy + r1 * Math.sin(angle - 0.12));
    ctx.lineTo(cx + r1 * Math.cos(angle + 0.12), cy + r1 * Math.sin(angle + 0.12));
    ctx.lineTo(cx + r0 * Math.cos(angle + 0.12), cy + r0 * Math.sin(angle + 0.12));
    ctx.stroke();
  }
  // Inner crosshatch (structure lines)
  const gridA = alpha * 0.18 * p.mechanicalLevel;
  ctx.strokeStyle = `rgba(255,255,255,${gridA})`;
  ctx.lineWidth = 0.7;
  const step = R * 0.30;
  for (let d = -R; d <= R; d += step) {
    ctx.beginPath(); ctx.moveTo(cx + d, cy - R); ctx.lineTo(cx + d, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy + d); ctx.lineTo(cx + R, cy + d); ctx.stroke();
  }
  ctx.restore();
};

// ── armored ───────────────────────────────────────────────────────────────────
// Bold plate stroke + radial plate-division lines
const overlayArmored: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  // Thick armor rim
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
  ctx.lineWidth = R * 0.12 * (0.5 + p.armorLevel * 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  // Plate-division radials
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < lobes; i++) {
    const angle = ((i + 0.5) / lobes) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.40 * Math.cos(angle), cy + R * 0.40 * Math.sin(angle));
    ctx.lineTo(cx + R * 0.88 * Math.cos(angle), cy + R * 0.88 * Math.sin(angle));
    ctx.stroke();
  }
  ctx.restore();
};

// ── crystalline ───────────────────────────────────────────────────────────────
// Straight facet lines across body; glint points at spike positions
const overlayChystalline: OverlayFn = (ctx, cx, cy, R, lobes, spikes, _p, alpha) => {
  ctx.save();
  // Facet chords — polygon inscribed inside body
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.50})`;
  ctx.lineWidth = 0.9;
  const sides = lobes + 2;
  const pts: [number,number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + R * 0.82 * Math.cos(a), cy + R * 0.82 * Math.sin(a)]);
  }
  // Draw inscribed polygon
  ctx.beginPath();
  pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
  ctx.closePath();
  ctx.stroke();
  // Cross-facet diagonals
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.22})`;
  for (let i = 0; i < Math.floor(sides / 2); i++) {
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[(i + Math.floor(sides / 2)) % sides][0], pts[(i + Math.floor(sides / 2)) % sides][1]);
    ctx.stroke();
  }
  // Glint stars at spike tips
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.70})`;
  for (let i = 0; i < 8; i++) {
    if (spikes[i]) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const gx = cx + R * 1.20 * Math.cos(a);
      const gy = cy + R * 1.20 * Math.sin(a);
      ctx.beginPath(); ctx.arc(gx, gy, R * 0.05, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
};

// ── mineral ───────────────────────────────────────────────────────────────────
// Stipple dots (rocky texture); angular inner boundary
const overlayMineral: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.28})`;
  // 12 fixed-offset stipple dots using normalizedHash positions (all deterministic)
  for (let i = 0; i < 12; i++) {
    const a  = normalizedHash(i, 31) * Math.PI * 2;
    const d  = normalizedHash(i, 37) * R * 0.70;
    const dr = R * 0.05 + normalizedHash(i, 41) * R * 0.04;
    ctx.beginPath();
    ctx.arc(cx + d * Math.cos(a), cy + d * Math.sin(a), dr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Angular inner border (octagon)
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const px = cx + R * 0.45 * Math.cos(a);
    const py = cy + R * 0.45 * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
};

// ── plant ─────────────────────────────────────────────────────────────────────
// Soft petal arcs at lobe positions; vine curl at bottom
const overlayPlant: OverlayFn = (ctx, cx, cy, R, lobes, _s, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.45})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < lobes; i++) {
    const a  = (i / lobes) * Math.PI * 2 - Math.PI / 2;
    const px = cx + R * 0.70 * Math.cos(a);
    const py = cy + R * 0.70 * Math.sin(a);
    const cpx = cx + R * 1.10 * Math.cos(a - 0.35);
    const cpy = cy + R * 1.10 * Math.sin(a - 0.35);
    const cpx2 = cx + R * 1.10 * Math.cos(a + 0.35);
    const cpy2 = cy + R * 1.10 * Math.sin(a + 0.35);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cpx, cpy, cpx2, cpy2, px, py);
    ctx.stroke();
  }
  // Vine at bottom
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.28})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy + R * 0.85);
  ctx.quadraticCurveTo(cx + R * 0.50, cy + R * 1.20, cx + R * 0.25, cy + R * 1.50);
  ctx.stroke();
  ctx.restore();
};

// ── synthetic ─────────────────────────────────────────────────────────────────
// Clean inner circle; uniform tick marks at regular intervals
const overlaySynthetic: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.50})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  // Uniform tick marks at 12 positions
  for (let i = 0; i < 12; i++) {
    const a  = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r0 = R * (i % 3 === 0 ? 0.75 : 0.80);
    const r1 = R * 0.90;
    ctx.strokeStyle = `rgba(255,255,255,${alpha * (i % 3 === 0 ? 0.55 : 0.25)})`;
    ctx.lineWidth   = i % 3 === 0 ? 1.2 : 0.7;
    ctx.beginPath();
    ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
    ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();
};

// ── robotic ───────────────────────────────────────────────────────────────────
// Panel lines; circular central joint; indicator dots
const overlayRobotic: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  // Central joint
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.60})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.20})`;
  ctx.fill();
  // Panel division lines (like bolted plates)
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30 * p.mechanicalLevel})`;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.22 * Math.cos(a), cy + R * 0.22 * Math.sin(a));
    ctx.lineTo(cx + R * 0.80 * Math.cos(a), cy + R * 0.80 * Math.sin(a));
    ctx.stroke();
  }
  // Indicator dots
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.60})`;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx + R * 0.55 * Math.cos(a), cy + R * 0.55 * Math.sin(a), R * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

// ── amorphous ─────────────────────────────────────────────────────────────────
// A secondary offset blob at low opacity behind the main form
const overlayAmorphous: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.globalAlpha = alpha * 0.25;
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.beginPath();
  ctx.ellipse(cx + R * 0.20, cy + R * 0.15, R * 0.75, R * 0.60, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Fuzzy inner blob border
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.20})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

// ── geometric ─────────────────────────────────────────────────────────────────
// Inscribed regular polygon; inner grid
const overlayGeometric: OverlayFn = (ctx, cx, cy, R, lobes, _s, _p, alpha) => {
  ctx.save();
  const sides = Math.max(3, lobes);
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
  ctx.lineWidth = 1;
  // Outer polygon
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a  = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = cx + R * 0.88 * Math.cos(a);
    const py = cy + R * 0.88 * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Inner polygon (rotated half-step)
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.28})`;
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a  = (i / sides) * Math.PI * 2 - Math.PI / 2 + Math.PI / sides;
    const px = cx + R * 0.48 * Math.cos(a);
    const py = cy + R * 0.48 * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
};

// ── energy ────────────────────────────────────────────────────────────────────
// Radial glow rays; bright inner nucleus
const overlayEnergy: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  const rayCount = lobes * 2;
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35 * p.energyLevel})`;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < rayCount; i++) {
    const a  = (i / rayCount) * Math.PI * 2 - Math.PI / 2;
    const r0 = R * 0.30;
    const r1 = R * (0.80 + normalizedHash(i, 17) * 0.40);
    ctx.beginPath();
    ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
    ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    ctx.stroke();
  }
  // Bright nucleus
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.70})`;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// ── cybernetic ────────────────────────────────────────────────────────────────
// Circuit trace lines (right-angle routing); square pads
const overlayCybernetic: OverlayFn = (ctx, cx, cy, R, _l, spikes, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.45})`;
  ctx.lineWidth = 0.8;
  // 3 circuit traces emanating from center
  const routes = [
    [[-R*0.15, -R*0.15], [-R*0.15, -R*0.55], [-R*0.45, -R*0.55]],
    [[ R*0.15, -R*0.15], [ R*0.15, -R*0.40], [ R*0.50, -R*0.40]],
    [[ 0,      R*0.20 ], [ 0,       R*0.55], [-R*0.30,  R*0.55]],
  ];
  for (const route of routes) {
    ctx.beginPath();
    route.forEach(([dx, dy], i) => {
      i === 0 ? ctx.moveTo(cx + dx, cy + dy) : ctx.lineTo(cx + dx, cy + dy);
    });
    ctx.stroke();
    // Pad at end
    const [ex, ey] = route[route.length - 1];
    const ps = R * 0.07;
    ctx.strokeRect(cx + ex - ps, cy + ey - ps, ps * 2, ps * 2);
  }
  // Via dots at spike positions
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.50})`;
  for (let i = 0; i < 8; i++) {
    if (spikes[i]) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + R * 0.62 * Math.cos(a), cy + R * 0.62 * Math.sin(a), R * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

// ── skeletal ──────────────────────────────────────────────────────────────────
// Rib arcs; dark hollow center
const overlaySkeleetal: OverlayFn = (ctx, cx, cy, R, lobes, _s, _p, alpha) => {
  ctx.save();
  // Dark hollow center
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.45})`;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2);
  ctx.fill();
  // Rib arcs around the hollow
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.40})`;
  ctx.lineWidth = 1;
  const ribCount = Math.min(lobes, 6);
  for (let i = 0; i < ribCount; i++) {
    const startA = ((i - 0.35) / ribCount) * Math.PI * 2 - Math.PI / 2;
    const endA   = ((i + 0.35) / ribCount) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.55, startA, endA);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.72, startA, endA);
    ctx.stroke();
  }
  ctx.restore();
};

// ── fluid ─────────────────────────────────────────────────────────────────────
// Inner gradient-like lighter region; small trailing droplet
const overlayFluid: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  // Inner bright pool (lighter region)
  const grad = ctx.createRadialGradient(cx - R*0.15, cy - R*0.15, 0, cx, cy, R * 0.70);
  grad.addColorStop(0,   `rgba(255,255,255,${alpha * 0.40})`);
  grad.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.10})`);
  grad.addColorStop(1,   `rgba(255,255,255,0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.70, 0, Math.PI * 2);
  ctx.fill();
  // Surface tension ring
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.60, 0, Math.PI * 2);
  ctx.stroke();
  // Trailing droplet at right (directionality hint)
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.25})`;
  ctx.beginPath();
  ctx.ellipse(cx + R * 1.10, cy, R * 0.12, R * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// ── Dispatch map ─────────────────────────────────────────────────────────────

const ARCHETYPE_OVERLAYS: Record<VirusArchetype, OverlayFn> = {
  biological:  overlayBiological,
  humanoid:    overlayHumanoid,
  animal:      overlayAnimal,
  insectoid:   overlayInsectoid,
  mechanical:  overlayMechanical,
  armored:     overlayArmored,
  crystalline: overlayChystalline,
  mineral:     overlayMineral,
  plant:       overlayPlant,
  synthetic:   overlaySynthetic,
  robotic:     overlayRobotic,
  amorphous:   overlayAmorphous,
  geometric:   overlayGeometric,
  energy:      overlayEnergy,
  cybernetic:  overlayCybernetic,
  skeletal:    overlaySkeleetal,
  fluid:       overlayFluid,
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 9  Main draw entry point
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draw a virus at canvas coordinates (cx, cy).
 *
 * Rendering pipeline:
 *  1. Build polar shape from n (lobe + spike/notch encoding)
 *  2. Fill with class color + glow
 *  3. Draw class-specific decorations (rings, spokes)
 *  4. Draw primary archetype overlay  (interprets spikes/lobes/notches)
 *  5. Draw secondary archetype overlay at reduced opacity (hybrid coherence)
 */
export function drawVirus(
  ctx:   CanvasRenderingContext2D,
  cx:    number,
  cy:    number,
  n:     number,
  cell:  number,
  flash: boolean,
  green  = false,
): void {
  const cls = green ? 'even-composite' : getVirusClass(n);

  const fill = green
    ? (flash ? '#f0fdf4' : '#4ade80')
    : (flash ? CLASS_FLASH[cls] : CLASS_FILL[cls]);

  const glow = green ? 'rgba(74,222,128,0.50)' : CLASS_GLOW[cls];

  const R0 = cell * 0.22;
  const k  = cell * 0.016;
  const R  = getVirusRadius(n, R0, k);

  // ── 1a. Secondary / tertiary anatomy drawn first so large extending masses
  //        (wings, fins, limbs, shields) sit visually behind the primary core. ──
  drawChassisSecondary(ctx, cx, cy, n, R, fill, glow, flash);

  // ── 1b. Primary core chassis — drawn on top so it anchors over the anatomy. ──
  buildChassisPath(ctx, cx, cy, n, R);
  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // ── 2. Class-specific decorations ──
  if (!green) {
    if (cls === 'perfect-square' || cls === 'power-of-two') {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.40, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (cls === 'prime') {
      const L = getVirusLobes(n);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < L; i++) {
        const angle = (i / L) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + R * 0.58 * Math.cos(angle), cy + R * 0.58 * Math.sin(angle));
        ctx.stroke();
      }
    }
    if (cls === 'power-of-two') {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.70, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ── 3. Archetype overlays  (skipped during flash and for green enemies) ──
  if (!flash && !green) {
    const profile = getVirusModelProfile(n);
    const lobes   = getVirusLobes(n);
    const spikes  = getVirusSpikes(n);

    // Primary archetype at full weight
    ARCHETYPE_OVERLAYS[profile.primaryArchetype](
      ctx, cx, cy, R, lobes, spikes, profile,
      profile.primaryWeight * 0.80,
    );

    // Secondary archetype at reduced weight (hybrid coherence)
    if (profile.secondaryWeight > 0.15) {
      ARCHETYPE_OVERLAYS[profile.secondaryArchetype](
        ctx, cx, cy, R, lobes, spikes, profile,
        profile.secondaryWeight * 0.45,
      );
    }
  }
}
