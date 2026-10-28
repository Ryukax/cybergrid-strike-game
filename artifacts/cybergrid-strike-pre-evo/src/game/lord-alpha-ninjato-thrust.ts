export const LORD_ALPHA_NINJATO_THRUST_DURATION_MS = 660;
export const LORD_ALPHA_NINJATO_THRUST_ENTRY_END_MS = 150;
export const LORD_ALPHA_NINJATO_THRUST_IMPACT_MS = 310;
export const LORD_ALPHA_NINJATO_THRUST_CONTACT_END_MS = 500;
export const LORD_ALPHA_NINJATO_THRUST_RETURN_MS = 560;
export const LORD_ALPHA_NINJATO_THRUST_FOLLOWUP_WINDOW_MS = 500;

export interface LordAlphaNinjatoThrustPoint {
  readonly col: number;
  readonly row: number;
}

export interface LordAlphaNinjatoThrustState {
  readonly startedAtMs: number;
  readonly origin: LordAlphaNinjatoThrustPoint;
  readonly entry: LordAlphaNinjatoThrustPoint;
  readonly contact: LordAlphaNinjatoThrustPoint;
  readonly target: LordAlphaNinjatoThrustPoint;
  readonly hitApplied: boolean;
}

export interface LordAlphaNinjatoThrustFollowupWindow {
  readonly openedAtMs: number;
  readonly expiresAtMs: number;
}

export type LordAlphaNinjatoThrustPhase =
  | "entry"
  | "drive"
  | "contact"
  | "teleport"
  | "recover"
  | "complete";

export interface LordAlphaNinjatoThrustPose extends LordAlphaNinjatoThrustPoint {
  readonly opacity: number;
  readonly phase: LordAlphaNinjatoThrustPhase;
  readonly shouldApplyHit: boolean;
  readonly complete: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (start: number, end: number, progress: number) =>
  start + (end - start) * clamp01(progress);
const smoothstep = (progress: number) => {
  const bounded = clamp01(progress);
  return bounded * bounded * (3 - 2 * bounded);
};

export function beginLordAlphaNinjatoThrust(
  origin: LordAlphaNinjatoThrustPoint,
  entry: LordAlphaNinjatoThrustPoint,
  contact: LordAlphaNinjatoThrustPoint,
  target: LordAlphaNinjatoThrustPoint,
  startedAtMs: number,
): LordAlphaNinjatoThrustState {
  const values = [
    origin.col,
    origin.row,
    entry.col,
    entry.row,
    contact.col,
    contact.row,
    target.col,
    target.row,
    startedAtMs,
  ];
  if (!values.every(Number.isFinite)) {
    throw new Error("Ninjato Back Thrust requires finite coordinates and time");
  }
  return {
    startedAtMs,
    origin: { ...origin },
    entry: { ...entry },
    contact: { ...contact },
    target: { ...target },
    hitApplied: false,
  };
}

export function markLordAlphaNinjatoThrustHit(
  state: LordAlphaNinjatoThrustState,
): LordAlphaNinjatoThrustState {
  return state.hitApplied ? state : { ...state, hitApplied: true };
}

export function resolveLordAlphaNinjatoFrontSide(
  target: LordAlphaNinjatoThrustPoint,
  frontOffset = 0.78,
  entryOffset = 1.05,
): { entry: LordAlphaNinjatoThrustPoint; contact: LordAlphaNinjatoThrustPoint } {
  const safeFrontOffset = Number.isFinite(frontOffset) ? Math.max(0.2, frontOffset) : 0.78;
  const safeEntryOffset = Number.isFinite(entryOffset) ? Math.max(0.2, entryOffset) : 1.05;
  const contactCol = Math.max(0.25, Math.min(5.2, target.col - safeFrontOffset));
  return {
    entry: { col: Math.max(0.05, contactCol - safeEntryOffset), row: target.row },
    contact: { col: contactCol, row: target.row },
  };
}

export function resolveLordAlphaNinjatoThrustPose(
  state: LordAlphaNinjatoThrustState | null | undefined,
  nowMs: number,
  reducedMotion = false,
): LordAlphaNinjatoThrustPose | null {
  if (!state) return null;
  const elapsed = Math.max(0, nowMs - state.startedAtMs);
  const shouldApplyHit = !state.hitApplied
    && elapsed >= LORD_ALPHA_NINJATO_THRUST_IMPACT_MS;

  if (elapsed >= LORD_ALPHA_NINJATO_THRUST_DURATION_MS) {
    return {
      ...state.origin,
      opacity: 1,
      phase: "complete",
      shouldApplyHit,
      complete: true,
    };
  }

  if (reducedMotion) {
    return {
      ...state.origin,
      opacity: 1,
      phase: elapsed < LORD_ALPHA_NINJATO_THRUST_IMPACT_MS ? "entry" : "recover",
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_THRUST_ENTRY_END_MS) {
    const progress = smoothstep(elapsed / LORD_ALPHA_NINJATO_THRUST_ENTRY_END_MS);
    return {
      col: lerp(state.entry.col, state.contact.col - 0.2, progress),
      row: lerp(state.entry.row, state.contact.row, progress),
      opacity: 1,
      phase: "entry",
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_THRUST_IMPACT_MS) {
    const progress = smoothstep(
      (elapsed - LORD_ALPHA_NINJATO_THRUST_ENTRY_END_MS)
        / (LORD_ALPHA_NINJATO_THRUST_IMPACT_MS - LORD_ALPHA_NINJATO_THRUST_ENTRY_END_MS),
    );
    return {
      col: lerp(state.contact.col - 0.2, state.contact.col, progress),
      row: state.contact.row,
      opacity: 1,
      phase: "drive",
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_THRUST_CONTACT_END_MS) {
    return {
      ...state.contact,
      opacity: 1,
      phase: "contact",
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_THRUST_RETURN_MS) {
    return {
      ...state.contact,
      opacity: 0,
      phase: "teleport",
      shouldApplyHit,
      complete: false,
    };
  }

  return {
    ...state.origin,
    opacity: 1,
    phase: "recover",
    shouldApplyHit,
    complete: false,
  };
}

export function openLordAlphaNinjatoThrustFollowupWindow(
  nowMs: number,
): LordAlphaNinjatoThrustFollowupWindow {
  return {
    openedAtMs: nowMs,
    expiresAtMs: nowMs + LORD_ALPHA_NINJATO_THRUST_FOLLOWUP_WINDOW_MS,
  };
}

export function isLordAlphaNinjatoThrustFollowupOpen(
  window: LordAlphaNinjatoThrustFollowupWindow | null | undefined,
  nowMs: number,
): boolean {
  return Boolean(
    window
    && Number.isFinite(nowMs)
    && nowMs >= window.openedAtMs
    && nowMs < window.expiresAtMs,
  );
}
