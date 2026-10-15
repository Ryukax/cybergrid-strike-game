export type MovablePanelPosition = {
  x: number;
  y: number;
};

export type MovablePanelSize = {
  width: number;
  height: number;
};

export const MOVABLE_PANEL_MARGIN = 8;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const getAxisRange = (viewportSize: number, panelSize: number, margin: number) => {
  const available = Math.max(0, viewportSize - panelSize);
  const inset = Math.min(Math.max(0, margin), available / 2);
  const min = inset;
  const max = Math.max(min, available - inset);
  return { min, travel: max - min };
};

/** Resolve a persisted, responsive 0..1 position to viewport pixels. */
export function resolveMovablePanelPosition(
  position: MovablePanelPosition,
  panel: MovablePanelSize,
  viewport: MovablePanelSize,
  margin = MOVABLE_PANEL_MARGIN,
): MovablePanelPosition {
  const horizontal = getAxisRange(viewport.width, panel.width, margin);
  const vertical = getAxisRange(viewport.height, panel.height, margin);
  return {
    x: horizontal.min + horizontal.travel * clamp01(position.x),
    y: vertical.min + vertical.travel * clamp01(position.y),
  };
}

/** Clamp a pixel position to the viewport and convert it to responsive 0..1 coordinates. */
export function normalizeMovablePanelPosition(
  position: MovablePanelPosition,
  panel: MovablePanelSize,
  viewport: MovablePanelSize,
  margin = MOVABLE_PANEL_MARGIN,
): MovablePanelPosition {
  const horizontal = getAxisRange(viewport.width, panel.width, margin);
  const vertical = getAxisRange(viewport.height, panel.height, margin);
  return {
    x: horizontal.travel > 0 ? clamp01((position.x - horizontal.min) / horizontal.travel) : 0,
    y: vertical.travel > 0 ? clamp01((position.y - vertical.min) / vertical.travel) : 0,
  };
}

export function parseMovablePanelPosition(value: string | null): MovablePanelPosition | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MovablePanelPosition>;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return {
      x: clamp01(parsed.x as number),
      y: clamp01(parsed.y as number),
    };
  } catch {
    return null;
  }
}
