import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHRONO_REWIND_MAX_MS,
  CHRONO_REWIND_TAP_MS,
  resolveChronoReleaseTargetAt,
  selectChronoRewindSnapshot,
} from './chrono-rewind.ts';

test('a short Chrona press rewinds one visible beat instead of resolving at zero', () => {
  assert.equal(resolveChronoReleaseTargetAt({
    sourceAt: 10_000,
    startedAt: 10_000,
    releasedAt: 10_000,
  }), 10_000 - CHRONO_REWIND_TAP_MS);

  assert.equal(resolveChronoReleaseTargetAt({
    sourceAt: 10_000,
    startedAt: 10_000,
    releasedAt: 10_150,
  }), 10_000 - CHRONO_REWIND_TAP_MS);
});

test('Chrona holds retain their duration and clamp at the three-second limit', () => {
  assert.equal(resolveChronoReleaseTargetAt({
    sourceAt: 10_000,
    startedAt: 9_000,
    releasedAt: 10_000,
  }), 9_000);

  assert.equal(resolveChronoReleaseTargetAt({
    sourceAt: 10_000,
    startedAt: 5_000,
    releasedAt: 10_000,
  }), 10_000 - CHRONO_REWIND_MAX_MS);

  assert.equal(resolveChronoReleaseTargetAt({
    sourceAt: 10_000,
    startedAt: 9_999,
    releasedAt: 10_000,
    exhausted: true,
  }), 10_000 - CHRONO_REWIND_MAX_MS);
});

test('snapshot selection respects the committed world-step boundary', () => {
  const history = [
    { at: 100, state: { milestoneWorldSteps: 1, label: 'old boundary' } },
    { at: 200, state: { milestoneWorldSteps: 2, label: 'oldest eligible' } },
    { at: 300, state: { milestoneWorldSteps: 2, label: 'middle eligible' } },
    { at: 400, state: { milestoneWorldSteps: 2, label: 'newest eligible' } },
  ];

  assert.equal(
    selectChronoRewindSnapshot(history, 350, 2)?.state.label,
    'middle eligible',
  );
  assert.equal(
    selectChronoRewindSnapshot(history, 50, 2)?.state.label,
    'oldest eligible',
  );
  assert.equal(selectChronoRewindSnapshot(history, 350, 3), null);
});
