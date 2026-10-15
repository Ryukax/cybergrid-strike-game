import type { Enemy } from './types';

/**
 * Canonical, rewind-safe visual identity for one enemy specimen.
 *
 * New enemies receive visualSeed when spawned. The deterministic fallback is
 * retained for older saves and must be shared by gameplay and rendering so a
 * route objective can never point at a different specimen than its marker.
 */
export function getEnemyVisualSeed(enemy: Enemy): number {
  return enemy.visualSeed
    ?? (enemy.value ?? 6) * 131
      + (enemy.formationId ?? 0) * 104729
      + (enemy.genome?.generation ?? 0) * 8191;
}
