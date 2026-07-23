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
const CHASSIS_SEQ = [0, 4, 1, 5, 2, 7, 4, 3, 1, 6, 5, 7] as const;

/** Returns chassis index 0–7 from n. */
function getChassisType(n: number): number {
  return CHASSIS_SEQ[n % CHASSIS_SEQ.length];
}

function getChassisVariant(n: number): number {
  return (Math.floor(n / CHASSIS_SEQ.length) + Math.floor((n % CHASSIS_SEQ.length) / 4)) % 3;
}

function buildChassisPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, R: number,
): void {
  const chassis = getChassisType(n);
  ctx.beginPath();

  switch (chassis) {

    case 0: // WEDGE — true wide delta wing
      ctx.moveTo(cx - R * 0.52, cy);
      ctx.lineTo(cx - R * 0.02, cy - R * 2.05);
      ctx.lineTo(cx + R * 1.05, cy - R * 0.12);
      ctx.lineTo(cx + R * 1.05, cy + R * 0.12);
      ctx.lineTo(cx - R * 0.02, cy + R * 2.05);
      break;

    case 1: // STRIKER — D-lobe asymmetric
      ctx.moveTo(cx - R * 0.82, cy + R * 0.24);
      ctx.bezierCurveTo(cx - R * 1.10, cy + R * 0.10, cx - R * 1.10, cy - R * 0.10, cx - R * 0.82, cy - R * 0.24);
      ctx.bezierCurveTo(cx - R * 0.40, cy - R * 1.55, cx + R * 0.55, cy - R * 1.52, cx + R * 0.90, cy - R * 0.35);
      ctx.lineTo(cx + R * 0.90, cy + R * 0.24);
      break;

    case 2: // TANK — compact hexagonal shell
      ctx.moveTo(cx - R * 0.85, cy);
      ctx.lineTo(cx - R * 0.45, cy - R * 0.95);
      ctx.lineTo(cx + R * 0.45, cy - R * 0.95);
      ctx.lineTo(cx + R * 0.85, cy);
      ctx.lineTo(cx + R * 0.45, cy + R * 0.95);
      ctx.lineTo(cx - R * 0.45, cy + R * 0.95);
      break;

    case 3: // ARTILLERY — radial 3-spoke
      ctx.moveTo(cx,             cy - R * 0.42);
      ctx.lineTo(cx + R * 0.36, cy - R * 0.21);
      ctx.lineTo(cx + R * 0.36, cy + R * 0.21);
      ctx.lineTo(cx,             cy + R * 0.42);
      ctx.lineTo(cx - R * 0.36, cy + R * 0.21);
      ctx.lineTo(cx - R * 0.36, cy - R * 0.21);
      break;

    case 4: // CRAWLER — thin boomerang crescent
      ctx.moveTo(cx - R * 0.68, cy - R * 1.08);
      ctx.bezierCurveTo(cx + R * 0.05, cy - R * 1.58, cx + R * 1.55, cy - R * 0.62, cx + R * 1.55, cy);
      ctx.bezierCurveTo(cx + R * 1.55, cy + R * 0.62, cx + R * 0.05, cy + R * 1.58, cx - R * 0.68, cy + R * 1.08);
      ctx.bezierCurveTo(cx - R * 0.30, cy + R * 0.88, cx + R * 0.55, cy + R * 0.56, cx + R * 0.98, cy);
      ctx.bezierCurveTo(cx + R * 0.55, cy - R * 0.56, cx - R * 0.30, cy - R * 0.88, cx - R * 0.68, cy - R * 1.08);
      break;

    case 5: // BRUISER — segmented chain front thorax
      ctx.moveTo(cx - R * 0.65, cy - R * 0.72);
      ctx.lineTo(cx + R * 0.62, cy - R * 0.72);
      ctx.lineTo(cx + R * 0.80, cy);
      ctx.lineTo(cx + R * 0.62, cy + R * 0.72);
      ctx.lineTo(cx - R * 0.65, cy + R * 0.72);
      ctx.quadraticCurveTo(cx - R * 1.12, cy, cx - R * 0.65, cy - R * 0.72);
      break;

    case 6: // SPECTER — asymmetric dendritic crystal; diamond node
      ctx.moveTo(cx,             cy - R * 0.52);
      ctx.lineTo(cx + R * 0.50, cy);
      ctx.lineTo(cx,             cy + R * 0.52);
      ctx.lineTo(cx - R * 0.50, cy);
      break;

    default: // STALKER (7) — elongated spine; horizontal rod
      ctx.moveTo(cx - R * 1.15, cy - R * 0.30);
      ctx.lineTo(cx - R * 1.15, cy + R * 0.30);
      ctx.lineTo(cx + R * 1.35, cy + R * 0.18);
      ctx.lineTo(cx + R * 1.52, cy);
      ctx.lineTo(cx + R * 1.35, cy - R * 0.18);
      break;
  }

  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7b  Secondary anatomy — elaborated hierarchical build
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

  const sep  = flash ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.22)';
  const blur = flash ? 3 : 7;

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

  const circ = (x: number, y: number, r: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = fill;
    ctx.shadowColor = glow;
    ctx.shadowBlur  = blur;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = sep;
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  };

  switch (chassis) {

    // ── 0  WEDGE ─────────────────────────────────────────────────────────────
    case 0: {
      poly([[cx-R*0.02,cy-R*2.05],[cx-R*0.55,cy-R*2.82],[cx+R*0.10,cy-R*3.05],[cx+R*0.68,cy-R*2.75],[cx+R*0.56,cy-R*2.02],[cx+R*0.22,cy-R*1.95]], 0.76);
      poly([[cx-R*0.02,cy+R*2.05],[cx-R*0.55,cy+R*2.82],[cx+R*0.10,cy+R*3.05],[cx+R*0.68,cy+R*2.75],[cx+R*0.56,cy+R*2.02],[cx+R*0.22,cy+R*1.95]], 0.76);
      poly([[cx-R*0.52,cy-R*0.08],[cx-R*0.52,cy+R*0.08],[cx+R*0.30,cy+R*0.06],[cx+R*1.05,cy+R*0.12],[cx+R*1.05,cy-R*0.12],[cx+R*0.30,cy-R*0.06]], 0.70);
      poly([[cx+R*0.55,cy-R*0.12],[cx+R*1.05,cy-R*0.12],[cx+R*1.58,cy-R*0.98],[cx+R*1.22,cy-R*1.06],[cx+R*0.80,cy-R*0.40]], 0.72);
      poly([[cx+R*0.55,cy+R*0.12],[cx+R*1.05,cy+R*0.12],[cx+R*1.58,cy+R*0.98],[cx+R*1.22,cy+R*1.06],[cx+R*0.80,cy+R*0.40]], 0.72);
      for (const side of [-1, 1] as const) {
        for (let i = 0; i < 2; i++) {
          const sf = 0.38 + i * 0.40;
          const wx = cx + R*sf*0.30; const wy = cy + side * R*2.05*sf;
          poly([[wx-R*0.05,wy-side*R*0.04],[wx+R*0.05,wy-side*R*0.04],[wx+R*0.08,wy+side*R*0.28],[wx-R*0.08,wy+side*R*0.28]], 0.65);
          poly([[wx-R*0.14,wy+side*R*0.26],[wx+R*0.14,wy+side*R*0.26],[wx+R*0.16,wy+side*R*0.50],[wx+R*0.06,wy+side*R*0.60],[wx-R*0.06,wy+side*R*0.60],[wx-R*0.16,wy+side*R*0.50]], 0.70);
        }
      }
      poly([[cx-R*0.52,cy-R*0.06],[cx-R*0.52,cy+R*0.06],[cx-R*1.22,cy+R*0.04],[cx-R*1.58,cy],[cx-R*1.22,cy-R*0.04]], 0.82);
      poly([[cx-R*1.58,cy-R*0.04],[cx-R*1.58,cy+R*0.04],[cx-R*2.05,cy]], 0.88);
      for (const side of [-1, 1] as const) {
        curved(() => {
          ctx.moveTo(cx+R*0.15, cy+side*R*0.95);
          ctx.bezierCurveTo(cx-R*0.05,cy+side*R*0.78, cx-R*0.05,cy+side*R*0.62, cx+R*0.15,cy+side*R*0.50);
          ctx.lineTo(cx+R*0.46, cy+side*R*0.52);
          ctx.bezierCurveTo(cx+R*0.26,cy+side*R*0.65, cx+R*0.26,cy+side*R*0.80, cx+R*0.46,cy+side*R*0.95);
        }, 0.60);
      }
      break;
    }

    // ── 1  STRIKER ────────────────────────────────────────────────────────────
    case 1: {
      const v = getChassisVariant(n);
      if (v === 0) {
        curved(() => {
          ctx.moveTo(cx-R*.28,cy-R*1.38);
          ctx.bezierCurveTo(cx-R*.58,cy-R*1.82,cx-R*.52,cy-R*2.28,cx-R*.15,cy-R*2.32);
          ctx.bezierCurveTo(cx+R*.18,cy-R*2.12,cx+R*.35,cy-R*1.68,cx+R*.28,cy-R*1.38);
          ctx.quadraticCurveTo(cx,cy-R*1.50,cx-R*.28,cy-R*1.38);
        }, 0.74);
        poly([[cx-R*.42,cy-R*1.32],[cx+R*.40,cy-R*1.32],[cx+R*.32,cy-R*1.58],[cx-R*.34,cy-R*1.58]], 0.68);
        curved(() => {
          ctx.moveTo(cx-R*.82,cy-R*.24);
          ctx.bezierCurveTo(cx-R*1.12,cy-R*.42,cx-R*1.52,cy-R*1.08,cx-R*1.22,cy-R*1.58);
          ctx.bezierCurveTo(cx-R*.88,cy-R*1.62,cx-R*.62,cy-R*1.28,cx-R*.52,cy-R*.82);
          ctx.quadraticCurveTo(cx-R*.62,cy-R*.42,cx-R*.82,cy-R*.24);
        }, 0.68);
        curved(() => {
          ctx.moveTo(cx-R*1.10,cy-R*1.25);
          ctx.bezierCurveTo(cx-R*1.35,cy-R*1.45,cx-R*1.28,cy-R*1.88,cx-R*.98,cy-R*1.92);
          ctx.bezierCurveTo(cx-R*.72,cy-R*1.78,cx-R*.75,cy-R*1.48,cx-R*.90,cy-R*1.30);
        }, 0.55);
        poly([[cx+R*.90,cy-R*.35],[cx+R*1.18,cy-R*.28],[cx+R*1.32,cy-R*.88],[cx+R*1.05,cy-R*.95]], 0.72);
        poly([[cx+R*.90,cy-R*.35],[cx+R*1.10,cy-R*.30],[cx+R*1.18,cy-R*.62],[cx+R*1.00,cy-R*.64]], 0.56);
        poly([[cx-R*.08,cy-R*1.02],[cx+R*.12,cy-R*.98],[cx+R*.22,cy-R*1.25],[cx+R*.02,cy-R*1.30]], 0.60);
        poly([[cx+R*.30,cy-R*.70],[cx+R*.50,cy-R*.66],[cx+R*.58,cy-R*.92],[cx+R*.38,cy-R*.96]], 0.56);
        poly([[cx+R*.60,cy-R*.38],[cx+R*.78,cy-R*.34],[cx+R*.84,cy-R*.58],[cx+R*.64,cy-R*.62]], 0.52);
        poly([[cx-R*.82,cy+R*.28],[cx+R*.90,cy+R*.32],[cx+R*.90,cy+R*.52],[cx+R*.18,cy+R*.56],[cx-R*.62,cy+R*.46]], 0.48);
        circ(cx-R*1.28,cy-R*1.30,R*0.10,0.72);
      } else if (v === 1) {
        curved(() => {
          ctx.moveTo(cx-R*.52,cy-R*1.22);
          ctx.bezierCurveTo(cx-R*.72,cy-R*1.58,cx-R*.20,cy-R*1.98,cx+R*.35,cy-R*1.80);
          ctx.bezierCurveTo(cx+R*.65,cy-R*1.55,cx+R*.62,cy-R*1.20,cx+R*.48,cy-R*1.18);
          ctx.quadraticCurveTo(cx+R*.05,cy-R*1.32,cx-R*.52,cy-R*1.22);
        }, 0.74);
        poly([[cx+R*.48,cy-R*1.18],[cx+R*.64,cy-R*1.20],[cx+R*.86,cy-R*1.82],[cx+R*.70,cy-R*1.88]], 0.68);
        poly([[cx+R*.42,cy-R*1.15],[cx+R*.56,cy-R*1.18],[cx+R*.74,cy-R*1.72],[cx+R*.60,cy-R*1.78]], 0.60);
        poly([[cx+R*.35,cy-R*1.14],[cx+R*.48,cy-R*1.16],[cx+R*.60,cy-R*1.55],[cx+R*.48,cy-R*1.60]], 0.52);
        curved(() => {
          ctx.moveTo(cx-R*.82,cy-R*.24);
          ctx.bezierCurveTo(cx-R*1.08,cy-R*.38,cx-R*1.40,cy-R*.80,cx-R*1.12,cy-R*1.25);
          ctx.bezierCurveTo(cx-R*.88,cy-R*1.30,cx-R*.68,cy-R*1.00,cx-R*.58,cy-R*.68);
          ctx.quadraticCurveTo(cx-R*.66,cy-R*.38,cx-R*.82,cy-R*.24);
        }, 0.68);
        poly([[cx-R*1.05,cy-R*1.00],[cx-R*.95,cy-R*1.18],[cx-R*1.40,cy-R*1.55],[cx-R*1.52,cy-R*1.42]], 0.65);
        poly([[cx+R*.90,cy-R*.35],[cx+R*1.12,cy-R*.30],[cx+R*1.22,cy-R*.82],[cx+R*1.02,cy-R*.85]], 0.72);
        poly([[cx+R*.90,cy-R*.35],[cx+R*1.20,cy-R*.28],[cx+R*1.35,cy-R*.58],[cx+R*1.12,cy-R*.62]], 0.60);
        poly([[cx-R*.10,cy-R*.98],[cx+R*.08,cy-R*.94],[cx+R*.16,cy-R*1.16],[cx-R*.02,cy-R*1.22]], 0.55);
        poly([[cx+R*.22,cy-R*.72],[cx+R*.40,cy-R*.68],[cx+R*.48,cy-R*.88],[cx+R*.30,cy-R*.92]], 0.50);
        poly([[cx-R*.82,cy+R*.22],[cx+R*.90,cy+R*.24],[cx+R*.90,cy+R*.45],[cx+R*.15,cy+R*.55],[cx-R*.62,cy+R*.42]], 0.52);
        circ(cx-R*1.10,cy-R*1.12,R*0.10,0.70);
      } else {
        curved(() => {
          ctx.moveTo(cx-R*.30,cy-R*1.35);
          ctx.bezierCurveTo(cx-R*.52,cy-R*1.78,cx-R*.42,cy-R*2.22,cx-R*.12,cy-R*2.24);
          ctx.bezierCurveTo(cx+R*.10,cy-R*2.08,cx+R*.20,cy-R*1.72,cx+R*.08,cy-R*1.38);
          ctx.quadraticCurveTo(cx-R*.10,cy-R*1.42,cx-R*.30,cy-R*1.35);
        }, 0.74);
        curved(() => {
          ctx.moveTo(cx-R*.42,cy-R*1.82);
          ctx.bezierCurveTo(cx-R*.62,cy-R*2.02,cx-R*.82,cy-R*2.35,cx-R*.60,cy-R*2.52);
          ctx.bezierCurveTo(cx-R*.38,cy-R*2.48,cx-R*.28,cy-R*2.18,cx-R*.28,cy-R*1.92);
        }, 0.58);
        curved(() => {
          ctx.moveTo(cx+R*.18,cy-R*1.25);
          ctx.bezierCurveTo(cx+R*.05,cy-R*1.48,cx+R*.18,cy-R*1.88,cx+R*.50,cy-R*1.85);
          ctx.bezierCurveTo(cx+R*.75,cy-R*1.68,cx+R*.75,cy-R*1.38,cx+R*.52,cy-R*1.25);
          ctx.quadraticCurveTo(cx+R*.35,cy-R*1.22,cx+R*.18,cy-R*1.25);
        }, 0.68);
        curved(() => {
          ctx.moveTo(cx-R*.82,cy-R*.24);
          ctx.bezierCurveTo(cx-R*1.05,cy-R*.55,cx-R*1.62,cy-R*.95,cx-R*1.52,cy-R*1.45);
          ctx.bezierCurveTo(cx-R*1.22,cy-R*1.60,cx-R*.88,cy-R*1.28,cx-R*.68,cy-R*.85);
          ctx.quadraticCurveTo(cx-R*.72,cy-R*.45,cx-R*.82,cy-R*.24);
        }, 0.68);
        poly([[cx-R*1.48,cy-R*1.20],[cx-R*1.38,cy-R*1.38],[cx-R*1.72,cy-R*1.68],[cx-R*1.84,cy-R*1.52]], 0.62);
        poly([[cx-R*1.35,cy-R*.90],[cx-R*1.25,cy-R*1.08],[cx-R*1.58,cy-R*1.30],[cx-R*1.68,cy-R*1.15]], 0.55);
        curved(() => {
          ctx.moveTo(cx-R*.65,cy-R*.58);
          ctx.bezierCurveTo(cx-R*.80,cy-R*.75,cx-R*.95,cy-R*.95,cx-R*.82,cy-R*1.12);
          ctx.bezierCurveTo(cx-R*.65,cy-R*1.18,cx-R*.50,cy-R*.98,cx-R*.42,cy-R*.75);
          ctx.quadraticCurveTo(cx-R*.48,cy-R*.62,cx-R*.65,cy-R*.58);
        }, 0.52);
        poly([[cx-R*.05,cy-R*.95],[cx+R*.12,cy-R*.92],[cx+R*.18,cy-R*1.12],[cx+R*.02,cy-R*1.16]], 0.52);
        circ(cx-R*1.50,cy-R*1.28,R*0.10,0.68);
      }
      break;
    }

    // ── 2  TANK ───────────────────────────────────────────────────────────────
    case 2: {
      poly([[cx-R*0.85,cy-R*0.28],[cx-R*0.85,cy+R*0.28],[cx-R*1.52,cy+R*0.56],[cx-R*2.18,cy],[cx-R*1.52,cy-R*0.56]], 0.84);
      poly([[cx-R*2.18,cy-R*0.08],[cx-R*2.18,cy+R*0.08],[cx-R*2.75,cy+R*0.05],[cx-R*2.98,cy],[cx-R*2.75,cy-R*0.05]], 0.88);
      poly([[cx-R*.78,cy+R*.55],[cx-R*.42,cy+R*.95],[cx-R*.88,cy+R*1.62],[cx-R*1.08,cy+R*1.50],[cx-R*1.00,cy+R*.72]], 0.76);
      poly([[cx-R*.78,cy-R*.55],[cx-R*.42,cy-R*.95],[cx-R*.88,cy-R*1.62],[cx-R*1.08,cy-R*1.50],[cx-R*1.00,cy-R*.72]], 0.76);
      poly([[cx-R*.88,cy+R*1.62],[cx-R*1.08,cy+R*1.50],[cx-R*1.28,cy+R*1.82],[cx-R*1.10,cy+R*1.92]], 0.82);
      poly([[cx-R*.88,cy-R*1.62],[cx-R*1.08,cy-R*1.50],[cx-R*1.28,cy-R*1.82],[cx-R*1.10,cy-R*1.92]], 0.82);
      poly([[cx-R*0.45,cy-R*0.95],[cx+R*0.45,cy-R*0.95],[cx+R*0.68,cy-R*1.88],[cx,cy-R*2.02],[cx-R*0.68,cy-R*1.88]], 0.72);
      poly([[cx-R*0.28,cy-R*1.05],[cx+R*0.28,cy-R*1.05],[cx+R*0.40,cy-R*1.60],[cx,cy-R*1.72],[cx-R*0.40,cy-R*1.60]], 0.58);
      poly([[cx-R*0.45,cy+R*0.95],[cx+R*0.45,cy+R*0.95],[cx+R*0.68,cy+R*1.88],[cx,cy+R*2.02],[cx-R*0.68,cy+R*1.88]], 0.72);
      poly([[cx-R*0.28,cy+R*1.05],[cx+R*0.28,cy+R*1.05],[cx+R*0.40,cy+R*1.60],[cx,cy+R*1.72],[cx-R*0.40,cy+R*1.60]], 0.58);
      poly([[cx-R*.30,cy-R*.92],[cx+R*.68,cy-R*.82],[cx+R*.85,cy-R*1.22],[cx+R*.55,cy-R*1.42],[cx-R*.18,cy-R*1.30]], 0.68);
      poly([[cx-R*.30,cy+R*.92],[cx+R*.68,cy+R*.82],[cx+R*.85,cy+R*1.22],[cx+R*.55,cy+R*1.42],[cx-R*.18,cy+R*1.30]], 0.68);
      poly([[cx+R*0.85,cy-R*0.22],[cx+R*0.85,cy+R*0.22],[cx+R*1.55,cy+R*0.14],[cx+R*1.72,cy],[cx+R*1.55,cy-R*0.14]], 0.70);
      poly([[cx+R*1.55,cy-R*0.08],[cx+R*1.55,cy+R*0.08],[cx+R*2.18,cy]], 0.62);
      circ(cx+R*0.20,cy-R*0.58,R*0.18,0.68);
      break;
    }

    // ── 3  ARTILLERY ──────────────────────────────────────────────────────────
    case 3: {
      const v = getChassisVariant(n);
      if (v === 0) {
        curved(() => {
          ctx.moveTo(cx-R*.36,cy-R*.28); ctx.lineTo(cx-R*.36,cy+R*.28);
          ctx.lineTo(cx-R*2.72,cy+R*.16); ctx.arc(cx-R*2.72,cy,R*.16,Math.PI*.5,-Math.PI*.5,true); ctx.lineTo(cx-R*2.72,cy-R*.16);
        }, 0.82);
        poly([[cx-R*2.72,cy-R*.22],[cx-R*2.72,cy+R*.22],[cx-R*3.00,cy+R*.16],[cx-R*3.12,cy],[cx-R*3.00,cy-R*.16]], 0.82);
        poly([[cx-R*.36,cy+R*.30],[cx-R*.26,cy+R*.44],[cx-R*2.48,cy+R*.38],[cx-R*2.62,cy+R*.28]], 0.68);
        poly([[cx+R*.40,cy-R*.18],[cx+R*.14,cy-R*.44],[cx+R*1.80,cy-R*1.98],[cx+R*1.92,cy-R*1.85]], 0.80);
        poly([[cx+R*1.80,cy-R*1.98],[cx+R*1.92,cy-R*1.85],[cx+R*2.08,cy-R*2.12],[cx+R*1.96,cy-R*2.26]], 0.80);
        poly([[cx+R*.30,cy-R*.12],[cx+R*.08,cy-R*.36],[cx+R*1.62,cy-R*1.70],[cx+R*1.72,cy-R*1.60]], 0.65);
        poly([[cx+R*.40,cy+R*.18],[cx+R*.14,cy+R*.44],[cx+R*1.80,cy+R*1.98],[cx+R*1.92,cy+R*1.85]], 0.80);
        poly([[cx+R*1.80,cy+R*1.98],[cx+R*1.92,cy+R*1.85],[cx+R*2.08,cy+R*2.12],[cx+R*1.96,cy+R*2.26]], 0.80);
        poly([[cx+R*.30,cy+R*.12],[cx+R*.08,cy+R*.36],[cx+R*1.62,cy+R*1.70],[cx+R*1.72,cy+R*1.60]], 0.65);
        poly([[cx-R*.36,cy-R*.28],[cx+R*.14,cy-R*.44],[cx,cy-R*.62],[cx-R*.30,cy-R*.46]], 0.55);
        poly([[cx-R*.36,cy+R*.28],[cx+R*.14,cy+R*.44],[cx,cy+R*.62],[cx-R*.30,cy+R*.46]], 0.55);
        circ(cx,cy,R*0.50,0.50);
      } else if (v === 1) {
        curved(() => {
          ctx.moveTo(cx-R*.36,cy-R*.22); ctx.lineTo(cx-R*.36,cy+R*.22);
          ctx.lineTo(cx-R*2.55,cy+R*.14); ctx.arc(cx-R*2.55,cy,R*.14,Math.PI*.5,-Math.PI*.5,true); ctx.lineTo(cx-R*2.55,cy-R*.14);
        }, 0.82);
        poly([[cx-R*2.55,cy-R*.20],[cx-R*2.55,cy+R*.20],[cx-R*2.82,cy+R*.16],[cx-R*2.98,cy],[cx-R*2.82,cy-R*.16]], 0.80);
        poly([[cx-R*.36,cy+R*.25],[cx-R*.25,cy+R*.38],[cx-R*2.38,cy+R*.32],[cx-R*2.50,cy+R*.22]], 0.65);
        poly([[cx-R*.18,cy-R*.42],[cx+R*.18,cy-R*.42],[cx+R*.12,cy-R*2.48],[cx-R*.12,cy-R*2.48]], 0.80);
        poly([[cx-R*.20,cy-R*2.44],[cx+R*.20,cy-R*2.44],[cx+R*.14,cy-R*2.72],[cx-R*.14,cy-R*2.72]], 0.80);
        poly([[cx+R*.20,cy-R*.40],[cx+R*.32,cy-R*.40],[cx+R*.26,cy-R*2.30],[cx+R*.14,cy-R*2.30]], 0.65);
        poly([[cx-R*.18,cy+R*.42],[cx+R*.18,cy+R*.42],[cx+R*.12,cy+R*2.48],[cx-R*.12,cy+R*2.48]], 0.80);
        poly([[cx-R*.20,cy+R*2.44],[cx+R*.20,cy+R*2.44],[cx+R*.14,cy+R*2.72],[cx-R*.14,cy+R*2.72]], 0.80);
        poly([[cx+R*.20,cy+R*.40],[cx+R*.32,cy+R*.40],[cx+R*.26,cy+R*2.30],[cx+R*.14,cy+R*2.30]], 0.65);
        circ(cx,cy,R*0.50,0.50);
      } else {
        curved(() => {
          ctx.moveTo(cx-R*.36,cy-R*.22); ctx.lineTo(cx-R*.36,cy+R*.22);
          ctx.lineTo(cx-R*2.90,cy+R*.12); ctx.arc(cx-R*2.90,cy,R*.12,Math.PI*.5,-Math.PI*.5,true); ctx.lineTo(cx-R*2.90,cy-R*.12);
        }, 0.82);
        poly([[cx-R*2.90,cy-R*.18],[cx-R*2.90,cy+R*.18],[cx-R*3.12,cy+R*.14],[cx-R*3.25,cy],[cx-R*3.12,cy-R*.14]], 0.82);
        poly([[cx-R*.36,cy+R*.25],[cx-R*.25,cy+R*.38],[cx-R*2.72,cy+R*.30],[cx-R*2.82,cy+R*.20]], 0.65);
        poly([[cx+R*.35,cy-R*.20],[cx+R*.08,cy-R*.42],[cx+R*.90,cy-R*2.28],[cx+R*1.08,cy-R*2.12]], 0.80);
        poly([[cx+R*.90,cy-R*2.28],[cx+R*1.08,cy-R*2.12],[cx+R*1.22,cy-R*2.38],[cx+R*1.06,cy-R*2.55]], 0.80);
        poly([[cx+R*.24,cy-R*.12],[cx+R*.04,cy-R*.32],[cx+R*.70,cy-R*2.08],[cx+R*.84,cy-R*1.92]], 0.65);
        poly([[cx+R*.36,cy-R*.10],[cx+R*.36,cy+R*.10],[cx+R*1.18,cy+R*.07],[cx+R*1.18,cy-R*.07]], 0.68);
        poly([[cx+R*1.18,cy-R*.10],[cx+R*1.18,cy+R*.10],[cx+R*1.42,cy+R*.08],[cx+R*1.50,cy],[cx+R*1.42,cy-R*.08]], 0.72);
        poly([[cx-R*.36,cy-R*.22],[cx-R*.36,cy+R*.22],[cx-R*.58,cy+R*.20],[cx-R*.58,cy-R*.20]], 0.65);
        circ(cx,cy,R*0.50,0.50);
      }
      break;
    }

    // ── 4  CRAWLER ────────────────────────────────────────────────────────────
    case 4: {
      const v = getChassisVariant(n);
      curved(() => {
        ctx.moveTo(cx-R*.68,cy-R*1.08);
        ctx.bezierCurveTo(cx-R*1.08,cy-R*.55,cx-R*1.08,cy+R*.55,cx-R*.68,cy+R*1.08);
        ctx.bezierCurveTo(cx-R*.30,cy+R*.88,cx+R*.55,cy+R*.56,cx+R*.98,cy);
        ctx.bezierCurveTo(cx+R*.55,cy-R*.56,cx-R*.30,cy-R*.88,cx-R*.68,cy-R*1.08);
      }, v === 2 ? 0.42 : 0.35);
      for (let i = 0; i < 5; i++) {
        const t = i / 4; const angle = Math.PI*1.18 + t*Math.PI*1.64; const baseX = cx + R*0.52;
        const ox = baseX + R*1.52*Math.cos(angle); const oy = cy + R*1.52*Math.sin(angle);
        const mx = baseX + R*1.28*Math.cos(angle); const my = cy + R*1.28*Math.sin(angle);
        const px = -Math.sin(angle)*R*0.22; const py = Math.cos(angle)*R*0.22;
        poly([[mx-px*0.12,my-py*0.12],[mx+px*0.12,my+py*0.12],[ox+px*0.12,oy+py*0.12],[ox-px*0.12,oy-py*0.12]], 0.54);
      }
      if (v === 0) {
        curved(() => {
          ctx.moveTo(cx-R*.68,cy-R*1.08);
          ctx.bezierCurveTo(cx-R*1.05,cy-R*1.20,cx-R*1.60,cy-R*.88,cx-R*2.08,cy-R*1.38);
          ctx.lineTo(cx-R*1.82,cy-R*1.60);
          ctx.bezierCurveTo(cx-R*1.45,cy-R*1.08,cx-R*.98,cy-R*1.30,cx-R*.82,cy-R*1.18);
        }, 0.76);
        poly([[cx-R*2.08,cy-R*1.38],[cx-R*1.82,cy-R*1.60],[cx-R*2.30,cy-R*1.95],[cx-R*2.52,cy-R*1.75]], 0.82);
        poly([[cx-R*1.92,cy-R*1.48],[cx-R*1.82,cy-R*1.58],[cx-R*2.05,cy-R*1.78],[cx-R*2.15,cy-R*1.68]], 0.72);
        poly([[cx-R*1.65,cy-R*1.32],[cx-R*1.58,cy-R*1.42],[cx-R*1.78,cy-R*1.58],[cx-R*1.85,cy-R*1.48]], 0.62);
        curved(() => {
          ctx.moveTo(cx-R*.68,cy+R*1.08);
          ctx.bezierCurveTo(cx-R*1.00,cy+R*1.18,cx-R*1.45,cy+R*.82,cx-R*1.75,cy+R*1.18);
          ctx.lineTo(cx-R*1.52,cy+R*1.38);
          ctx.bezierCurveTo(cx-R*1.28,cy+R*.98,cx-R*.92,cy+R*1.22,cx-R*.80,cy+R*1.15);
        }, 0.68);
        poly([[cx-R*1.75,cy+R*1.18],[cx-R*1.52,cy+R*1.38],[cx-R*1.82,cy+R*1.62],[cx-R*2.00,cy+R*1.45]], 0.72);
        poly([[cx-R*1.55,cy+R*1.25],[cx-R*1.45,cy+R*1.38],[cx-R*1.62,cy+R*1.52],[cx-R*1.72,cy+R*1.40]], 0.60);
        curved(() => {
          ctx.moveTo(cx+R*1.28,cy-R*.40);
          ctx.bezierCurveTo(cx+R*1.62,cy-R*.54,cx+R*1.92,cy-R*.26,cx+R*1.92,cy-R*.06);
          ctx.bezierCurveTo(cx+R*1.92,cy+R*.14,cx+R*1.62,cy+R*.38,cx+R*1.40,cy+R*.28);
          ctx.bezierCurveTo(cx+R*1.72,cy+R*.08,cx+R*1.72,cy-R*.20,cx+R*1.42,cy-R*.32);
        }, 0.60);
        circ(cx+R*0.98,cy,R*0.12,0.60);
      } else if (v === 1) {
        curved(() => {
          ctx.moveTo(cx-R*.68,cy-R*1.08);
          ctx.bezierCurveTo(cx-R*1.02,cy-R*1.15,cx-R*1.52,cy-R*.82,cx-R*1.88,cy-R*1.18);
          ctx.lineTo(cx-R*1.65,cy-R*1.38);
          ctx.bezierCurveTo(cx-R*1.32,cy-R*.98,cx-R*.90,cy-R*1.24,cx-R*.78,cy-R*1.16);
        }, 0.74);
        poly([[cx-R*1.88,cy-R*1.18],[cx-R*1.65,cy-R*1.38],[cx-R*1.92,cy-R*1.62],[cx-R*2.12,cy-R*1.45]], 0.78);
        poly([[cx-R*1.72,cy-R*1.28],[cx-R*1.65,cy-R*1.38],[cx-R*1.85,cy-R*1.55],[cx-R*1.92,cy-R*1.46]], 0.68);
        poly([[cx-R*1.50,cy-R*1.15],[cx-R*1.42,cy-R*1.25],[cx-R*1.60,cy-R*1.40],[cx-R*1.68,cy-R*1.30]], 0.58);
        curved(() => {
          ctx.moveTo(cx-R*.68,cy+R*1.08);
          ctx.bezierCurveTo(cx-R*1.02,cy+R*1.15,cx-R*1.52,cy+R*.82,cx-R*1.88,cy+R*1.18);
          ctx.lineTo(cx-R*1.65,cy+R*1.38);
          ctx.bezierCurveTo(cx-R*1.32,cy+R*.98,cx-R*.90,cy+R*1.24,cx-R*.78,cy+R*1.16);
        }, 0.74);
        poly([[cx-R*1.88,cy+R*1.18],[cx-R*1.65,cy+R*1.38],[cx-R*1.92,cy+R*1.62],[cx-R*2.12,cy+R*1.45]], 0.78);
        poly([[cx-R*1.72,cy+R*1.28],[cx-R*1.65,cy+R*1.38],[cx-R*1.85,cy+R*1.55],[cx-R*1.92,cy+R*1.46]], 0.68);
        poly([[cx-R*1.50,cy+R*1.15],[cx-R*1.42,cy+R*1.25],[cx-R*1.60,cy+R*1.40],[cx-R*1.68,cy+R*1.30]], 0.58);
        curved(() => {
          ctx.moveTo(cx-R*.68,cy-R*1.08);
          ctx.bezierCurveTo(cx-R*.80,cy-R*1.30,cx-R*.78,cy-R*1.52,cx-R*.60,cy-R*1.56);
          ctx.bezierCurveTo(cx-R*.42,cy-R*1.48,cx-R*.40,cy-R*1.28,cx-R*.55,cy-R*1.12);
        }, 0.56);
        curved(() => {
          ctx.moveTo(cx-R*.68,cy+R*1.08);
          ctx.bezierCurveTo(cx-R*.80,cy+R*1.30,cx-R*.78,cy+R*1.52,cx-R*.60,cy+R*1.56);
          ctx.bezierCurveTo(cx-R*.42,cy+R*1.48,cx-R*.40,cy+R*1.28,cx-R*.55,cy+R*1.12);
        }, 0.56);
        curved(() => {
          ctx.moveTo(cx+R*1.28,cy-R*.35);
          ctx.bezierCurveTo(cx+R*1.58,cy-R*.48,cx+R*1.82,cy-R*.22,cx+R*1.82,cy);
          ctx.bezierCurveTo(cx+R*1.82,cy+R*.22,cx+R*1.58,cy+R*.42,cx+R*1.38,cy+R*.32);
          ctx.bezierCurveTo(cx+R*1.65,cy+R*.12,cx+R*1.65,cy-R*.15,cx+R*1.40,cy-R*.28);
        }, 0.58);
        circ(cx+R*0.98,cy-R*0.15,R*0.11,0.60); circ(cx+R*0.98,cy+R*0.15,R*0.11,0.60);
      } else {
        curved(() => {
          ctx.moveTo(cx-R*.68,cy-R*1.08);
          ctx.bezierCurveTo(cx-R*1.08,cy-R*1.22,cx-R*1.72,cy-R*.92,cx-R*2.30,cy-R*1.62);
          ctx.lineTo(cx-R*2.05,cy-R*1.88);
          ctx.bezierCurveTo(cx-R*1.58,cy-R*1.18,cx-R*1.05,cy-R*1.38,cx-R*.85,cy-R*1.22);
        }, 0.80);
        poly([[cx-R*2.30,cy-R*1.62],[cx-R*2.05,cy-R*1.88],[cx-R*2.50,cy-R*2.30],[cx-R*2.72,cy-R*2.05]], 0.82);
        poly([[cx-R*1.55,cy-R*1.12],[cx-R*1.45,cy-R*1.22],[cx-R*1.68,cy-R*1.42],[cx-R*1.78,cy-R*1.32]], 0.68);
        poly([[cx-R*1.80,cy-R*1.25],[cx-R*1.72,cy-R*1.38],[cx-R*1.98,cy-R*1.58],[cx-R*2.05,cy-R*1.45]], 0.65);
        poly([[cx-R*2.00,cy-R*1.42],[cx-R*1.92,cy-R*1.55],[cx-R*2.18,cy-R*1.75],[cx-R*2.26,cy-R*1.62]], 0.60);
        curved(() => {
          ctx.moveTo(cx-R*.68,cy+R*1.08);
          ctx.bezierCurveTo(cx-R*.98,cy+R*1.18,cx-R*1.15,cy+R*1.08,cx-R*1.05,cy+R*.90);
          ctx.bezierCurveTo(cx-R*.88,cy+R*.72,cx-R*.68,cy+R*.80,cx-R*.68,cy+R*1.08);
        }, 0.56);
        poly([[cx-R*1.05,cy+R*.90],[cx-R*.92,cy+R*.78],[cx-R*1.18,cy+R*.58],[cx-R*1.30,cy+R*.72]], 0.54);
        circ(cx+R*0.98,cy,R*0.14,0.65);
      }
      break;
    }

    // ── 5  BRUISER ────────────────────────────────────────────────────────────
    case 5: {
      const v = getChassisVariant(n);
      if (v === 0) {
        poly([[cx+R*.48,cy-R*.60],[cx+R*1.42,cy-R*.50],[cx+R*1.62,cy],[cx+R*1.42,cy+R*.50],[cx+R*.48,cy+R*.60],[cx+R*.80,cy]], 0.80);
        poly([[cx+R*1.30,cy-R*.36],[cx+R*1.90,cy-R*.22],[cx+R*2.08,cy],[cx+R*1.90,cy+R*.22],[cx+R*1.30,cy+R*.36],[cx+R*1.62,cy]], 0.72);
        poly([[cx+R*2.08,cy-R*.08],[cx+R*2.08,cy+R*.08],[cx+R*2.55,cy]], 0.80);
        poly([[cx+R*.52,cy-R*.58],[cx+R*.68,cy-R*.55],[cx+R*.58,cy-R*1.20],[cx+R*.30,cy-R*1.35],[cx+R*.15,cy-R*1.12],[cx+R*.40,cy-R*.72]], 0.70);
        poly([[cx+R*.52,cy+R*.58],[cx+R*.68,cy+R*.55],[cx+R*.58,cy+R*1.20],[cx+R*.30,cy+R*1.35],[cx+R*.15,cy+R*1.12],[cx+R*.40,cy+R*.72]], 0.70);
        poly([[cx+R*1.32,cy-R*.36],[cx+R*1.46,cy-R*.34],[cx+R*1.38,cy-R*.88],[cx+R*1.15,cy-R*.98],[cx+R*1.05,cy-R*.80],[cx+R*1.22,cy-R*.48]], 0.62);
        poly([[cx+R*1.32,cy+R*.36],[cx+R*1.46,cy+R*.34],[cx+R*1.38,cy+R*.88],[cx+R*1.15,cy+R*.98],[cx+R*1.05,cy+R*.80],[cx+R*1.22,cy+R*.48]], 0.62);
        poly([[cx-R*.60,cy-R*.62],[cx-R*.48,cy-R*.58],[cx-R*.68,cy-R*1.05],[cx-R*.92,cy-R*1.18],[cx-R*1.05,cy-R*.92],[cx-R*.78,cy-R*.75]], 0.72);
        poly([[cx-R*.60,cy+R*.62],[cx-R*.48,cy+R*.58],[cx-R*.68,cy+R*1.05],[cx-R*.92,cy+R*1.18],[cx-R*1.05,cy+R*.92],[cx-R*.78,cy+R*.75]], 0.72);
        for (let i = 0; i < 5; i++) { const sx = cx - R*0.48 + i * R*0.55; poly([[sx-R*.07,cy-R*.68],[sx+R*.07,cy-R*.68],[sx+R*.08,cy-R*.90],[sx-R*.08,cy-R*.90]], 0.65); }
        for (let i = 0; i < 4; i++) { const sx = cx - R*0.28 + i * R*0.55; poly([[sx-R*.06,cy+R*.68],[sx+R*.06,cy+R*.68],[sx+R*.07,cy+R*.88],[sx-R*.07,cy+R*.88]], 0.50); }
      } else if (v === 1) {
        poly([[cx+R*.42,cy-R*.68],[cx+R*1.58,cy-R*.60],[cx+R*2.08,cy-R*.18],[cx+R*2.12,cy],[cx+R*2.08,cy+R*.18],[cx+R*1.58,cy+R*.60],[cx+R*.42,cy+R*.68],[cx+R*.80,cy]], 0.82);
        poly([[cx+R*.55,cy-R*.65],[cx+R*1.45,cy-R*.58],[cx+R*1.62,cy-R*1.12],[cx+R*1.12,cy-R*1.38],[cx+R*.42,cy-R*1.12]], 0.70);
        poly([[cx+R*.55,cy+R*.65],[cx+R*1.45,cy+R*.58],[cx+R*1.62,cy+R*1.12],[cx+R*1.12,cy+R*1.38],[cx+R*.42,cy+R*1.12]], 0.70);
        poly([[cx+R*.62,cy-R*.75],[cx+R*1.25,cy-R*.68],[cx+R*1.40,cy-R*1.05],[cx+R*.88,cy-R*1.20],[cx+R*.50,cy-R*.95]], 0.58);
        poly([[cx+R*.62,cy+R*.75],[cx+R*1.25,cy+R*.68],[cx+R*1.40,cy+R*1.05],[cx+R*.88,cy+R*1.20],[cx+R*.50,cy+R*.95]], 0.58);
        poly([[cx-R*.58,cy-R*.62],[cx-R*.45,cy-R*.58],[cx-R*.65,cy-R*1.02],[cx-R*.88,cy-R*1.15],[cx-R*1.00,cy-R*.90],[cx-R*.75,cy-R*.72]], 0.72);
        poly([[cx-R*.58,cy+R*.62],[cx-R*.45,cy+R*.58],[cx-R*.65,cy+R*1.02],[cx-R*.88,cy+R*1.15],[cx-R*1.00,cy+R*.90],[cx-R*.75,cy+R*.72]], 0.72);
        poly([[cx-R*.10,cy-R*.65],[cx+R*.12,cy-R*.62],[cx+R*.08,cy-R*1.15],[cx-R*.12,cy-R*1.18]], 0.72);
        poly([[cx+R*.68,cy-R*.60],[cx+R*.90,cy-R*.58],[cx+R*.85,cy-R*1.02],[cx+R*.65,cy-R*1.04]], 0.65);
        poly([[cx-R*.50,cy-R*.65],[cx-R*.32,cy-R*.62],[cx-R*.36,cy-R*.88],[cx-R*.52,cy-R*.90]], 0.55);
        for (let i = 0; i < 4; i++) { const sx = cx - R*0.35 + i * R*0.58; poly([[sx-R*.07,cy-R*.65],[sx+R*.07,cy-R*.65],[sx+R*.08,cy-R*.85],[sx-R*.08,cy-R*.85]], 0.60); }
      } else {
        poly([[cx+R*.50,cy-R*.55],[cx+R*1.22,cy-R*.42],[cx+R*1.38,cy],[cx+R*1.22,cy+R*.42],[cx+R*.50,cy+R*.55],[cx+R*.80,cy]], 0.82);
        poly([[cx+R*1.18,cy-R*.30],[cx+R*1.82,cy-R*.25],[cx+R*1.98,cy],[cx+R*1.82,cy+R*.25],[cx+R*1.18,cy+R*.30],[cx+R*1.38,cy]], 0.74);
        poly([[cx+R*1.72,cy-R*.16],[cx+R*2.28,cy-R*.12],[cx+R*2.38,cy],[cx+R*2.28,cy+R*.12],[cx+R*1.72,cy+R*.16],[cx+R*1.98,cy]], 0.62);
        poly([[cx+R*2.38,cy-R*.06],[cx+R*2.38,cy+R*.06],[cx+R*2.82,cy]], 0.72);
        for (const [jx,jw] of [[cx+R*.50,R*.52],[cx+R*1.18,R*.38],[cx+R*1.72,R*.24]] as [number,number][]) {
          poly([[jx-jw*0.06,cy-jw*1.18],[jx+jw*0.08,cy-jw*1.14],[jx,cy-jw*0.70],[jx-jw*0.12,cy-jw*0.60]], 0.65);
          poly([[jx-jw*0.06,cy+jw*1.18],[jx+jw*0.08,cy+jw*1.14],[jx,cy+jw*0.70],[jx-jw*0.12,cy+jw*0.60]], 0.65);
        }
        poly([[cx-R*.60,cy-R*.50],[cx-R*.48,cy-R*.50],[cx-R*.68,cy-R*.92],[cx-R*.90,cy-R*1.02],[cx-R*1.00,cy-R*.80],[cx-R*.78,cy-R*.62]], 0.70);
        poly([[cx-R*.60,cy+R*.50],[cx-R*.48,cy+R*.50],[cx-R*.68,cy+R*.92],[cx-R*.90,cy+R*1.02],[cx-R*1.00,cy+R*.80],[cx-R*.78,cy+R*.62]], 0.70);
        for (let i = 0; i < 5; i++) { const sx = cx - R*0.48 + i * R*0.50; poly([[sx-R*.06,cy-R*.52],[sx+R*.06,cy-R*.52],[sx+R*.07,cy-R*.72],[sx-R*.07,cy-R*.72]], 0.60); }
      }
      break;
    }

    // ── 6  SPECTER ────────────────────────────────────────────────────────────
    case 6: {
      const v = getChassisVariant(n);
      if (v === 0) {
        poly([[cx-R*.50,cy-R*.14],[cx-R*.50,cy+R*.14],[cx-R*2.58,cy+R*.14],[cx-R*2.75,cy],[cx-R*2.58,cy-R*.14]], 0.84);
        poly([[cx-R*2.58,cy-R*.14],[cx-R*2.58,cy+R*.14],[cx-R*2.88,cy+R*.08],[cx-R*3.05,cy],[cx-R*2.88,cy-R*.08]], 0.82);
        poly([[cx-R*1.52,cy-R*.10],[cx-R*1.52,cy+R*.08],[cx-R*2.08,cy-R*.62],[cx-R*1.90,cy-R*.78]], 0.72);
        poly([[cx-R*2.08,cy-R*.62],[cx-R*1.90,cy-R*.78],[cx-R*2.30,cy-R*1.10],[cx-R*2.45,cy-R*.96]], 0.60);
        poly([[cx-R*2.30,cy-R*1.10],[cx-R*2.20,cy-R*1.22],[cx-R*2.52,cy-R*1.42],[cx-R*2.60,cy-R*1.32]], 0.50);
        poly([[cx+R*.30,cy-R*.24],[cx+R*.05,cy-R*.50],[cx+R*1.68,cy-R*1.98],[cx+R*1.82,cy-R*1.82]], 0.82);
        poly([[cx+R*.88,cy-R*.84],[cx+R*.62,cy-R*1.08],[cx+R*1.20,cy-R*1.68],[cx+R*1.42,cy-R*1.44]], 0.68);
        poly([[cx+R*1.68,cy-R*1.98],[cx+R*1.82,cy-R*1.82],[cx+R*2.00,cy-R*2.18],[cx+R*1.86,cy-R*2.34]], 0.78);
        poly([[cx-R*.14,cy+R*.52],[cx+R*.14,cy+R*.52],[cx+R*.10,cy+R*2.25],[cx-R*.10,cy+R*2.25]], 0.82);
        poly([[cx-R*.12,cy+R*1.28],[cx+R*.10,cy+R*1.22],[cx+R*.36,cy+R*1.72],[cx+R*.12,cy+R*1.78]], 0.68);
        poly([[cx-R*.12,cy+R*2.20],[cx+R*.12,cy+R*2.20],[cx+R*.08,cy+R*2.58],[cx-R*.08,cy+R*2.58]], 0.78);
        circ(cx,cy,R*0.58,0.45);
      } else if (v === 1) {
        poly([[cx-R*.50,cy-R*.14],[cx-R*.50,cy+R*.14],[cx-R*1.88,cy+R*.14],[cx-R*1.88,cy-R*.14]], 0.84);
        poly([[cx-R*1.88,cy-R*.12],[cx-R*1.88,cy+R*.06],[cx-R*2.78,cy-R*.72],[cx-R*2.62,cy-R*.88]], 0.78);
        poly([[cx-R*2.38,cy-R*.38],[cx-R*2.28,cy-R*.52],[cx-R*2.75,cy-R*.92],[cx-R*2.85,cy-R*.80]], 0.62);
        poly([[cx-R*2.78,cy-R*.72],[cx-R*2.62,cy-R*.88],[cx-R*2.95,cy-R*1.05],[cx-R*3.08,cy-R*.90]], 0.74);
        poly([[cx-R*1.88,cy-R*.06],[cx-R*1.88,cy+R*.12],[cx-R*2.78,cy+R*.72],[cx-R*2.62,cy+R*.88]], 0.78);
        poly([[cx-R*2.38,cy+R*.38],[cx-R*2.28,cy+R*.52],[cx-R*2.75,cy+R*.92],[cx-R*2.85,cy+R*.80]], 0.62);
        poly([[cx-R*2.78,cy+R*.72],[cx-R*2.62,cy+R*.88],[cx-R*2.95,cy+R*1.05],[cx-R*3.08,cy+R*.90]], 0.74);
        poly([[cx+R*.28,cy-R*.22],[cx+R*.05,cy-R*.50],[cx+R*.92,cy-R*1.42],[cx+R*1.08,cy-R*1.28]], 0.75);
        poly([[cx+R*.55,cy-R*.75],[cx+R*.35,cy-R*1.00],[cx+R*.80,cy-R*1.38],[cx+R*.98,cy-R*1.15]], 0.62);
        poly([[cx+R*.50,cy+R*.14],[cx+R*.50,cy-R*.14],[cx+R*1.30,cy-R*.10],[cx+R*1.30,cy+R*.10]], 0.68);
        poly([[cx+R*1.30,cy-R*.10],[cx+R*1.30,cy+R*.10],[cx+R*1.62,cy+R*.55],[cx+R*1.44,cy+R*.68]], 0.60);
        circ(cx,cy,R*0.58,0.45);
      } else {
        poly([[cx-R*.50,cy-R*.14],[cx-R*.50,cy+R*.14],[cx-R*2.58,cy+R*.14],[cx-R*2.75,cy],[cx-R*2.58,cy-R*.14]], 0.84);
        poly([[cx-R*2.58,cy-R*.14],[cx-R*2.58,cy+R*.14],[cx-R*2.88,cy+R*.08],[cx-R*3.05,cy],[cx-R*2.88,cy-R*.08]], 0.80);
        poly([[cx-R*1.48,cy-R*.10],[cx-R*1.48,cy+R*.08],[cx-R*1.92,cy-R*.52],[cx-R*1.78,cy-R*.68]], 0.68);
        poly([[cx-R*1.00,cy-R*.10],[cx-R*1.00,cy+R*.08],[cx-R*1.38,cy-R*.40],[cx-R*1.25,cy-R*.55]], 0.60);
        poly([[cx-R*.14,cy-R*.52],[cx+R*.14,cy-R*.52],[cx+R*.10,cy-R*2.18],[cx-R*.10,cy-R*2.18]], 0.82);
        poly([[cx-R*.12,cy-R*2.14],[cx+R*.12,cy-R*2.14],[cx+R*.08,cy-R*2.52],[cx-R*.08,cy-R*2.52]], 0.78);
        poly([[cx+R*.16,cy-R*1.02],[cx+R*.28,cy-R*.98],[cx+R*.50,cy-R*1.52],[cx+R*.36,cy-R*1.58]], 0.65);
        poly([[cx+R*.50,cy-R*.13],[cx+R*.50,cy+R*.13],[cx+R*1.28,cy+R*.10],[cx+R*1.28,cy-R*.10]], 0.72);
        poly([[cx+R*1.28,cy-R*.10],[cx+R*1.28,cy+R*.10],[cx+R*1.55,cy+R*.06],[cx+R*1.65,cy],[cx+R*1.55,cy-R*.06]], 0.70);
        poly([[cx-R*.13,cy+R*.52],[cx+R*.13,cy+R*.52],[cx+R*.09,cy+R*1.85],[cx-R*.09,cy+R*1.85]], 0.80);
        poly([[cx-R*.11,cy+R*1.80],[cx+R*.11,cy+R*1.80],[cx+R*.07,cy+R*2.18],[cx-R*.07,cy+R*2.18]], 0.75);
        poly([[cx-R*.28,cy+R*1.02],[cx-R*.12,cy+R*.98],[cx-R*.20,cy+R*1.50],[cx-R*.36,cy+R*1.55]], 0.62);
        circ(cx,cy,R*0.58,0.45);
      }
      break;
    }

    // ── 7  STALKER ────────────────────────────────────────────────────────────
    default: {
      const v = getChassisVariant(n);
      if (v === 0) {
        poly([[cx-R*1.15,cy-R*.30],[cx-R*1.15,cy+R*.30],[cx-R*1.48,cy+R*.48],[cx-R*2.02,cy+R*.18],[cx-R*2.15,cy],[cx-R*2.02,cy-R*.18],[cx-R*1.48,cy-R*.48]], 0.80);
        for (let i = 0; i < 5; i++) { const ty = cy - R*0.16 + i*R*0.08; poly([[cx-R*1.96,ty-R*.04],[cx-R*1.85,ty-R*.04],[cx-R*1.90,ty+R*.11]], 0.72); }
        poly([[cx-R*.92,cy-R*.30],[cx-R*.68,cy-R*.30],[cx-R*.75,cy-R*1.48],[cx-R*.85,cy-R*1.48]], 0.76);
        poly([[cx-R*.94,cy-R*.28],[cx-R*.66,cy-R*.28],[cx-R*.66,cy-R*.44],[cx-R*.94,cy-R*.44]], 0.65);
        poly([[cx-R*.02,cy-R*.29],[cx+R*.18,cy-R*.28],[cx+R*.12,cy-R*1.08],[cx-R*.02,cy-R*1.08]], 0.68);
        poly([[cx-R*.04,cy-R*.28],[cx+R*.20,cy-R*.28],[cx+R*.20,cy-R*.44],[cx-R*.04,cy-R*.44]], 0.60);
        poly([[cx+R*.76,cy-R*.24],[cx+R*.96,cy-R*.22],[cx+R*.88,cy-R*.82],[cx+R*.78,cy-R*.82]], 0.60);
        poly([[cx+R*1.35,cy-R*.18],[cx+R*1.52,cy],[cx+R*1.88,cy-R*.72],[cx+R*1.62,cy-R*.95],[cx+R*1.28,cy-R*.62]], 0.72);
        poly([[cx+R*1.35,cy+R*.18],[cx+R*1.52,cy],[cx+R*1.88,cy+R*.72],[cx+R*1.62,cy+R*.95],[cx+R*1.28,cy+R*.62]], 0.72);
        poly([[cx-R*.88,cy+R*.30],[cx-R*.68,cy+R*.30],[cx-R*.75,cy+R*.95],[cx-R*.88,cy+R*.95]], 0.60);
        poly([[cx-R*.02,cy+R*.28],[cx+R*.18,cy+R*.28],[cx+R*.12,cy+R*.80],[cx-R*.02,cy+R*.80]], 0.54);
        poly([[cx+R*.76,cy+R*.24],[cx+R*.96,cy+R*.22],[cx+R*.88,cy+R*.62],[cx+R*.78,cy+R*.62]], 0.46);
        poly([[cx+R*.22,cy-R*.28],[cx+R*.48,cy-R*.28],[cx+R*.56,cy-R*.56],[cx+R*.40,cy-R*.70],[cx+R*.16,cy-R*.56]], 0.62);
        poly([[cx+R*.22,cy+R*.28],[cx+R*.48,cy+R*.28],[cx+R*.56,cy+R*.56],[cx+R*.40,cy+R*.70],[cx+R*.16,cy+R*.56]], 0.60);
        poly([[cx-R*2.08,cy-R*.08],[cx-R*2.16,cy-R*.04],[cx-R*2.75,cy-R*.22],[cx-R*2.70,cy-R*.30]], 0.54);
        poly([[cx-R*2.08,cy+R*.08],[cx-R*2.16,cy+R*.04],[cx-R*2.75,cy+R*.22],[cx-R*2.70,cy+R*.30]], 0.54);
      } else if (v === 1) {
        poly([[cx-R*1.15,cy-R*.30],[cx-R*1.15,cy+R*.30],[cx-R*1.55,cy+R*.52],[cx-R*2.18,cy+R*.20],[cx-R*2.35,cy],[cx-R*2.18,cy-R*.20],[cx-R*1.55,cy-R*.52]], 0.82);
        for (let i = 0; i < 6; i++) { const ty = cy - R*0.22 + i*R*0.09; poly([[cx-R*2.08,ty-R*.04],[cx-R*1.95,ty-R*.04],[cx-R*2.01,ty+R*.12]], 0.74); }
        poly([[cx-R*.82,cy-R*.30],[cx-R*.52,cy-R*.30],[cx-R*.62,cy-R*1.72],[cx-R*.75,cy-R*1.72]], 0.78);
        poly([[cx-R*.84,cy-R*.28],[cx-R*.50,cy-R*.28],[cx-R*.50,cy-R*.44],[cx-R*.84,cy-R*.44]], 0.65);
        poly([[cx+R*.12,cy-R*.28],[cx+R*.40,cy-R*.28],[cx+R*.28,cy-R*1.28],[cx+R*.10,cy-R*1.28]], 0.68);
        poly([[cx+R*.10,cy-R*.28],[cx+R*.42,cy-R*.28],[cx+R*.42,cy-R*.44],[cx+R*.10,cy-R*.44]], 0.60);
        poly([[cx-R*.80,cy+R*.30],[cx-R*.55,cy+R*.30],[cx-R*.62,cy+R*1.05],[cx-R*.78,cy+R*1.05]], 0.62);
        poly([[cx+R*.12,cy+R*.28],[cx+R*.40,cy+R*.28],[cx+R*.28,cy+R*.88],[cx+R*.10,cy+R*.88]], 0.55);
        poly([[cx+R*1.35,cy-R*.18],[cx+R*1.52,cy],[cx+R*1.98,cy-R*.80],[cx+R*1.70,cy-R*1.00],[cx+R*1.28,cy-R*.65]], 0.76);
        poly([[cx+R*.25,cy-R*.28],[cx+R*.52,cy-R*.28],[cx+R*.60,cy-R*.58],[cx+R*.42,cy-R*.72],[cx+R*.18,cy-R*.58]], 0.64);
        poly([[cx+R*.25,cy+R*.28],[cx+R*.52,cy+R*.28],[cx+R*.60,cy+R*.58],[cx+R*.42,cy+R*.72],[cx+R*.18,cy+R*.58]], 0.62);
        poly([[cx-R*2.20,cy-R*.10],[cx-R*2.28,cy-R*.05],[cx-R*2.88,cy-R*.24],[cx-R*2.84,cy-R*.33]], 0.55);
        poly([[cx-R*2.20,cy+R*.10],[cx-R*2.28,cy+R*.05],[cx-R*2.88,cy+R*.24],[cx-R*2.84,cy+R*.33]], 0.55);
        poly([[cx-R*2.18,cy-R*.02],[cx-R*2.28,cy+R*.02],[cx-R*2.95,cy-R*.02],[cx-R*2.95,cy+R*.06]], 0.45);
      } else {
        poly([[cx-R*1.05,cy-R*.29],[cx-R*.88,cy-R*.29],[cx-R*.92,cy-R*.68],[cx-R*1.00,cy-R*.68]], 0.55);
        poly([[cx-R*.50,cy-R*.29],[cx-R*.28,cy-R*.28],[cx-R*.35,cy-R*.98],[cx-R*.50,cy-R*.98]], 0.64);
        poly([[cx+R*.02,cy-R*.28],[cx+R*.25,cy-R*.28],[cx+R*.15,cy-R*1.25],[cx-R*.02,cy-R*1.25]], 0.72);
        poly([[cx+R*.72,cy-R*.24],[cx+R*.98,cy-R*.24],[cx+R*.88,cy-R*1.62],[cx+R*.75,cy-R*1.62]], 0.82);
        poly([[cx-R*1.05,cy-R*.28],[cx-R*.88,cy-R*.28],[cx-R*.88,cy-R*.42],[cx-R*1.05,cy-R*.42]], 0.50);
        poly([[cx-R*.52,cy-R*.28],[cx-R*.26,cy-R*.28],[cx-R*.26,cy-R*.43],[cx-R*.52,cy-R*.43]], 0.58);
        poly([[cx,cy-R*.28],[cx+R*.27,cy-R*.28],[cx+R*.27,cy-R*.45],[cx,cy-R*.45]], 0.65);
        poly([[cx+R*.70,cy-R*.24],[cx+R*1.00,cy-R*.24],[cx+R*1.00,cy-R*.41],[cx+R*.70,cy-R*.41]], 0.75);
        poly([[cx-R*1.05,cy+R*.29],[cx-R*.88,cy+R*.29],[cx-R*.92,cy+R*.52],[cx-R*1.00,cy+R*.52]], 0.45);
        poly([[cx-R*.50,cy+R*.29],[cx-R*.28,cy+R*.28],[cx-R*.35,cy+R*.72],[cx-R*.50,cy+R*.72]], 0.52);
        poly([[cx+R*.02,cy+R*.28],[cx+R*.25,cy+R*.28],[cx+R*.15,cy+R*.88],[cx-R*.02,cy+R*.88]], 0.60);
        poly([[cx+R*.72,cy+R*.24],[cx+R*.98,cy+R*.24],[cx+R*.88,cy+R*1.12],[cx+R*.75,cy+R*1.12]], 0.68);
        poly([[cx+R*1.35,cy-R*.18],[cx+R*1.52,cy],[cx+R*1.88,cy-R*.62],[cx+R*1.62,cy-R*.82],[cx+R*1.25,cy-R*.58]], 0.72);
        poly([[cx+R*1.35,cy+R*.18],[cx+R*1.52,cy],[cx+R*1.88,cy+R*.62],[cx+R*1.62,cy+R*.82],[cx+R*1.25,cy+R*.58]], 0.60);
        poly([[cx+R*1.38,cy-R*.10],[cx+R*1.38,cy+R*.10],[cx+R*1.72,cy+R*.08],[cx+R*1.72,cy-R*.08]], 0.55);
        poly([[cx+R*.30,cy-R*.26],[cx+R*.52,cy-R*.26],[cx+R*.60,cy-R*.52],[cx+R*.42,cy-R*.62],[cx+R*.22,cy-R*.50]], 0.60);
        poly([[cx+R*.30,cy+R*.26],[cx+R*.52,cy+R*.26],[cx+R*.60,cy+R*.52],[cx+R*.42,cy+R*.62],[cx+R*.22,cy+R*.50]], 0.58);
      }
      break;
    }
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7c  Tertiary surface detail overlays
// ═══════════════════════════════════════════════════════════════════════════════

function drawChassisTertiary(
  ctx:   CanvasRenderingContext2D,
  cx: number, cy: number,
  n:     number, R: number,
  flash: boolean,
): void {
  const chassis = getChassisType(n);
  ctx.save();
  ctx.globalAlpha = flash ? 0.50 : 0.18;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth   = 0.65;
  ctx.shadowBlur  = 0;

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  };
  const ring = (x: number, y: number, r: number) => {
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
  };

  switch (chassis) {
    case 0: {
      for (let i = 0; i < 3; i++) {
        const sf = 0.35 + i*0.35;
        line(cx-R*0.18, cy-R*sf*0.30, cx+R*0.30*sf, cy-R*2.05*sf);
        line(cx-R*0.18, cy+R*sf*0.30, cx+R*0.30*sf, cy+R*2.05*sf);
      }
      line(cx-R*0.50, cy, cx+R*1.05, cy);
      ctx.beginPath(); ctx.ellipse(cx+R*0.28, cy-R*0.72, R*0.11, R*0.20, 0, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx+R*0.28, cy+R*0.72, R*0.11, R*0.20, 0, 0, Math.PI*2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const t = i/3; line(cx+R*(0.10+t*0.28), cy-R*(3.00-t*0.28), cx+R*(0.20+t*0.28), cy-R*(2.93-t*0.28)); }
      break;
    }
    case 1: {
      for (let i = 0; i < 3; i++) {
        const t = 0.22 + i*0.24;
        const sx = cx - R*0.82 + R*t*1.72; const sy = cy - R*0.24 - R*t*1.30;
        ctx.beginPath(); ctx.arc(sx, sy+R*0.32, R*0.34, Math.PI*1.18, Math.PI*1.82); ctx.stroke();
      }
      ring(cx-R*1.28, cy-R*1.30, R*0.13); ring(cx-R*1.28, cy-R*1.30, R*0.06);
      ctx.setLineDash([R*0.12, R*0.08]); line(cx-R*1.08, cy, cx+R*0.90, cy); ctx.setLineDash([]);
      break;
    }
    case 2: {
      ctx.strokeRect(cx+R*0.26, cy-R*0.29, R*0.32, R*0.22);
      ctx.strokeRect(cx+R*0.28, cy-R*0.61, R*0.28, R*0.18);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2 - Math.PI/6;
        i === 0 ? ctx.moveTo(cx+R*0.52*Math.cos(a), cy+R*0.52*Math.sin(a)) : ctx.lineTo(cx+R*0.52*Math.cos(a), cy+R*0.52*Math.sin(a));
      }
      ctx.closePath(); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = (i/6)*Math.PI*2 - Math.PI/6; ring(cx+R*0.82*Math.cos(a), cy+R*0.82*Math.sin(a), R*0.05); }
      line(cx-R*0.85, cy-R*0.14, cx-R*2.12, cy-R*0.26); line(cx-R*0.85, cy+R*0.14, cx-R*2.12, cy+R*0.26);
      break;
    }
    case 3: {
      ring(cx, cy, R*0.28); ring(cx, cy, R*0.50);
      const bx = cx - R*1.65;
      line(bx, cy-R*0.12, bx, cy+R*0.12); line(bx-R*0.14, cy, bx+R*0.14, cy); ring(bx, cy, R*0.10);
      for (let i = 0; i < 3; i++) { const rx = cx - R*(0.78 + i*0.54); line(rx, cy-R*0.20, rx, cy+R*0.20); }
      break;
    }
    case 4: {
      ctx.beginPath(); ctx.arc(cx+R*0.52, cy, R*1.10, Math.PI*0.62, Math.PI*1.38); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx+R*0.52, cy, R*1.45, Math.PI*0.68, Math.PI*1.32); ctx.stroke();
      ring(cx-R*0.68, cy-R*1.08, R*0.14); ring(cx-R*0.68, cy-R*1.08, R*0.07); ring(cx+R*0.98, cy, R*0.11);
      for (let i = 0; i < 7; i++) {
        const t = i/6; const angle = Math.PI*1.18 + t*Math.PI*1.64; const baseX = cx + R*0.52;
        const mx = baseX + R*1.36*Math.cos(angle); const my = cy + R*1.36*Math.sin(angle);
        line(mx, my, mx-Math.cos(angle)*R*0.12, my-Math.sin(angle)*R*0.12);
      }
      break;
    }
    case 5: {
      line(cx+R*0.48, cy-R*0.62, cx+R*0.48, cy+R*0.62);
      line(cx+R*1.30, cy-R*0.38, cx+R*1.30, cy+R*0.38);
      line(cx+R*1.90, cy-R*0.22, cx+R*1.90, cy+R*0.22);
      ring(cx+R*0.65, cy, R*0.18); ring(cx+R*1.50, cy, R*0.13); ring(cx+R*2.05, cy, R*0.09);
      line(cx-R*0.65, cy-R*0.72, cx+R*2.08, cy); line(cx-R*0.65, cy+R*0.72, cx+R*2.08, cy);
      ring(cx-R*0.92, cy-R*0.35, R*0.05); ring(cx-R*0.92, cy, R*0.05); ring(cx-R*0.92, cy+R*0.35, R*0.05);
      break;
    }
    case 6: {
      ctx.beginPath();
      ctx.moveTo(cx, cy-R*0.34); ctx.lineTo(cx+R*0.30, cy); ctx.lineTo(cx, cy+R*0.34); ctx.lineTo(cx-R*0.30, cy);
      ctx.closePath(); ctx.stroke();
      for (let i = 1; i <= 3; i++) { const fx = cx - R*i*0.55; line(fx, cy-R*0.08, fx-R*0.14, cy-R*0.24); line(fx, cy+R*0.08, fx-R*0.14, cy+R*0.24); }
      ring(cx, cy, R*0.68);
      break;
    }
    default: {
      ctx.setLineDash([R*0.14, R*0.09]); line(cx-R*1.15, cy, cx+R*1.52, cy); ctx.setLineDash([]);
      ring(cx-R*0.85, cy, R*0.08); ring(cx-R*0.20, cy, R*0.08); ring(cx+R*0.45, cy, R*0.08); ring(cx+R*1.10, cy, R*0.08);
      for (let i = 0; i < 6; i++) { const tx = cx - R*1.05 + i*R*0.40; line(tx, cy-R*0.30, tx+R*0.05, cy-R*0.42); }
      line(cx-R*2.05, cy, cx-R*2.72, cy-R*0.18); line(cx-R*2.05, cy, cx-R*2.65, cy+R*0.18);
      break;
    }
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  Archetype overlay renderers
// ═══════════════════════════════════════════════════════════════════════════════

