/**
 * Client-side CGRD reward tracking.
 * Mirrors the formula in artifacts/api-server/src/blockchain/token-value.ts.
 * The server re-validates before minting — this is for display only.
 */

import { getVirusClass } from '@/game/virus-morphology';

function popcount(n: number): number {
  let count = 0, x = n >>> 0;
  while (x) { count += x & 1; x >>>= 1; }
  return count;
}

const CLASS_MULTIPLIER: Record<string, number> = {
  'prime':          3.0,
  'power-of-two':   2.5,
  'perfect-square': 2.0,
  'odd-composite':  1.5,
  'even-composite': 1.0,
};

/** CGRD display-units earned for killing one virus with the given integer value. */
export function getVirusTokenValue(virusValue: number): number {
  const n     = Math.max(1, Math.min(255, virusValue));
  const lobes = 3 + (n % 6);
  const cls   = getVirusClass(n);
  const cm    = CLASS_MULTIPLIER[cls] ?? 1.0;
  const bm    = 1 + (popcount(n) / 8) * 0.5;
  const lm    = 1 + ((lobes - 3) / 5) * 0.3;
  return Math.round(10 * cm * bm * lm);
}

export interface KillRecord {
  value: number;   // virus integer 1–255
  cgrd:  number;   // CGRD display units earned
}

/** Accumulator — call recordKill() per virus destroyed, read totalCGRD anytime. */
export class RewardAccumulator {
  private kills: KillRecord[] = [];

  recordKill(virusValue: number): number {
    const cgrd = getVirusTokenValue(virusValue);
    this.kills.push({ value: virusValue, cgrd });
    return cgrd;
  }

  get totalCGRD(): number {
    return this.kills.reduce((s, k) => s + k.cgrd, 0);
  }

  get killList(): KillRecord[] {
    return [...this.kills];
  }

  get count(): number { return this.kills.length; }

  reset(): void { this.kills = []; }
}
