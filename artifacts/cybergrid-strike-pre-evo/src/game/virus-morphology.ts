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

/** Returns chassis index 0–7 from n. */
function getChassisType(n: number): number {
  return n % 8;
}

/**
 * Builds the chassis outer-silhouette path.
 * Vertices and control points are absolute canvas coordinates centered on (cx, cy).
 *
 * Chassis catalogue:
 *   0  WEDGE      — hard arrowhead + rear chevron notch  (mechanical)
 *   1  STRIKER    — curved biomechanical fuselage        (organic/mech hybrid)
 *   2  TANK       — hard tall trapezoid, fortress front  (armor)
 *   3  ARTILLERY  — hard narrow bar, weapon platform     (mechanical)
 *   4  CRAWLER    — hard dorsal + curved organic belly   (biological)
 *   5  BRUISER    — convex muscle-bulge front face       (biomechanical)
 *   6  SPECTER    — hard tilted parallelogram            (crystalline/energy)
 *   7  STALKER    — carapace shell with curved arcs      (organic predator)
 */
function buildChassisPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, R: number,
): void {
  const chassis = getChassisType(n);
  ctx.beginPath();

  switch (chassis) {
    case 0: // WEDGE — hard mechanical fighter; arrowhead + chevron notch (all lineTo)
      ctx.moveTo(cx - R,        cy);
      ctx.lineTo(cx + R * 0.65, cy - R * 0.85);
      ctx.lineTo(cx + R * 0.28, cy);
      ctx.lineTo(cx + R * 0.65, cy + R * 0.85);
      break;

    case 1: // STRIKER — streamlined biomechanical hunter; curved fuselage belly
      ctx.moveTo(cx - R,         cy);                                          // sharp nose
      ctx.quadraticCurveTo(cx - R * 0.22, cy - R * 0.52, cx + R * 0.88, cy - R * 0.07); // upper hull arc
      ctx.lineTo(cx + R * 0.88,  cy + R * 0.07);                              // narrow tail edge
      ctx.quadraticCurveTo(cx - R * 0.22, cy + R * 0.52, cx - R,         cy); // lower hull arc
      break;

    case 2: // TANK — hard armor fortress; all hard edges
      ctx.moveTo(cx - R * 0.50, cy - R * 1.0);
      ctx.lineTo(cx - R * 0.50, cy + R * 1.0);
      ctx.lineTo(cx + R * 0.88, cy + R * 0.68);
      ctx.lineTo(cx + R * 0.88, cy - R * 0.68);
      break;

    case 3: // ARTILLERY — hard mechanical weapon bar; all hard edges
      ctx.moveTo(cx - R * 1.05, cy - R * 0.24);
      ctx.lineTo(cx - R * 1.05, cy + R * 0.24);
      ctx.lineTo(cx + R * 0.90, cy + R * 0.30);
      ctx.lineTo(cx + R * 0.90, cy - R * 0.30);
      break;

    case 4: // CRAWLER — organic ground creature; hard dorsal, curved underbelly
      ctx.moveTo(cx - R * 0.46, cy - R * 0.46);   // top-left  (hard dorsal)
      ctx.lineTo(cx + R * 0.46, cy - R * 0.46);   // top-right (hard dorsal edge)
      ctx.lineTo(cx + R * 0.70, cy + R * 0.28);   // right side angling down
      // Organic underbelly — convex belly membrane sags downward
      ctx.quadraticCurveTo(cx, cy + R * 1.08, cx - R * 0.70, cy + R * 0.28);
      break;

    case 5: // BRUISER — biomechanical brute; convex muscle-bulge on front face
      ctx.moveTo(cx - R * 0.68, cy - R * 0.92);   // top-front corner
      // Convex muscle belly on the front (left) face — control point pushes outward
      ctx.quadraticCurveTo(cx - R * 1.22, cy, cx - R * 0.60, cy + R * 0.92);
      ctx.lineTo(cx + R * 0.88, cy + R * 0.58);   // bottom-right
      ctx.lineTo(cx + R * 0.88, cy - R * 0.80);   // top-right
      break;

    case 6: // SPECTER — hard crystalline diagonal blade; all hard edges
      ctx.moveTo(cx - R * 0.82, cy - R * 0.55);
      ctx.lineTo(cx - R * 0.08, cy - R * 1.0);
      ctx.lineTo(cx + R * 0.82, cy + R * 0.55);
      ctx.lineTo(cx + R * 0.08, cy + R * 1.0);
      break;

    default: // STALKER (7) — organic predator carapace; curved upper shell + hard beak
      ctx.moveTo(cx - R * 0.78, cy);              // left rear point (hard)
      ctx.lineTo(cx - R * 0.28, cy - R * 0.95);  // upper beak tip (hard strike point)
      // Smooth carapace shell arc across the upper back
      ctx.quadraticCurveTo(cx + R * 0.22, cy - R * 0.94, cx + R * 0.55, cy - R * 0.78);
      ctx.lineTo(cx + R * 0.92, cy + R * 0.18);  // hard right claw tip
      // Curved lower shell — organic tail transition
      ctx.quadraticCurveTo(cx + R * 0.65, cy + R * 0.78, cx + R * 0.32, cy + R * 0.90);
      ctx.lineTo(cx - R * 0.42, cy + R * 0.58);  // hard lower-rear edge
      break;
  }

  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7b  Secondary chassis anatomy  (structural sub-shapes per chassis type)
//
//  Draws 2–3 filled structural masses that extend / overlap the primary chassis
//  to build a compound multi-part silhouette.
//
//  Curve philosophy (mirrors primary):
//   • Mechanical / armor (WEDGE, TANK, ARTILLERY, SPECTER) — hard lineTo only
//   • Organic / hybrid   (CRAWLER, BRUISER, STALKER, STRIKER) — selective
//     quadraticCurveTo / bezierCurveTo for muscle masses, membrane joints,
//     tapered appendages, and shell transitions
//
//  Call AFTER primary chassis fill+stroke; BEFORE archetype overlays.
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

  const sep  = flash ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
  const blur = flash ? 3 : 6;

  /** Fill a hard-edged polygon path then stroke a thin separation line. */
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
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  };

  /**
   * Fill a shape whose path is built by the caller-supplied function.
   * Use for any shape that needs curves (quadratic, bezier, arcs).
   */
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
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  };

  switch (chassis) {

    // ── 0  WEDGE  (mechanical — all hard edges) ───────────────────────────────
    case 0: {
      // Rear engine block fills the chevron notch
      poly([
        [cx + R * 0.28, cy - R * 0.22],
        [cx + R * 0.65, cy - R * 0.38],
        [cx + R * 0.95, cy - R * 0.26],
        [cx + R * 0.95, cy + R * 0.26],
        [cx + R * 0.65, cy + R * 0.38],
        [cx + R * 0.28, cy + R * 0.22],
      ], 0.70);
      // Upper delta fin — swept hard leading edge, curved swept trailing edge
      curved(() => {
        ctx.moveTo(cx - R * 0.20, cy - R * 0.44);
        ctx.lineTo(cx + R * 0.55, cy - R * 0.86);   // hard leading edge
        ctx.lineTo(cx + R * 0.48, cy - R * 0.60);
        ctx.quadraticCurveTo(cx + R * 0.10, cy - R * 0.50, cx - R * 0.08, cy - R * 0.47);
      }, 0.56);
      // Lower delta fin (mirrored)
      curved(() => {
        ctx.moveTo(cx - R * 0.20, cy + R * 0.44);
        ctx.lineTo(cx + R * 0.55, cy + R * 0.86);
        ctx.lineTo(cx + R * 0.48, cy + R * 0.60);
        ctx.quadraticCurveTo(cx + R * 0.10, cy + R * 0.50, cx - R * 0.08, cy + R * 0.47);
      }, 0.56);
      break;
    }

    // ── 1  STRIKER  (biomech hybrid — curved thruster pods, hard canards) ─────
    case 1: {
      // Rear organic thruster pod — rounded exhaust bladder shape
      curved(() => {
        ctx.moveTo(cx + R * 0.88, cy - R * 0.07);
        ctx.lineTo(cx + R * 0.88, cy - R * 0.28);
        ctx.quadraticCurveTo(cx + R * 1.18, cy - R * 0.28, cx + R * 1.18, cy); // rounded cap
        ctx.quadraticCurveTo(cx + R * 1.18, cy + R * 0.28, cx + R * 0.88, cy + R * 0.28);
        ctx.lineTo(cx + R * 0.88, cy + R * 0.07);
      }, 0.72);
      // Upper swept canard — hard leading edge, curved taper to tip
      curved(() => {
        ctx.moveTo(cx - R * 0.15, cy - R * 0.07);
        ctx.lineTo(cx - R * 0.25, cy - R * 0.62);   // hard leading edge
        ctx.lineTo(cx + R * 0.12, cy - R * 0.72);   // tip
        ctx.quadraticCurveTo(cx + R * 0.24, cy - R * 0.40, cx + R * 0.22, cy - R * 0.07); // soft trailing
      }, 0.56);
      // Lower canard (mirrored)
      curved(() => {
        ctx.moveTo(cx - R * 0.15, cy + R * 0.07);
        ctx.lineTo(cx - R * 0.25, cy + R * 0.62);
        ctx.lineTo(cx + R * 0.12, cy + R * 0.72);
        ctx.quadraticCurveTo(cx + R * 0.24, cy + R * 0.40, cx + R * 0.22, cy + R * 0.07);
      }, 0.56);
      break;
    }

    // ── 2  TANK  (armor — all hard edges) ────────────────────────────────────
    case 2: {
      // Front reactive armor slab
      poly([
        [cx - R * 0.82, cy - R * 0.52],
        [cx - R * 0.50, cy - R * 0.52],
        [cx - R * 0.50, cy + R * 0.52],
        [cx - R * 0.82, cy + R * 0.52],
      ], 0.72);
      // Rear command tower
      poly([
        [cx + R * 0.62, cy - R * 0.88],
        [cx + R * 0.88, cy - R * 0.68],
        [cx + R * 0.88, cy + R * 0.68],
        [cx + R * 0.62, cy + R * 0.88],
      ], 0.62);
      // Central turret ring — hard angled hex shape (rotary joint is mechanical)
      poly([
        [cx - R * 0.08, cy - R * 0.38],
        [cx + R * 0.28, cy - R * 0.44],
        [cx + R * 0.48, cy],
        [cx + R * 0.28, cy + R * 0.44],
        [cx - R * 0.08, cy + R * 0.38],
      ], 0.58);
      break;
    }

    // ── 3  ARTILLERY  (weapon platform — hard edges; rounded muzzle only) ────
    case 3: {
      // Barrel extension with rounded muzzle cap (gun barrels taper to round)
      curved(() => {
        ctx.moveTo(cx - R * 1.05, cy - R * 0.14);
        ctx.lineTo(cx - R * 1.05, cy + R * 0.14);
        ctx.lineTo(cx - R * 1.42, cy + R * 0.10);
        ctx.arc(cx - R * 1.42, cy, R * 0.10, Math.PI * 0.5, -Math.PI * 0.5, true);
        ctx.lineTo(cx - R * 1.42, cy - R * 0.10);
      }, 0.76);
      // Rear recoil block — hard
      poly([
        [cx + R * 0.88, cy - R * 0.52],
        [cx + R * 1.22, cy - R * 0.44],
        [cx + R * 1.22, cy + R * 0.44],
        [cx + R * 0.88, cy + R * 0.52],
      ], 0.68);
      // Mounting bracket above the barrel — hard
      poly([
        [cx - R * 0.08, cy - R * 0.30],
        [cx + R * 0.22, cy - R * 0.30],
        [cx + R * 0.22, cy - R * 0.62],
        [cx - R * 0.08, cy - R * 0.62],
      ], 0.58);
      break;
    }

    // ── 4  CRAWLER  (biological — all secondary masses are curved) ────────────
    case 4: {
      // Left leg mass — organic muscle bulge, rounded outer contour
      curved(() => {
        ctx.moveTo(cx - R * 0.46, cy - R * 0.38);
        ctx.lineTo(cx - R * 0.46, cy + R * 0.22);
        ctx.quadraticCurveTo(cx - R * 0.55, cy + R * 0.55, cx - R * 0.72, cy + R * 0.38);
        ctx.bezierCurveTo(
          cx - R * 1.02, cy + R * 0.20,
          cx - R * 1.02, cy - R * 0.22,
          cx - R * 0.70, cy - R * 0.32,
        );
      }, 0.70);
      // Right leg mass — mirrored
      curved(() => {
        ctx.moveTo(cx + R * 0.46, cy - R * 0.38);
        ctx.lineTo(cx + R * 0.70, cy - R * 0.32);
        ctx.bezierCurveTo(
          cx + R * 1.02, cy - R * 0.22,
          cx + R * 1.02, cy + R * 0.20,
          cx + R * 0.72, cy + R * 0.38,
        );
        ctx.quadraticCurveTo(cx + R * 0.55, cy + R * 0.55, cx + R * 0.46, cy + R * 0.22);
      }, 0.70);
      // Forward head crest — tapered dome rising from the dorsal flat
      curved(() => {
        ctx.moveTo(cx - R * 0.24, cy - R * 0.46);
        ctx.lineTo(cx + R * 0.24, cy - R * 0.46);
        ctx.quadraticCurveTo(cx + R * 0.18, cy - R * 0.95, cx, cy - R * 1.0);
        ctx.quadraticCurveTo(cx - R * 0.18, cy - R * 0.95, cx - R * 0.24, cy - R * 0.46);
      }, 0.58);
      break;
    }

    // ── 5  BRUISER  (biomechanical — curved muscle plate, hard shoulders) ─────
    case 5: {
      // Front muscle plate — convex arc face, same outward bulge as primary
      curved(() => {
        ctx.moveTo(cx - R * 0.68, cy - R * 0.70);
        ctx.quadraticCurveTo(cx - R * 1.30, cy, cx - R * 0.60, cy + R * 0.70);
        ctx.lineTo(cx - R * 0.50, cy + R * 0.50);
        ctx.lineTo(cx - R * 0.50, cy - R * 0.50);
      }, 0.72);
      // Upper shoulder armor — hard angular slab
      poly([
        [cx - R * 0.68, cy - R * 0.92],
        [cx + R * 0.12, cy - R * 0.90],
        [cx + R * 0.32, cy - R * 0.58],
        [cx - R * 0.42, cy - R * 0.52],
      ], 0.62);
      // Lower counter-mass — hard base with curved posterior edge
      curved(() => {
        ctx.moveTo(cx - R * 0.28, cy + R * 0.58);
        ctx.lineTo(cx + R * 0.88, cy + R * 0.58);
        ctx.lineTo(cx + R * 0.58, cy + R * 0.90);
        ctx.quadraticCurveTo(cx + R * 0.12, cy + R * 1.02, cx - R * 0.18, cy + R * 0.92);
      }, 0.58);
      break;
    }

    // ── 6  SPECTER  (crystalline/energy — hard chassis; organic bladder pods) ─
    case 6: {
      // Upper energy bladder — lens/teardrop shape (organic membrane mass)
      curved(() => {
        ctx.moveTo(cx - R * 0.08, cy - R * 1.0);
        ctx.bezierCurveTo(
          cx + R * 0.40, cy - R * 1.05,
          cx + R * 0.62, cy - R * 0.60,
          cx + R * 0.28, cy - R * 0.48,
        );
        ctx.quadraticCurveTo(cx + R * 0.02, cy - R * 0.56, cx - R * 0.08, cy - R * 1.0);
      }, 0.68);
      // Lower energy bladder (mirrored)
      curved(() => {
        ctx.moveTo(cx + R * 0.08, cy + R * 1.0);
        ctx.bezierCurveTo(
          cx - R * 0.40, cy + R * 1.05,
          cx - R * 0.62, cy + R * 0.60,
          cx - R * 0.28, cy + R * 0.48,
        );
        ctx.quadraticCurveTo(cx - R * 0.02, cy + R * 0.56, cx + R * 0.08, cy + R * 1.0);
      }, 0.68);
      // Spine blade along long diagonal — hard-edged crystal ridge
      poly([
        [cx - R * 0.58, cy - R * 0.28],
        [cx - R * 0.38, cy - R * 0.55],
        [cx + R * 0.58, cy + R * 0.28],
        [cx + R * 0.38, cy + R * 0.55],
      ], 0.54);
      break;
    }

    // ── 7  STALKER  (organic predator — curved spine, bezier anchor, hard flange)
    default: {
      // Dorsal spine — convex arch following the carapace upper shell
      curved(() => {
        ctx.moveTo(cx - R * 0.28, cy - R * 0.95);
        ctx.quadraticCurveTo(cx + R * 0.14, cy - R * 1.12, cx + R * 0.55, cy - R * 0.78);
        ctx.lineTo(cx + R * 0.45, cy - R * 0.50);
        ctx.quadraticCurveTo(cx + R * 0.10, cy - R * 0.80, cx - R * 0.18, cy - R * 0.60);
      }, 0.68);
      // Lower anchor mass — organic rounded bulk (bezier muscle curves)
      curved(() => {
        ctx.moveTo(cx + R * 0.32, cy + R * 0.90);
        ctx.bezierCurveTo(
          cx + R * 0.60, cy + R * 1.15,
          cx + R * 1.10, cy + R * 0.80,
          cx + R * 0.92, cy + R * 0.45,
        );
        ctx.quadraticCurveTo(cx + R * 0.78, cy + R * 0.60, cx + R * 0.50, cy + R * 0.78);
      }, 0.62);
      // Rear lateral flange — hard angular plate (exoskeletal, not organic)
      poly([
        [cx - R * 0.78, cy],
        [cx - R * 0.42, cy + R * 0.58],
        [cx - R * 0.68, cy + R * 0.80],
        [cx - R * 1.02, cy + R * 0.28],
      ], 0.58);
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

  // ── 1. Base shape ──
  buildChassisPath(ctx, cx, cy, n, R);
  ctx.shadowColor = glow;
  ctx.shadowBlur  = flash ? 4 : 10;
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // ── 1b. Secondary structural anatomy (filled sub-shapes extending the silhouette) ──
  drawChassisSecondary(ctx, cx, cy, n, R, fill, glow, flash);

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