type OverlayFn = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  R: number, lobes: number, spikes: boolean[],
  profile: VirusModelProfile, alpha: number,
) => void;

const overlayBiological: OverlayFn = (ctx, cx, cy, R, lobes, spikes, _p, alpha) => {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.55})`;
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.arc(cx + R*0.62*Math.cos(angle), cy + R*0.62*Math.sin(angle), R*0.09, 0, Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.30})`; ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    if (!spikes[i]) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath(); ctx.arc(cx + R*0.55*Math.cos(angle), cy + R*0.55*Math.sin(angle), R*0.07, 0, Math.PI*2); ctx.stroke();
    }
  }
  ctx.beginPath(); ctx.arc(cx, cy, R*0.38, 0, Math.PI*2);
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.25})`; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
};

const overlayHumanoid: OverlayFn = (ctx, cx, cy, R, _l, _s, p, alpha) => {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.80})`;
  ctx.beginPath(); ctx.arc(cx - R*0.18, cy - R*0.30, R*0.08, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + R*0.18, cy - R*0.30, R*0.08, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy - R*0.28, R*0.32, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.20 * p.symmetryLevel})`;
  ctx.beginPath(); ctx.moveTo(cx, cy - R*0.7); ctx.lineTo(cx, cy + R*0.7); ctx.stroke();
  ctx.restore();
};

const overlayAnimal: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.50})`; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx-R*0.40,cy-R*0.55); ctx.lineTo(cx-R*0.55,cy-R*0.90); ctx.lineTo(cx-R*0.20,cy-R*0.60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+R*0.40,cy-R*0.55); ctx.lineTo(cx+R*0.55,cy-R*0.90); ctx.lineTo(cx+R*0.20,cy-R*0.60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy+R*0.80); ctx.quadraticCurveTo(cx+R*0.55,cy+R*1.10,cx+R*0.40,cy+R*1.40);
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
};

