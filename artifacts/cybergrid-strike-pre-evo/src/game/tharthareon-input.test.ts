import test from 'node:test';
import { deepEqual, equal } from 'node:assert/strict';
import {
  THARTHAREON_DOUBLE_TAP_WINDOW_MS,
  THARTHAREON_HOLD_THRESHOLD_MS,
  createTharthareonGestureState,
  reduceTharthareonGesture,
  tharthareonActionModeForGesture,
  tharthareonGestureDeadlineMs,
  type TharthareonGestureEvent,
  type TharthareonGestureState,
} from './tharthareon-input';

test('tap, double tap, and hold resolve to distinct Tharthareon attacks', () => {
  equal(tharthareonActionModeForGesture('tap'), 'fireball');
  equal(tharthareonActionModeForGesture('headbutt'), 'headbutt');
  equal(tharthareonActionModeForGesture('bite-start'), 'bite');
  equal(tharthareonActionModeForGesture('bite-release'), null);
});

function apply(
  state: TharthareonGestureState,
  event: TharthareonGestureEvent,
) {
  return reduceTharthareonGesture(state, event);
}

test('a first short tap stays pending until its double-tap window expires', () => {
  let result = apply(createTharthareonGestureState(), { type: 'press', atMs: 0 });
  equal(result.state.phase, 'first-press');
  equal(tharthareonGestureDeadlineMs(result.state), THARTHAREON_HOLD_THRESHOLD_MS);
  deepEqual(result.commands, []);

  result = apply(result.state, { type: 'release', atMs: 80 });
  equal(result.state.phase, 'pending-tap');
  equal(
    tharthareonGestureDeadlineMs(result.state),
    80 + THARTHAREON_DOUBLE_TAP_WINDOW_MS,
  );
  deepEqual(result.commands, []);

  result = apply(result.state, { type: 'tick', atMs: 339 });
  equal(result.state.phase, 'pending-tap');
  deepEqual(result.commands, []);

  result = apply(result.state, { type: 'tick', atMs: 340 });
  equal(result.state.phase, 'idle');
  deepEqual(result.commands, ['tap']);
});

test('two quick taps inside the window emit exactly one headbutt', () => {
  let state = createTharthareonGestureState();
  ({ state } = apply(state, { type: 'press', atMs: 0 }));
  ({ state } = apply(state, { type: 'release', atMs: 60 }));
  let result = apply(state, { type: 'press', atMs: 180 });
  equal(result.state.phase, 'second-press');
  deepEqual(result.commands, []);

  result = apply(result.state, { type: 'release', atMs: 220 });
  equal(result.state.phase, 'headbutt-active');
  deepEqual(result.commands, ['headbutt']);

  result = apply(result.state, { type: 'release', atMs: 225 });
  deepEqual(result.commands, []);
  result = apply(result.state, { type: 'press', atMs: 230 });
  deepEqual(result.commands, []);
  equal(result.state.phase, 'headbutt-active');
});

test('a late second press resolves the old tap and starts a fresh gesture', () => {
  let state = createTharthareonGestureState();
  ({ state } = apply(state, { type: 'press', atMs: 0 }));
  ({ state } = apply(state, { type: 'release', atMs: 40 }));
  const result = apply(state, { type: 'press', atMs: 301 });
  deepEqual(result.commands, ['tap']);
  equal(result.state.phase, 'first-press');
  equal(result.state.pressedAtMs, 301);
});

test('holding past the threshold starts bite and release ends it', () => {
  let state = createTharthareonGestureState();
  ({ state } = apply(state, { type: 'press', atMs: 10 }));
  let result = apply(state, {
    type: 'tick',
    atMs: 10 + THARTHAREON_HOLD_THRESHOLD_MS,
  });
  equal(result.state.phase, 'bite-active');
  deepEqual(result.commands, ['bite-start']);

  result = apply(result.state, { type: 'release', atMs: 500 });
  equal(result.state.phase, 'idle');
  deepEqual(result.commands, ['bite-release']);
});

test('a delayed release flushes bite-start and bite-release in order', () => {
  let state = createTharthareonGestureState();
  ({ state } = apply(state, { type: 'press', atMs: 100 }));
  const result = apply(state, { type: 'release', atMs: 400 });
  equal(result.state.phase, 'idle');
  deepEqual(result.commands, ['bite-start', 'bite-release']);
});

test('cancel clears uncommitted gestures and releases an active bite', () => {
  let state = createTharthareonGestureState();
  ({ state } = apply(state, { type: 'press', atMs: 0 }));
  let result = apply(state, { type: 'cancel', atMs: 50 });
  equal(result.state.phase, 'idle');
  deepEqual(result.commands, []);

  ({ state } = apply(result.state, { type: 'press', atMs: 100 }));
  ({ state } = apply(state, { type: 'tick', atMs: 300 }));
  result = apply(state, { type: 'cancel', atMs: 310 });
  equal(result.state.phase, 'idle');
  deepEqual(result.commands, ['bite-release']);
});

test('triple taps cannot restart or duplicate an active headbutt cycle', () => {
  let state = createTharthareonGestureState();
  ({ state } = apply(state, { type: 'press', atMs: 0 }));
  ({ state } = apply(state, { type: 'release', atMs: 30 }));
  ({ state } = apply(state, { type: 'press', atMs: 80 }));
  let result = apply(state, { type: 'release', atMs: 110 });
  deepEqual(result.commands, ['headbutt']);
  state = result.state;

  result = apply(state, { type: 'press', atMs: 150 });
  deepEqual(result.commands, []);
  result = apply(result.state, { type: 'release', atMs: 170 });
  deepEqual(result.commands, []);
  equal(result.state.phase, 'headbutt-active');

  result = apply(result.state, { type: 'headbutt-complete', atMs: 1_500 });
  equal(result.state.phase, 'idle');
  deepEqual(result.commands, []);
});

test('cancel cannot interrupt a headbutt that has already committed', () => {
  let state = createTharthareonGestureState();
  ({ state } = apply(state, { type: 'press', atMs: 0 }));
  ({ state } = apply(state, { type: 'release', atMs: 30 }));
  ({ state } = apply(state, { type: 'press', atMs: 80 }));
  ({ state } = apply(state, { type: 'release', atMs: 110 }));
  const result = apply(state, { type: 'cancel', atMs: 120 });
  equal(result.state.phase, 'headbutt-active');
  deepEqual(result.commands, []);
});
