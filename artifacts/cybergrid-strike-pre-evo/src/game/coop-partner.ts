import type { DiagonalCoopCell, DiagonalCoopPairLayout } from './diagonal-coop';

/** Persisted independently from the player's own customization choice. */
export const COOP_PARTNER_SKIN_KEY = 'cgs_coop_partner_skin';

/** Must match the stable shared-cell separation used by the board renderer. */
export const COOP_PARTNER_PAIR_OFFSET_CELLS = 0.13;

/**
 * Resolve one saved co-op partner identity against the live skin catalog.
 *
 * The catalog is supplied by the UI so this helper cannot drift away from the
 * actual selectable skins. Unknown values from an older build safely return
 * the caller's explicit fallback.
 */
export function resolveStoredCoopPartnerSkin<TSkin extends string>(
  storedSkin: string | null | undefined,
  availableSkins: readonly TSkin[],
  fallbackSkin: TSkin,
): TSkin {
  const available = new Set<TSkin>(availableSkins);
  if (!available.has(fallbackSkin)) {
    throw new RangeError('Co-op partner fallback must exist in the available skin catalog');
  }
  return storedSkin && available.has(storedSkin as TSkin)
    ? storedSkin as TSkin
    : fallbackSkin;
}

/**
 * Position the authored partner sprite opposite the player inside a shared
 * cell. Dimensions are intentionally absent: collision affects position only,
 * never the partner's render scale.
 */
export function resolveCoopPartnerVisualCell(
  partner: DiagonalCoopCell,
  pairLayout: DiagonalCoopPairLayout | null | undefined,
): { readonly col: number; readonly row: number } {
  return {
    col: partner.col
      - (pairLayout?.playerX ?? 0) * COOP_PARTNER_PAIR_OFFSET_CELLS,
    row: partner.row
      - (pairLayout?.playerY ?? 0) * COOP_PARTNER_PAIR_OFFSET_CELLS,
  };
}
