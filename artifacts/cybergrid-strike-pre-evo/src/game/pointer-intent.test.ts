import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginPointerIntent,
  cancelPointerIntent,
  commitPointerIntent,
  POINTER_INTENT_MOUSE_HOLD_DELAY_MS,
  POINTER_INTENT_TRAVEL_LIMIT_PX,
  shouldBeginPointerHold,
  shouldCommitPointerOnRelease,
  updatePointerIntent,
  type PointerIntentSample,
} from './pointer-intent.ts';

function sample(
  overrides: Partial<PointerIntentSample> = {},
): PointerIntentSample {
  return {
    pointerId: 7,
    pointerType: 'mouse',
    clientX: 100,
    clientY: 80,
    atMs: 1_000,
    ...overrides,
  };
}

test('mouse-shaped contact arms without committing until a stationary release', () => {
  const intent = beginPointerIntent(sample());
  assert.equal(intent.immediateContact, false);
  assert.equal(shouldCommitPointerOnRelease(intent, sample({ atMs: 1_040 })), true);
});

test('touch and pen preserve immediate contact without a duplicate release', () => {
  for (const pointerType of ['touch', 'pen']) {
    const intent = beginPointerIntent(sample({ pointerType }));
    assert.equal(intent.immediateContact, true);
    assert.equal(shouldCommitPointerOnRelease(intent, sample({ pointerType, atMs: 1_040 })), false);
  }
});

test('travel at the threshold remains a tap and travel beyond it cancels', () => {
  const intent = beginPointerIntent(sample());
  const atThreshold = updatePointerIntent(intent, sample({ clientX: 106, clientY: 88 }));
  assert.equal(atThreshold.maxTravelPx, POINTER_INTENT_TRAVEL_LIMIT_PX);
  assert.equal(shouldCommitPointerOnRelease(atThreshold, sample({ clientX: 106, clientY: 88 })), true);

  const dragged = updatePointerIntent(intent, sample({ clientX: 111 }));
  assert.equal(dragged.cancelled, true);
  assert.equal(shouldCommitPointerOnRelease(dragged, sample()), false);
});

test('returning to the origin cannot restore an intent cancelled by a drag', () => {
  const intent = beginPointerIntent(sample());
  const dragged = updatePointerIntent(intent, sample({ clientY: 94 }));
  const returned = updatePointerIntent(dragged, sample({ atMs: 1_050 }));
  assert.equal(returned.cancelled, true);
  assert.equal(shouldCommitPointerOnRelease(returned, sample({ atMs: 1_060 })), false);
});

test('cancel, lost-capture cleanup, committed input, and foreign pointers cannot release', () => {
  const intent = beginPointerIntent(sample());
  assert.equal(shouldCommitPointerOnRelease(cancelPointerIntent(intent), sample()), false);
  assert.equal(shouldCommitPointerOnRelease(commitPointerIntent(intent), sample()), false);
  assert.equal(shouldCommitPointerOnRelease(intent, sample({ pointerId: 8 })), false);
});

test('mouse holds require a stationary delay and suppress the later tap', () => {
  const intent = beginPointerIntent(sample());
  assert.equal(shouldBeginPointerHold(intent, 1_000), false);
  assert.equal(
    shouldBeginPointerHold(intent, 1_000 + POINTER_INTENT_MOUSE_HOLD_DELAY_MS - 1),
    false,
  );
  assert.equal(
    shouldBeginPointerHold(intent, 1_000 + POINTER_INTENT_MOUSE_HOLD_DELAY_MS),
    true,
  );

  const committed = commitPointerIntent(intent);
  assert.equal(shouldBeginPointerHold(committed, 2_000), false);
  assert.equal(shouldCommitPointerOnRelease(committed, sample({ atMs: 2_000 })), false);
});

test('dragged or immediate touch contact cannot begin the synthetic-mouse hold path', () => {
  const dragged = updatePointerIntent(
    beginPointerIntent(sample()),
    sample({ clientX: 100 + POINTER_INTENT_TRAVEL_LIMIT_PX + 1 }),
  );
  assert.equal(shouldBeginPointerHold(dragged, 2_000), false);

  const touch = beginPointerIntent(sample({ pointerType: 'touch' }));
  assert.equal(shouldBeginPointerHold(touch, 2_000), false);
});
