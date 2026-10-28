/**
 * Pure input state machine for Tharthareon's three gestures.
 *
 * The reducer owns only gesture timing and intent. Rendering, collision, and
 * combat remain with the game simulation. Callers may schedule a wake-up at
 * `tharthareonGestureDeadlineMs(state)` and feed it back as a `tick` event.
 */

export const THARTHAREON_HOLD_THRESHOLD_MS = 180;
export const THARTHAREON_DOUBLE_TAP_WINDOW_MS = 260;

export type TharthareonGesturePhase =
  | 'idle'
  | 'first-press'
  | 'pending-tap'
  | 'second-press'
  | 'bite-active'
  | 'headbutt-active';

export type TharthareonGestureCommand =
  | 'tap'
  | 'bite-start'
  | 'bite-release'
  | 'headbutt';

export type TharthareonActionMode = 'fireball' | 'bite' | 'headbutt';

/**
 * Keep the authored gestures and their combat actions explicit. This is shared
 * by pointer, keyboard, and gamepad input so no input path can silently fall
 * back to the old bite-only behavior.
 */
export function tharthareonActionModeForGesture(
  command: TharthareonGestureCommand,
): TharthareonActionMode | null {
  switch (command) {
    case 'tap':
      return 'fireball';
    case 'bite-start':
      return 'bite';
    case 'headbutt':
      return 'headbutt';
    case 'bite-release':
      return null;
  }
}

export interface TharthareonGestureState {
  readonly phase: TharthareonGesturePhase;
  /** Monotonic input time at which the first press began. */
  readonly pressedAtMs: number | null;
  /** Monotonic deadline after which a short first tap resolves as `tap`. */
  readonly pendingTapDeadlineMs: number | null;
}

export type TharthareonGestureEvent =
  | { readonly type: 'press'; readonly atMs: number }
  | { readonly type: 'release'; readonly atMs: number }
  | { readonly type: 'tick'; readonly atMs: number }
  | { readonly type: 'cancel'; readonly atMs: number }
  | { readonly type: 'headbutt-complete'; readonly atMs: number };

export interface TharthareonGestureResult {
  readonly state: TharthareonGestureState;
  readonly commands: readonly TharthareonGestureCommand[];
}

const IDLE_STATE: TharthareonGestureState = {
  phase: 'idle',
  pressedAtMs: null,
  pendingTapDeadlineMs: null,
};

const finiteTime = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function createTharthareonGestureState(): TharthareonGestureState {
  return IDLE_STATE;
}

/** Return the next time-based transition the caller needs to service. */
export function tharthareonGestureDeadlineMs(
  state: TharthareonGestureState,
): number | null {
  if (state.phase === 'first-press' && state.pressedAtMs !== null) {
    return state.pressedAtMs + THARTHAREON_HOLD_THRESHOLD_MS;
  }
  if (state.phase === 'pending-tap') return state.pendingTapDeadlineMs;
  return null;
}

function advanceTimedTransition(
  state: TharthareonGestureState,
  atMs: number,
): TharthareonGestureResult {
  if (
    state.phase === 'first-press'
    && state.pressedAtMs !== null
    && atMs >= state.pressedAtMs + THARTHAREON_HOLD_THRESHOLD_MS
  ) {
    return {
      state: {
        phase: 'bite-active',
        pressedAtMs: null,
        pendingTapDeadlineMs: null,
      },
      commands: ['bite-start'],
    };
  }
  if (
    state.phase === 'pending-tap'
    && state.pendingTapDeadlineMs !== null
    && atMs >= state.pendingTapDeadlineMs
  ) {
    return { state: IDLE_STATE, commands: ['tap'] };
  }
  return { state, commands: [] };
}

/**
 * Reduce one gesture event into a new immutable state and zero or more intents.
 *
 * Timing transitions are flushed before the event itself. This keeps the
 * contract deterministic even if a UI timer wakes late or the next physical
 * input arrives after a missed deadline.
 */
export function reduceTharthareonGesture(
  current: TharthareonGestureState,
  event: TharthareonGestureEvent,
): TharthareonGestureResult {
  const atMs = finiteTime(event.atMs);
  const advanced = advanceTimedTransition(current, atMs);
  let state = advanced.state;
  const commands: TharthareonGestureCommand[] = [...advanced.commands];

  if (event.type === 'tick') return { state, commands };

  if (event.type === 'headbutt-complete') {
    if (state.phase === 'headbutt-active') state = IDLE_STATE;
    return { state, commands };
  }

  if (event.type === 'cancel') {
    if (state.phase === 'headbutt-active') return { state, commands };
    if (state.phase === 'bite-active') commands.push('bite-release');
    return { state: IDLE_STATE, commands };
  }

  if (event.type === 'press') {
    if (state.phase === 'idle') {
      state = {
        phase: 'first-press',
        pressedAtMs: atMs,
        pendingTapDeadlineMs: null,
      };
    } else if (
      state.phase === 'pending-tap'
      && state.pendingTapDeadlineMs !== null
      && atMs < state.pendingTapDeadlineMs
    ) {
      state = {
        phase: 'second-press',
        pressedAtMs: atMs,
        pendingTapDeadlineMs: null,
      };
    }
    return { state, commands };
  }

  // release
  if (state.phase === 'first-press') {
    state = {
      phase: 'pending-tap',
      pressedAtMs: null,
      pendingTapDeadlineMs: atMs + THARTHAREON_DOUBLE_TAP_WINDOW_MS,
    };
  } else if (state.phase === 'second-press') {
    state = {
      phase: 'headbutt-active',
      pressedAtMs: null,
      pendingTapDeadlineMs: null,
    };
    commands.push('headbutt');
  } else if (state.phase === 'bite-active') {
    state = IDLE_STATE;
    commands.push('bite-release');
  }
  return { state, commands };
}