const overlayInsectoid: OverlayFn = (ctx, cx, cy, R, _l, spikes, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`; ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    if (spikes[i]) {
      const angle = (i/8)*Math.PI*2 - Math.PI/2;
      const x0 = cx+R*0.90*Math.cos(angle); const y0 = cy+R*0.90*Math.sin(angle);
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(cx+R*1.35*Math.cos(angle-0.15),cy+R*1.35*Math.sin(angle-0.15)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(cx+R*1.35*Math.cos(angle+0.15),cy+R*1.35*Math.sin(angle+0.15)); ctx.stroke();
    }
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.28})`; ctx.lineWidth = 0.8;
  ctx.setLineDash([3,3]); ctx.beginPath(); ctx.arc(cx,cy,R*0.55,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
};

const overlayMechanical: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.45})`; ctx.lineWidth = 1.5;
  for (let i = 0; i < lobes; i++) {
    const angle = (i/lobes)*Math.PI*2 - Math.PI/2;
    const r0=R*0.82; const r1=R*1.05;
    ctx.beginPath();
    ctx.moveTo(cx+r0*Math.cos(angle-0.12),cy+r0*Math.sin(angle-0.12));
    ctx.lineTo(cx+r1*Math.cos(angle-0.12),cy+r1*Math.sin(angle-0.12));
    ctx.lineTo(cx+r1*Math.cos(angle+0.12),cy+r1*Math.sin(angle+0.12));
    ctx.lineTo(cx+r0*Math.cos(angle+0.12),cy+r0*Math.sin(angle+0.12));
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.18*p.mechanicalLevel})`; ctx.lineWidth = 0.7;
  for (let d = -R; d <= R; d += R*0.30) {
    ctx.beginPath(); ctx.moveTo(cx+d,cy-R); ctx.lineTo(cx+d,cy+R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-R,cy+d); ctx.lineTo(cx+R,cy+d); ctx.stroke();
  }
  ctx.restore();
};

