export const CHRONO_REWIND_MAX_MS = 3_000;
export const CHRONO_REWIND_TAP_MS = 420;

export interface ChronoTimelineState {
  readonly milestoneWorldSteps: number;
}

export interface ChronoTimelineSnapshot<TState extends ChronoTimelineState> {
  readonly at: number;
  readonly state: TState;
}

export interface ChronoReleaseTiming {
  readonly sourceAt: number;
  readonly startedAt: number;
  readonly releasedAt: number;
  readonly exhausted?: boolean;
}

/**
 * A tap can begin and end between simulation frames. Give it one readable
 * reverse beat so mouse, touchscreen, and controller taps cannot resolve as a
 * zero-length Rewind. Holds retain their actual duration up to the 3 s cap.
 */
export function resolveChronoReleaseTargetAt({
  sourceAt,
  startedAt,
  releasedAt,
  exhausted = false,
}: ChronoReleaseTiming): number {
  const heldMs = Math.max(
    0,
    Math.min(CHRONO_REWIND_MAX_MS, releasedAt - startedAt),
  );
  const rewindMs = exhausted
    ? CHRONO_REWIND_MAX_MS
    : Math.max(CHRONO_REWIND_TAP_MS, heldMs);
  return sourceAt - Math.min(CHRONO_REWIND_MAX_MS, rewindMs);
}

/** Select the newest eligible snapshot at or before the requested time. */
export function selectChronoRewindSnapshot<TState extends ChronoTimelineState>(
  history: readonly ChronoTimelineSnapshot<TState>[],
  targetAt: number,
  milestoneWorldSteps: number,
): ChronoTimelineSnapshot<TState> | null {
  const eligible = history.filter(
    (entry) => entry.state.milestoneWorldSteps === milestoneWorldSteps,
  );
  if (eligible.length === 0) return null;

  let snapshot = eligible[0];
  for (let index = eligible.length - 1; index >= 0; index--) {
    if (eligible[index].at <= targetAt) {
      snapshot = eligible[index];
      break;
    }
  }
  return snapshot;
}
