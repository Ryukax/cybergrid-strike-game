/**
 * CGRD reward formula — mirrors src/blockchain/rewards.ts on the frontend.
 * The backend is the canonical source; keep both in sync.
 *
 * Token value is determined by virus morphological complexity:
 *   base × classMultiplier × bitDensityMultiplier × lobeMultiplier
 *
 * Range: ~10 CGRD (simple even-composite, 3 lobes, 0 spikes)
 *        ~90 CGRD (prime, 8 lobes, all 8 bits set)
 */

function popcount(n: number): number {
  let count = 0, x = n >>> 0;
  while (x) { count += x & 1; x >>>= 1; }
  return count;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

function isPerfectSquare(n: number): boolean {
  const s = Math.round(Math.sqrt(n));
  return s * s === n;
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function classMultiplier(n: number): number {
  if (isPrime(n))         return 3.0;
  if (isPowerOfTwo(n))    return 2.5;
  if (isPerfectSquare(n)) return 2.0;
  if (n % 2 !== 0)        return 1.5;
  return 1.0;
}

/** CGRD reward (display units, no decimals) for one virus kill */
export function getVirusTokenValue(virusValue: number): number {
  const n     = Math.max(1, Math.min(255, virusValue));
  const lobes = 3 + (n % 6);
  const cm    = classMultiplier(n);
  const bm    = 1 + (popcount(n) / 8) * 0.5;
  const lm    = 1 + ((lobes - 3) / 5) * 0.3;
  return Math.round(10 * cm * bm * lm);
}

/** Total CGRD from an array of kill events */
export function totalTokens(kills: { value: number }[]): number {
  return kills.reduce((sum, k) => sum + getVirusTokenValue(k.value), 0);
}

/** Convert display CGRD to wei (18 decimals) */
export function toWei(cgrd: number): bigint {
  return BigInt(cgrd) * (10n ** 18n);
}
