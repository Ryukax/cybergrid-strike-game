export const LORD_ALPHA_NINJATO_SLICE_DURATION_MS = 1_420;
export const LORD_ALPHA_NINJATO_SLICE_DASH_START_MS = 510;
export const LORD_ALPHA_NINJATO_SLICE_IMPACT_MS = 590;
export const LORD_ALPHA_NINJATO_SLICE_DASH_END_MS = 670;
export const LORD_ALPHA_NINJATO_SLICE_SETTLE_END_MS = 950;
export const LORD_ALPHA_NINJATO_SLICE_RETURN_MS = 1_010;

export interface LordAlphaNinjatoSlicePoint {
  readonly col: number;
  readonly row: number;
}

export interface LordAlphaNinjatoSliceState {
  readonly startedAtMs: number;
  readonly origin: LordAlphaNinjatoSlicePoint;
  readonly target: LordAlphaNinjatoSlicePoint;
  readonly farSide: LordAlphaNinjatoSlicePoint;
  readonly hitApplied: boolean;
}

export type LordAlphaNinjatoSlicePhase =
  | "ready"
  | "approach"
  | "cut"
  | "settle"
  | "teleport"
  | "recover"
  | "complete";

export interface LordAlphaNinjatoSlicePose extends LordAlphaNinjatoSlicePoint {
  readonly opacity: number;
  readonly phase: LordAlphaNinjatoSlicePhase;
  readonly evasive: boolean;
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

export function beginLordAlphaNinjatoSlice(
  origin: LordAlphaNinjatoSlicePoint,
  target: LordAlphaNinjatoSlicePoint,
  farSide: LordAlphaNinjatoSlicePoint,
  startedAtMs: number,
): LordAlphaNinjatoSliceState {
  if (![origin.col, origin.row, target.col, target.row, farSide.col, farSide.row, startedAtMs]
    .every(Number.isFinite)) {
    throw new Error("Ninjato Phase Slice requires finite coordinates and time");
  }
  return {
    startedAtMs,
    origin: { ...origin },
    target: { ...target },
    farSide: { ...farSide },
    hitApplied: false,
  };
}

export function markLordAlphaNinjatoSliceHit(
  state: LordAlphaNinjatoSliceState,
): LordAlphaNinjatoSliceState {
  return state.hitApplied ? state : { ...state, hitApplied: true };
}

export function resolveLordAlphaNinjatoSlicePose(
  state: LordAlphaNinjatoSliceState | null | undefined,
  nowMs: number,
  reducedMotion = false,
): LordAlphaNinjatoSlicePose | null {
  if (!state) return null;
  const elapsed = Math.max(0, nowMs - state.startedAtMs);
  const complete = elapsed >= LORD_ALPHA_NINJATO_SLICE_DURATION_MS;
  const shouldApplyHit = !state.hitApplied
    && elapsed >= LORD_ALPHA_NINJATO_SLICE_IMPACT_MS;
  const evasive = elapsed >= LORD_ALPHA_NINJATO_SLICE_DASH_START_MS
    && elapsed < LORD_ALPHA_NINJATO_SLICE_DASH_END_MS;

  if (complete) {
    return {
      ...state.origin,
      opacity: 1,
      phase: "complete",
      evasive: false,
      shouldApplyHit,
      complete: true,
    };
  }

  if (reducedMotion) {
    return {
      ...state.origin,
      opacity: 1,
      phase: elapsed < LORD_ALPHA_NINJATO_SLICE_IMPACT_MS ? "ready" : "recover",
      evasive,
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_SLICE_DASH_START_MS) {
    return {
      ...state.origin,
      opacity: 1,
      phase: "ready",
      evasive: false,
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_SLICE_IMPACT_MS) {
    const progress = smoothstep(
      (elapsed - LORD_ALPHA_NINJATO_SLICE_DASH_START_MS)
        / (LORD_ALPHA_NINJATO_SLICE_IMPACT_MS - LORD_ALPHA_NINJATO_SLICE_DASH_START_MS),
    );
    return {
      col: lerp(state.origin.col, state.target.col, progress),
      row: lerp(state.origin.row, state.target.row, progress),
      opacity: 1,
      phase: "approach",
      evasive,
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_SLICE_DASH_END_MS) {
    const progress = smoothstep(
      (elapsed - LORD_ALPHA_NINJATO_SLICE_IMPACT_MS)
        / (LORD_ALPHA_NINJATO_SLICE_DASH_END_MS - LORD_ALPHA_NINJATO_SLICE_IMPACT_MS),
    );
    return {
      col: lerp(state.target.col, state.farSide.col, progress),
      row: lerp(state.target.row, state.farSide.row, progress),
      opacity: 1,
      phase: "cut",
      evasive,
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_SLICE_SETTLE_END_MS) {
    return {
      ...state.farSide,
      opacity: 1,
      phase: "settle",
      evasive,
      shouldApplyHit,
      complete: false,
    };
  }

  if (elapsed < LORD_ALPHA_NINJATO_SLICE_RETURN_MS) {
    return {
      ...state.farSide,
      opacity: 0,
      phase: "teleport",
      evasive,
      shouldApplyHit,
      complete: false,
    };
  }

  return {
    ...state.origin,
    opacity: 1,
    phase: "recover",
    evasive: false,
    shouldApplyHit,
    complete: false,
  };
}

export function isLordAlphaNinjatoSliceEvasive(
  state: LordAlphaNinjatoSliceState | null | undefined,
  nowMs: number,
): boolean {
  return resolveLordAlphaNinjatoSlicePose(state, nowMs)?.evasive ?? false;
}