const overlayArmored: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.55})`; ctx.lineWidth = R*0.12*(0.5+p.armorLevel*0.5);
  ctx.beginPath(); ctx.arc(cx,cy,R*0.92,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.30})`; ctx.lineWidth = 1;
  for (let i = 0; i < lobes; i++) {
    const angle = ((i+0.5)/lobes)*Math.PI*2 - Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx+R*0.40*Math.cos(angle),cy+R*0.40*Math.sin(angle)); ctx.lineTo(cx+R*0.88*Math.cos(angle),cy+R*0.88*Math.sin(angle)); ctx.stroke();
  }
  ctx.restore();
};

const overlayChystalline: OverlayFn = (ctx, cx, cy, R, lobes, spikes, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.50})`; ctx.lineWidth = 0.9;
  const sides = lobes + 2;
  const pts: [number,number][] = [];
  for (let i = 0; i < sides; i++) { const a=(i/sides)*Math.PI*2-Math.PI/2; pts.push([cx+R*0.82*Math.cos(a),cy+R*0.82*Math.sin(a)]); }
  ctx.beginPath(); pts.forEach(([px,py],i)=>i===0?ctx.moveTo(px,py):ctx.lineTo(px,py)); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.22})`;
  for (let i = 0; i < Math.floor(sides/2); i++) {
    ctx.beginPath(); ctx.moveTo(pts[i][0],pts[i][1]); ctx.lineTo(pts[(i+Math.floor(sides/2))%sides][0],pts[(i+Math.floor(sides/2))%sides][1]); ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,255,255,${alpha*0.70})`;
  for (let i = 0; i < 8; i++) {
    if (spikes[i]) { const a=(i/8)*Math.PI*2-Math.PI/2; ctx.beginPath(); ctx.arc(cx+R*1.20*Math.cos(a),cy+R*1.20*Math.sin(a),R*0.05,0,Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
};

const overlayMineral: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha*0.28})`;
  for (let i = 0; i < 12; i++) {
    const a=normalizedHash(i,31)*Math.PI*2; const d=normalizedHash(i,37)*R*0.70; const dr=R*0.05+normalizedHash(i,41)*R*0.04;
    ctx.beginPath(); ctx.arc(cx+d*Math.cos(a),cy+d*Math.sin(a),dr,0,Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.30})`; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) { const a=(i/8)*Math.PI*2-Math.PI/2; i===0?ctx.moveTo(cx+R*0.45*Math.cos(a),cy+R*0.45*Math.sin(a)):ctx.lineTo(cx+R*0.45*Math.cos(a),cy+R*0.45*Math.sin(a)); }
  ctx.stroke();
  ctx.restore();
};

const overlayPlant: OverlayFn = (ctx, cx, cy, R, lobes, _s, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.45})`; ctx.lineWidth = 1;
  for (let i = 0; i < lobes; i++) {
    const a=(i/lobes)*Math.PI*2-Math.PI/2; const px=cx+R*0.70*Math.cos(a); const py=cy+R*0.70*Math.sin(a);
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.bezierCurveTo(cx+R*1.10*Math.cos(a-0.35),cy+R*1.10*Math.sin(a-0.35),cx+R*1.10*Math.cos(a+0.35),cy+R*1.10*Math.sin(a+0.35),px,py); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.28})`;
  ctx.beginPath(); ctx.moveTo(cx,cy+R*0.85); ctx.quadraticCurveTo(cx+R*0.50,cy+R*1.20,cx+R*0.25,cy+R*1.50); ctx.stroke();
  ctx.restore();
};

const overlaySynthetic: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.50})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx,cy,R*0.35,0,Math.PI*2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a=(i/12)*Math.PI*2-Math.PI/2; const r0=R*(i%3===0?0.75:0.80); const r1=R*0.90;
    ctx.strokeStyle = `rgba(255,255,255,${alpha*(i%3===0?0.55:0.25)})`; ctx.lineWidth = i%3===0?1.2:0.7;
    ctx.beginPath(); ctx.moveTo(cx+r0*Math.cos(a),cy+r0*Math.sin(a)); ctx.lineTo(cx+r1*Math.cos(a),cy+r1*Math.sin(a)); ctx.stroke();
  }
  ctx.restore();
};

const overlayRobotic: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.60})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx,cy,R*0.22,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${alpha*0.20})`; ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.30*p.mechanicalLevel})`; ctx.lineWidth = 0.8;
  for (let i = 0; i < lobes; i++) {
    const a=(i/lobes)*Math.PI*2-Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx+R*0.22*Math.cos(a),cy+R*0.22*Math.sin(a)); ctx.lineTo(cx+R*0.80*Math.cos(a),cy+R*0.80*Math.sin(a)); ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,255,255,${alpha*0.60})`;
  for (let i = 0; i < 3; i++) { const a=(i/3)*Math.PI*2-Math.PI/2; ctx.beginPath(); ctx.arc(cx+R*0.55*Math.cos(a),cy+R*0.55*Math.sin(a),R*0.05,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
};

const overlayAmorphous: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  ctx.globalAlpha = alpha*0.25; ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.beginPath(); ctx.ellipse(cx+R*0.20,cy+R*0.15,R*0.75,R*0.60,0.4,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.20})`; ctx.lineWidth = 1;
  ctx.setLineDash([2,4]); ctx.beginPath(); ctx.arc(cx,cy,R*0.50,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
};

const overlayGeometric: OverlayFn = (ctx, cx, cy, R, lobes, _s, _p, alpha) => {
  ctx.save();
  const sides = Math.max(3,lobes);
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.55})`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) { const a=(i/sides)*Math.PI*2-Math.PI/2; i===0?ctx.moveTo(cx+R*0.88*Math.cos(a),cy+R*0.88*Math.sin(a)):ctx.lineTo(cx+R*0.88*Math.cos(a),cy+R*0.88*Math.sin(a)); }
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.28})`;
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) { const a=(i/sides)*Math.PI*2-Math.PI/2+Math.PI/sides; i===0?ctx.moveTo(cx+R*0.48*Math.cos(a),cy+R*0.48*Math.sin(a)):ctx.lineTo(cx+R*0.48*Math.cos(a),cy+R*0.48*Math.sin(a)); }
  ctx.stroke();
  ctx.restore();
};

const overlayEnergy: OverlayFn = (ctx, cx, cy, R, lobes, _s, p, alpha) => {
  ctx.save();
  const rayCount = lobes * 2;
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.35*p.energyLevel})`; ctx.lineWidth = 0.8;
  for (let i = 0; i < rayCount; i++) {
    const a=(i/rayCount)*Math.PI*2-Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx+R*0.30*Math.cos(a),cy+R*0.30*Math.sin(a)); ctx.lineTo(cx+R*(0.80+normalizedHash(i,17)*0.40)*Math.cos(a),cy+R*(0.80+normalizedHash(i,17)*0.40)*Math.sin(a)); ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,255,255,${alpha*0.70})`; ctx.beginPath(); ctx.arc(cx,cy,R*0.18,0,Math.PI*2); ctx.fill();
  ctx.restore();
};

const overlayCybernetic: OverlayFn = (ctx, cx, cy, R, _l, spikes, _p, alpha) => {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.45})`; ctx.lineWidth = 0.8;
  const routes = [
    [[-R*0.15,-R*0.15],[-R*0.15,-R*0.55],[-R*0.45,-R*0.55]],
    [[R*0.15,-R*0.15],[R*0.15,-R*0.40],[R*0.50,-R*0.40]],
    [[0,R*0.20],[0,R*0.55],[-R*0.30,R*0.55]],
  ];
  for (const route of routes) {
    ctx.beginPath(); route.forEach(([dx,dy],i)=>i===0?ctx.moveTo(cx+dx,cy+dy):ctx.lineTo(cx+dx,cy+dy)); ctx.stroke();
    const [ex,ey]=route[route.length-1]; const ps=R*0.07; ctx.strokeRect(cx+ex-ps,cy+ey-ps,ps*2,ps*2);
  }
  ctx.fillStyle = `rgba(255,255,255,${alpha*0.50})`;
  for (let i = 0; i < 8; i++) { if (spikes[i]) { const a=(i/8)*Math.PI*2-Math.PI/2; ctx.beginPath(); ctx.arc(cx+R*0.62*Math.cos(a),cy+R*0.62*Math.sin(a),R*0.05,0,Math.PI*2); ctx.fill(); } }
  ctx.restore();
};

