import type { BoardMetrics } from './types';

/** Visual breathing room between the Action Window and the tactical grid. */
export const ACTION_WINDOW_GRID_GAP = 8;

/** Keep every tactical row usable even when a tall Action Window is restored. */
export const MIN_VISIBLE_BOARD_CELL = 32;

export function getActionWindowBottomLimit(viewportHeight: number): number {
  const height = Math.max(1, viewportHeight);
  return Math.max(1, height - MIN_VISIBLE_BOARD_CELL * 3 - ACTION_WINDOW_GRID_GAP);
}

/**
 * Resolve the canonical board rectangle. `topFloor` lets HUD surfaces reserve
 * vertical space without visually translating only part of the combat system.
 */
export function getBoardMetrics(w: number, h: number, topFloor = 0): BoardMetrics {
  const width = Math.max(1, w);
  const height = Math.max(1, h);
  const baseCell = Math.min(width / 6.8, height / 8.2);
  const baseY = Math.max(height * (height > width ? 0.18 : 0.24), 90);
  const requestedTop = Math.max(baseY, Number.isFinite(topFloor) ? topFloor : 0);
  const maximumTop = Math.max(0, height - MIN_VISIBLE_BOARD_CELL * 3);
  const y = Math.min(requestedTop, maximumTop);
  const cell = Math.min(baseCell, Math.max(1, (height - y) / 3));
  const boardW = cell * 6;
  const boardH = cell * 3;
  const x = (width - boardW) * 0.5;
  return { cell, boardW, boardH, x, y };
}
