export const LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS = 1_600;

export type LordAlphaGridCell = Readonly<{
  col: number;
  row: number;
}>;

export type LordAlphaAfterimageStepPhase = "active" | "completed";

/**
 * Presentation state for Lord Alpha's delayed afterimage step.
 *
 * `origin` remains the authoritative gameplay cell while this state is active.
 * `queuedDestination` is only an intent/highlight; callers should update the
 * logical player position exclusively from a successful completion result.
 */
export type LordAlphaAfterimageStepState = Readonly<{
  origin: LordAlphaGridCell;
  queuedDestination: LordAlphaGridCell | null;
  startedAtMs: number;
  durationMs: number;
  phase: LordAlphaAfterimageStepPhase;
  completedAtMs: number | null;
}>;

export type LordAlphaAfterimageStepCompletion = Readonly<{
  state: LordAlphaAfterimageStepState;
  destination: LordAlphaGridCell | null;
  didComplete: boolean;
  didTeleport: boolean;
}>;

const copyCell = ({ col, row }: LordAlphaGridCell): LordAlphaGridCell => ({
  col,
  row,
});

export const isLordAlphaGridCell = (
  cell: LordAlphaGridCell,
): boolean =>
  Number.isInteger(cell.col) &&
  Number.isInteger(cell.row) &&
  cell.col >= 0 &&
  cell.col < 3 &&
  cell.row >= 0 &&
  cell.row < 3;

const cellsEqual = (
  left: LordAlphaGridCell,
  right: LordAlphaGridCell,
): boolean => left.col === right.col && left.row === right.row;

export const beginLordAlphaAfterimageStep = (
  origin: LordAlphaGridCell,
  startedAtMs: number,
  durationMs = LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS,
): LordAlphaAfterimageStepState => {
  if (!isLordAlphaGridCell(origin)) {
    throw new RangeError("Lord Alpha afterimage origin must be on the 3x3 grid");
  }

  if (!Number.isFinite(startedAtMs)) {
    throw new RangeError("Lord Alpha afterimage start time must be finite");
  }

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError("Lord Alpha afterimage duration must be positive");
  }

  return {
    origin: copyCell(origin),
    queuedDestination: null,
    startedAtMs,
    durationMs,
    phase: "active",
    completedAtMs: null,
  };
};

/**
 * Replaces the current intent with the latest valid 3x3 destination.
 * Invalid input and input received after completion leave state untouched.
 */
export const queueLordAlphaAfterimageStepDestination = (
  state: LordAlphaAfterimageStepState,
  destination: LordAlphaGridCell,
): LordAlphaAfterimageStepState => {
  if (state.phase !== "active" || !isLordAlphaGridCell(destination)) {
    return state;
  }

  return {
    ...state,
    queuedDestination: copyCell(destination),
  };
};

export const lordAlphaAfterimageStepProgress = (
  state: LordAlphaAfterimageStepState,
  nowMs: number,
): number => {
  if (state.phase === "completed") return 1;
  if (!Number.isFinite(nowMs)) return 0;
  return Math.max(
    0,
    Math.min(1, (nowMs - state.startedAtMs) / state.durationMs),
  );
};

export const isLordAlphaAfterimageStepEvasive = (
  state: LordAlphaAfterimageStepState | null,
): boolean => state?.phase === "active";

/**
 * Emits a destination exactly once, and never before the choreography ends.
 * A cycle without movement resolves to its origin without teleporting.
 */
export const completeLordAlphaAfterimageStep = (
  state: LordAlphaAfterimageStepState,
  nowMs: number,
): LordAlphaAfterimageStepCompletion => {
  if (
    state.phase === "completed" ||
    lordAlphaAfterimageStepProgress(state, nowMs) < 1
  ) {
    return {
      state,
      destination: null,
      didComplete: false,
      didTeleport: false,
    };
  }

  const destination = copyCell(state.queuedDestination ?? state.origin);
  return {
    state: {
      ...state,
      phase: "completed",
      completedAtMs: nowMs,
    },
    destination,
    didComplete: true,
    didTeleport: !cellsEqual(destination, state.origin),
  };
};

/** A cancelled cycle has no residual target, highlight, or pending commit. */
export const cancelLordAlphaAfterimageStep = (): null => null;
