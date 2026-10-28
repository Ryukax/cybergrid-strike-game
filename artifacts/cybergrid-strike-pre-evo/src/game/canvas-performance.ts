/**
 * Canvas resolution policy for full-window gameplay surfaces.
 *
 * Mobile browsers commonly report a devicePixelRatio of 2-3. Rendering every
 * fullscreen combat layer at that density multiplies fill cost and backing
 * memory without improving the HTML HUD. A 1.5 cap keeps diagonal/grid edges
 * crisp while cutting the common DPR-2 surface by roughly 44 percent.
 */
export const GAME_CANVAS_DPR_CAP = 1.5;
export const GAMEPLAY_CANVAS_DESKTOP_DPR_CAP = 1.25;
export const GAMEPLAY_CANVAS_COMPACT_DPR_CAP = 1;
export const GAMEPLAY_SIMULATION_HZ = 60;
export const GAMEPLAY_RENDER_HZ = 30;
export const GAMEPLAY_SIMULATION_FRAME_INTERVAL_MS = 1000 / GAMEPLAY_SIMULATION_HZ;
export const GAMEPLAY_RENDER_FRAME_INTERVAL_MS = 1000 / GAMEPLAY_RENDER_HZ;

/**
 * Keep the tolerance shared by simulation and drawing so fractional refresh
 * timestamps do not defer an otherwise-due frame by a full browser cycle.
 */
export function isGameplayFrameDue(elapsedMs: number, intervalMs: number): boolean {
  return Number.isFinite(elapsedMs)
    && Number.isFinite(intervalMs)
    && intervalMs > 0
    && elapsedMs + 0.5 >= intervalMs;
}

export interface GameplayFrameStep {
  readonly elapsedMs: number;
  readonly remainderMs: number;
}

/**
 * Consume complete timing intervals while retaining fractional display-frame
 * time. This prevents 90 Hz and 144 Hz panels from quantizing a nominal 60 Hz
 * simulation down to 45/48 Hz.
 */
export function resolveGameplayFrameStep(
  elapsedMs: number,
  intervalMs: number,
  maxElapsedMs = 100,
): GameplayFrameStep {
  if (!isGameplayFrameDue(elapsedMs, intervalMs)
    || !Number.isFinite(maxElapsedMs)
    || maxElapsedMs <= 0) {
    return {
      elapsedMs: 0,
      remainderMs: Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0,
    };
  }

  const intervalCount = Math.max(1, Math.floor((elapsedMs + 0.5) / intervalMs));
  const scheduledElapsedMs = intervalCount * intervalMs;
  const consumedElapsedMs = Math.min(elapsedMs, scheduledElapsedMs);
  return {
    elapsedMs: Math.min(maxElapsedMs, consumedElapsedMs),
    remainderMs: Math.max(0, elapsedMs - consumedElapsedMs),
  };
}

export function resolveGameCanvasDpr(devicePixelRatio: number | null | undefined): number {
  const finiteRatio = Number.isFinite(devicePixelRatio)
    ? Number(devicePixelRatio)
    : 1;
  return Math.min(GAME_CANVAS_DPR_CAP, Math.max(1, finiteRatio));
}

/**
 * The main board is the only always-on fullscreen canvas. Keep its desktop
 * surface slightly denser than CSS pixels, but use a 1:1 backing store on
 * compact/coarse-pointer devices where fill rate and memory bandwidth are the
 * dominant constraints. Small authored canvases may continue to use the
 * general cap above; fullscreen effect layers share this stricter policy.
 */
export function resolveGameplayCanvasDpr(
  devicePixelRatio: number | null | undefined,
  compactOrCoarse: boolean,
): number {
  return Math.min(
    resolveGameCanvasDpr(devicePixelRatio),
    compactOrCoarse
      ? GAMEPLAY_CANVAS_COMPACT_DPR_CAP
      : GAMEPLAY_CANVAS_DESKTOP_DPR_CAP,
  );
}
