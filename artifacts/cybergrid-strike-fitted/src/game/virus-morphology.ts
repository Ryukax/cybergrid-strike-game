/**
 * Virus Morphology Encoding Standard v1
 *
 * Each virus is generated from an integer n ∈ [1, 255].
 * The visual form is fully deterministic from n's bit pattern and arithmetic class.
 *
 * Hierarchy:
 *   Level 1 — Value:    exact integer encoded in 8 perimeter sectors (bit = spike/notch)
 *   Level 2 — Class:    prime, power-of-two, perfect-square, even-composite, odd-composite
 *   Level 3 — Relation: groups of viruses share hidden prime-factor keys (future gameplay)
 */

// ── Type ─────────────────────────────────────────────────────────────────────

export type VirusClass =
  | 'prime'
  | 'power-of-two'
  | 'perfect-square'
  | 'even-composite'
  | 'odd-composite';

// ── Number theory helpers ─────────────────────────────────────────────────────

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

// ── Classification ────────────────────────────────────────────────────────────
// Precedence: prime > power-of-two > perfect-square > parity

export function getVirusClass(n: number): VirusClass {
  if (isPrime(n)) return 'prime';
  if (isPowerOfTwo(n)) return 'power-of-two';
  if (isPerfectSquare(n)) return 'perfect-square';
  if (n % 2 === 0) return 'even-composite';
  return 'odd-composite';
}

// ── Morphology parameters ─────────────────────────────────────────────────────

/** L = 3 + (n mod 6) → 3 to 8 outer lobes */
export function getVirusLobes(n: number): number {
  return 3 + (n % 6);
}

/** R = R₀ + k·log₂(n+1) — logarithmic size scaling */
export function getVirusRadius(n: number, R0: number, k: number): number {
  return R0 + k * Math.log2(n + 1);
}

/** Returns 8 booleans from the low 8 bits of n: bit_i=1 → spike, bit_i=0 → notch */
export function getVirusSpikes(n: number): boolean[] {
  return Array.from({ length: 8 }, (_, i) => Boolean((n >> i) & 1));
}

// ── Color palette ─────────────────────────────────────────────────────────────

const CLASS_FILL: Record<VirusClass, string> = {
  'prime':          '#e879f9', // fuchsia  — highly regular radial symmetry
  'power-of-two':   '#22d3ee', // cyan     — highly ordered concentric form
  'perfect-square': '#fbbf24', // amber    — nested inner ring
  'even-composite': '#fb7185', // rose     — mirrored / bilateral emphasis
  'odd-composite':  '#fb923c', // orange   — rotational asymmetry
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

// ── Polar outline ─────────────────────────────────────────────────────────────

/**
 * Compute r(θ) for the virus outline:
 *   - Lobe envelope:  R · (0.78 + 0.22·cos(L·θ))
 *   - Binary overlay: ±amplitude blended at each sector centre
 */
function virusRadius(
  theta: number,
  n: number,
  R: number,
): number {
  const L = getVirusLobes(n);
  const spikes = getVirusSpikes(n);

  const lobeFactor = 0.78 + 0.22 * Math.cos(L * theta);

  // Which of the 8 sectors contains this angle?
  const sectorWidth = (Math.PI * 2) / 8;
  const normTheta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.floor(normTheta / sectorWidth);
  const sectorCenter = (sector + 0.5) * sectorWidth;

  // Smooth blend within the sector (cosine bell)
  let diff = normTheta - sectorCenter;
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  const blend = Math.max(0, Math.cos((diff / sectorWidth) * Math.PI * 0.5));

  const spikeAmp = R * 0.30;
  const notchAmp = R * 0.16;
  const binaryOffset = spikes[sector] ? spikeAmp * blend : -notchAmp * blend;

  return R * lobeFactor + binaryOffset;
}

// ── Main draw function ────────────────────────────────────────────────────────

const STEPS = 192; // angular resolution

/**
 * Draw a virus at canvas coordinates (cx, cy).
 *
 * @param n     Virus integer value 1–255
 * @param cell  Grid cell size in pixels (used to derive radius)
 * @param flash Whether the virus is currently in hit-flash state
 * @param green Override to green palette (VS mode NPC enemies)
 */
export function drawVirus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  n: number,
  cell: number,
  flash: boolean,
  green = false,
): void {
  const cls = green ? 'even-composite' : getVirusClass(n);

  const fill = green
    ? (flash ? '#f0fdf4' : '#4ade80')
    : (flash ? CLASS_FLASH[cls] : CLASS_FILL[cls]);

  const glow = green ? 'rgba(74,222,128,0.50)' : CLASS_GLOW[cls];

  // Scale: base radius ~18% of cell, log adds up to ~15%
  const R0 = cell * 0.185;
  const k  = cell * 0.026;
  const R  = getVirusRadius(n, R0, k);

  // ── Body path ──
  ctx.beginPath();
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    const r = virusRadius(t, n, R);
    const x = cx + r * Math.cos(t - Math.PI / 2);
    const y = cy + r * Math.sin(t - Math.PI / 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // Outer glow
  ctx.shadowColor = glow;
  ctx.shadowBlur = flash ? 4 : 10;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Rim stroke
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Class-specific decorations ──

  if (!green) {
    if (cls === 'perfect-square' || cls === 'power-of-two') {
      // Nested inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.40, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (cls === 'prime') {
      // Radial spokes — one per lobe, emphasising the irregular symmetry
      const L = getVirusLobes(n);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < L; i++) {
        const angle = (i / L) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + R * 0.58 * Math.cos(angle),
          cy + R * 0.58 * Math.sin(angle),
        );
        ctx.stroke();
      }
    }

    if (cls === 'power-of-two') {
      // Second (outer) concentric ring — extremely ordered form
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.70, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
