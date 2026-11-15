import {
  ABILITY_DEFINITIONS,
  CANONICAL_ABILITY_IDS,
  type AbilityId,
} from './ability-system';

export const ABILITY_IMAGEGEN_VFX_VERSION = 1 as const;
export const ABILITY_IMAGEGEN_COLUMNS = 2 as const;
export const ABILITY_IMAGEGEN_ROWS = 2 as const;
export const ABILITY_IMAGEGEN_FRAME_COUNT = 4 as const;

export interface AbilityImagegenVfxAsset {
  readonly abilityId: AbilityId;
  readonly suffix: `effects/ability-cards/v1/${AbilityId}.png`;
  readonly columns: typeof ABILITY_IMAGEGEN_COLUMNS;
  readonly rows: typeof ABILITY_IMAGEGEN_ROWS;
  readonly frameCount: typeof ABILITY_IMAGEGEN_FRAME_COUNT;
  readonly frameHoldMs: readonly [number, number, number, number];
  readonly durationMs: number;
  readonly reducedMotionFrame: 2;
  readonly displayScale: number;
  readonly version: typeof ABILITY_IMAGEGEN_VFX_VERSION;
}

function frameTiming(abilityId: AbilityId, index: number): readonly [number, number, number, number] {
  const cadence = ABILITY_DEFINITIONS[abilityId].cadence;
  const variation = (index % 4) * 18;
  if (cadence === 'window') {
    return [230 + variation, 290, 330 + (index % 3) * 20, 260] as const;
  }
  if (cadence === 'setup') {
    return [270 + variation, 320, 250 + (index % 3) * 20, 220] as const;
  }
  return [190 + variation, 250, 280 + (index % 3) * 18, 230] as const;
}

function displayScale(abilityId: AbilityId): number {
  const target = ABILITY_DEFINITIONS[abilityId].target;
  if (target === 'grid') return 1.52;
  if (target === 'self' || target === 'hand') return 1.28;
  if (target === 'lane') return 1.34;
  return 1.2;
}

function createAsset(abilityId: AbilityId, index: number): AbilityImagegenVfxAsset {
  const frameHoldMs = frameTiming(abilityId, index);
  return Object.freeze({
    abilityId,
    suffix: `effects/ability-cards/v1/${abilityId}.png`,
    columns: ABILITY_IMAGEGEN_COLUMNS,
    rows: ABILITY_IMAGEGEN_ROWS,
    frameCount: ABILITY_IMAGEGEN_FRAME_COUNT,
    frameHoldMs,
    durationMs: frameHoldMs.reduce((total, value) => total + value, 0),
    reducedMotionFrame: 2 as const,
    displayScale: displayScale(abilityId),
    version: ABILITY_IMAGEGEN_VFX_VERSION,
  });
}

/**
 * Closed, exhaustive manifest for the finite authored card pool. Every card
 * owns a separate ImageGen sheet; generated manifestation cards intentionally
 * remain on their compositional renderer because their vocabulary is open.
 */
export const ABILITY_IMAGEGEN_VFX_ASSETS = Object.freeze(Object.fromEntries(
  CANONICAL_ABILITY_IDS.map((abilityId, index) => [abilityId, createAsset(abilityId, index)]),
)) as Readonly<Record<AbilityId, AbilityImagegenVfxAsset>>;

export function resolveAbilityImagegenVfxAsset(
  abilityId: string,
): AbilityImagegenVfxAsset | null {
  return Object.prototype.hasOwnProperty.call(ABILITY_IMAGEGEN_VFX_ASSETS, abilityId)
    ? ABILITY_IMAGEGEN_VFX_ASSETS[abilityId as AbilityId]
    : null;
}

export function abilityImagegenVfxUrl(
  asset: AbilityImagegenVfxAsset,
  baseUrl: string,
): string {
  return `${baseUrl}${asset.suffix}?v=${asset.version}`;
}

export function abilityImagegenFrameIndex(
  asset: AbilityImagegenVfxAsset,
  progress: number,
  reducedMotion = false,
): number {
  if (reducedMotion) return asset.reducedMotionFrame;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const elapsedMs = safeProgress * asset.durationMs;
  let elapsedBoundary = 0;
  for (let frame = 0; frame < asset.frameHoldMs.length; frame += 1) {
    elapsedBoundary += asset.frameHoldMs[frame];
    if (elapsedMs < elapsedBoundary || frame === asset.frameCount - 1) return frame;
  }
  return asset.frameCount - 1;
}