const overlaySkeleetal: OverlayFn = (ctx, cx, cy, R, lobes, _s, _p, alpha) => {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha*0.45})`; ctx.beginPath(); ctx.arc(cx,cy,R*0.28,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.40})`; ctx.lineWidth = 1;
  const ribCount = Math.min(lobes,6);
  for (let i = 0; i < ribCount; i++) {
    const startA=((i-0.35)/ribCount)*Math.PI*2-Math.PI/2; const endA=((i+0.35)/ribCount)*Math.PI*2-Math.PI/2;
    ctx.beginPath(); ctx.arc(cx,cy,R*0.55,startA,endA); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,R*0.72,startA,endA); ctx.stroke();
  }
  ctx.restore();
};

const overlayFluid: OverlayFn = (ctx, cx, cy, R, _l, _s, _p, alpha) => {
  ctx.save();
  const grad = ctx.createRadialGradient(cx-R*0.15,cy-R*0.15,0,cx,cy,R*0.70);
  grad.addColorStop(0,`rgba(255,255,255,${alpha*0.40})`); grad.addColorStop(0.6,`rgba(255,255,255,${alpha*0.10})`); grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx,cy,R*0.70,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${alpha*0.30})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx,cy,R*0.60,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${alpha*0.25})`; ctx.beginPath(); ctx.ellipse(cx+R*1.10,cy,R*0.12,R*0.08,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
};

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
  const fill = green ? (flash ? '#f0fdf4' : '#4ade80') : (flash ? CLASS_FLASH[cls] : CLASS_FILL[cls]);
  const glow = green ? 'rgba(74,222,128,0.50)' : CLASS_GLOW[cls];
  const R0 = cell * 0.22;
  const k  = cell * 0.016;
  const R  = getVirusRadius(n, R0, k);

  // 1a. Secondary anatomy (behind primary core)
  drawChassisSecondary(ctx, cx, cy, n, R, fill, glow, flash);

  // 1b. Primary core chassis
  buildChassisPath(ctx, cx, cy, n, R);
  ctx.shadowColor = glow; ctx.shadowBlur = flash ? 4 : 10;
  ctx.fillStyle = fill; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1; ctx.stroke();

  // 1c. Tertiary surface detail overlays
  if (!green) drawChassisTertiary(ctx, cx, cy, n, R, flash);

  // 2. Class-specific decorations
  if (!green) {
    if (cls === 'perfect-square' || cls === 'power-of-two') {
      ctx.beginPath(); ctx.arc(cx, cy, R*0.40, 0, Math.PI*2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (cls === 'prime') {
      const L = getVirusLobes(n);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < L; i++) {
        const angle = (i/L)*Math.PI*2 - Math.PI/2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+R*0.58*Math.cos(angle),cy+R*0.58*Math.sin(angle)); ctx.stroke();
      }
    }
    if (cls === 'power-of-two') {
      ctx.beginPath(); ctx.arc(cx, cy, R*0.70, 0, Math.PI*2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1; ctx.stroke();
    }
  }

  // 3. Archetype overlays
  if (!flash && !green) {
    const profile = getVirusModelProfile(n);
    const lobes   = getVirusLobes(n);
    const spikes  = getVirusSpikes(n);
    ARCHETYPE_OVERLAYS[profile.primaryArchetype](ctx, cx, cy, R, lobes, spikes, profile, profile.primaryWeight * 0.80);
    if (profile.secondaryWeight > 0.15) {
      ARCHETYPE_OVERLAYS[profile.secondaryArchetype](ctx, cx, cy, R, lobes, spikes, profile, profile.secondaryWeight * 0.45);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 10  Perceptual diversity system
// ═══════════════════════════════════════════════════════════════════════════════

/** 9-axis perceptual fingerprint for one virus integer. */
export interface MorphSig {
  chassis:    number; // 0–7
  variant:    number; // 0–2
  cls:        number; // 0–4 VirusClass ordinal
  armor:      number; // 0–3
  organic:    number; // 0–3
  archetype:  number; // 0–3 bucketed
  lobes:      number; // 0–5
  spikePat:   number; // 0–7
  sizeBucket: number; // 0–2
}

const VIRUS_CLASS_ORDER: VirusClass[] = [
  'prime','power-of-two','perfect-square','even-composite','odd-composite',
];

export function getMorphSig(n: number): MorphSig {
  return {
    chassis:    getChassisType(n),
    variant:    getChassisVariant(n),
    cls:        VIRUS_CLASS_ORDER.indexOf(getVirusClass(n)),
    armor:      Math.floor(normalizedHash(n, 6) * 4),
    organic:    Math.floor(normalizedHash(n, 7) * 4),
    archetype:  Math.floor(normalizedHash(n, 1) * 4),
    lobes:      getVirusLobes(n) - 3,
    spikePat:   n & 7,
    sizeBucket: Math.floor(normalizedHash(n, 51) * 3),
  };
}

export function morphDistance(a: MorphSig, b: MorphSig): number {
  let d = 0;
  d += (a.chassis    !== b.chassis    ? 1 : 0) * 0.35;
  d += (a.cls        !== b.cls        ? 1 : 0) * 0.20;
  d += (a.variant    !== b.variant    ? 1 : 0) * 0.15;
  d += (a.archetype  !== b.archetype  ? 1 : 0) * 0.10;
  d += (a.lobes      !== b.lobes      ? 1 : 0) * 0.08;
  d += (a.spikePat   !== b.spikePat   ? 1 : 0) * 0.05;
  d += (a.armor      !== b.armor      ? 1 : 0) * 0.04;
  d += (a.organic    !== b.organic    ? 1 : 0) * 0.02;
  d += (a.sizeBucket !== b.sizeBucket ? 1 : 0) * 0.01;
  return d;
}

export function selectDiverseSeed(waveSigs: MorphSig[], crossHistory: MorphSig[]): number {
  let best = -1;
  let bestScore = -1;
  for (let attempt = 0; attempt < 16; attempt++) {
    const seed = Math.floor(Math.random() * 255) + 1;
    const sig  = getMorphSig(seed);
    let waveMin = 1.0;
    for (const ws of waveSigs) { const d = morphDistance(sig, ws); if (d < waveMin) waveMin = d; }
    let histMin = 1.0;
    for (const hs of crossHistory) { const d = morphDistance(sig, hs); if (d < histMin) histMin = d; }
    const score = waveMin * 0.70 + histMin * 0.30;
    if (score > bestScore) { bestScore = score; best = seed; }
  }
  return best > 0 ? best : Math.floor(Math.random() * 255) + 1;
}
