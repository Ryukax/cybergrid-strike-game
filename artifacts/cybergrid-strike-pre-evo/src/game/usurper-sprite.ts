export const USURPER_IDLE_SHEET_PATH = 'skins/advanced-skill-sequences/hijack.png?v=1';
export const USURPER_ATTACK_SHEET_PATH = 'skins/advanced-attack-sequences/hijack.png?v=5';

export type UsurperSheetFrame = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

/**
 * Usurper's legacy idle PNG is a malformed composite: its body is headless and
 * the intended head is a separate island below the actor. The advanced sheets
 * contain complete, square authored poses. Resolve their first pose without
 * ever admitting the detached legacy island into the live sprite pipeline.
 */
export function resolveUsurperSheetFrame(
  sheetWidth: number,
  sheetHeight: number,
): UsurperSheetFrame | null {
  if (!Number.isFinite(sheetWidth) || !Number.isFinite(sheetHeight)) return null;
  const frameSize = Math.floor(sheetHeight);
  if (frameSize <= 0 || Math.floor(sheetWidth) < frameSize) return null;
  return { x: 0, y: 0, width: frameSize, height: frameSize };
}

export function isUsurperIdleSheetUrl(url: string): boolean {
  return url.includes('skins/advanced-skill-sequences/hijack.png');
}
