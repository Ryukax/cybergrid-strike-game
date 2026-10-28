import test from 'node:test';
import { equal, ok } from 'node:assert/strict';
import {
  THARTHAREON_BITE_MAX_CELLS,
  THARTHAREON_BITE_CLAMP_HOLD_SECONDS,
  THARTHAREON_BITE_FINAL_HOLD_SECONDS,
  THARTHAREON_BITE_OPEN_HOLD_SECONDS,
  THARTHAREON_BITE_SPEED_CELLS_PER_SECOND,
  THARTHAREON_HEADBUTT_SEQUENCE_DURATION_SECONDS,
  THARTHAREON_TARGET_HOLD_MAX_SECONDS,
  advanceTharthareonBiteCarrier,
  advanceTharthareonBiteHold,
  advanceTharthareonTargetHold,
  tharthareonBiteSweptCollision,
} from './tharthareon-bite';

test('Tharthareon bite advances continuously and stops exactly three cells forward', () => {
  const origin = 1.55;
  let column = origin;
  let complete = false;
  const visitedCells = new Set<number>([Math.floor(column)]);
  for (let step = 0; step < 30 && !complete; step++) {
    const frame = advanceTharthareonBiteCarrier(
      column,
      origin,
      THARTHAREON_BITE_SPEED_CELLS_PER_SECOND,
      0.1,
    );
    equal(frame.previousColumn, column);
    ok(frame.column >= column);
    column = frame.column;
    complete = frame.complete;
    visitedCells.add(Math.floor(column));
  }
  equal(complete, true);
  equal(column, origin + THARTHAREON_BITE_MAX_CELLS);
  ok(visitedCells.has(2));
  ok(visitedCells.has(3));
  ok(visitedCells.has(4));
});

test('double-tap headbutt owns exactly one 1.33 second authored cycle', () => {
  equal(THARTHAREON_HEADBUTT_SEQUENCE_DURATION_SECONDS, 1.33);
});

test('Tharthareon bite supports a reverse carrier without exceeding its range', () => {
  const frame = advanceTharthareonBiteCarrier(4.55, 4.55, -20, 1);
  ok(Math.abs(frame.endpointColumn - 1.55) < 1e-9);
  ok(Math.abs(frame.column - 1.55) < 1e-9);
  equal(frame.complete, true);
});

test('swept collision detects a crossed target but nothing past the final extent', () => {
  equal(tharthareonBiteSweptCollision(1.55, 2.45, 2.1, 0.38), true);
  equal(tharthareonBiteSweptCollision(1.55, 2.45, 2.84, 0.38), false);
  equal(tharthareonBiteSweptCollision(4.55, 3.55, 3.8, 0.38), true);
  equal(tharthareonBiteSweptCollision(1.55, 4.55, 4.94, 0.38), false);
  equal(tharthareonBiteSweptCollision(Number.NaN, 2, 2, 0.38), false);
});

test('the final bite remains visible for a short simulation-owned hold', () => {
  equal(
    THARTHAREON_BITE_FINAL_HOLD_SECONDS,
    THARTHAREON_BITE_OPEN_HOLD_SECONDS + THARTHAREON_BITE_CLAMP_HOLD_SECONDS,
  );
  const afterFirstTick = advanceTharthareonBiteHold(
    THARTHAREON_BITE_FINAL_HOLD_SECONDS,
    0.1,
  );
  ok(Math.abs(afterFirstTick - 0.42) < 1e-9);
  ok(advanceTharthareonBiteHold(afterFirstTick, 0.18) > 0);
  equal(advanceTharthareonBiteHold(afterFirstTick, 0.43), 0);
  equal(advanceTharthareonBiteHold(0, 0.1), 0);
  equal(advanceTharthareonBiteHold(Number.NaN, -1), 0);
});

test('a live target remains clamped only while input is held and never beyond three seconds', () => {
  equal(THARTHAREON_TARGET_HOLD_MAX_SECONDS, 3);
  const first = advanceTharthareonTargetHold(0, 1, true, true);
  equal(first.active, true);
  equal(first.reason, 'held');
  equal(first.elapsedSeconds, 1);
  equal(first.remainingSeconds, 2);

  const almostDone = advanceTharthareonTargetHold(1, 1.99, true, true);
  equal(almostDone.active, true);
  ok(almostDone.remainingSeconds > 0);

  const timedOut = advanceTharthareonTargetHold(
    almostDone.elapsedSeconds,
    0.02,
    true,
    true,
  );
  equal(timedOut.active, false);
  equal(timedOut.reason, 'timeout');
  equal(timedOut.elapsedSeconds, 3);
  equal(timedOut.remainingSeconds, 0);
});

test('releasing input or losing the real target ends the held bite immediately', () => {
  const released = advanceTharthareonTargetHold(0.7, 0.1, false, true);
  equal(released.active, false);
  equal(released.reason, 'input-release');
  equal(released.elapsedSeconds, 0.7);
  equal(released.remainingSeconds, 0);

  const targetLost = advanceTharthareonTargetHold(0.7, 0.1, true, false);
  equal(targetLost.active, false);
  equal(targetLost.reason, 'target-lost');
  equal(targetLost.elapsedSeconds, 0.7);
  equal(targetLost.remainingSeconds, 0);
});

test('held-target timing sanitizes invalid clocks without altering the short miss clamp', () => {
  const sanitized = advanceTharthareonTargetHold(Number.NaN, -1, true, true);
  equal(sanitized.active, true);
  equal(sanitized.elapsedSeconds, 0);
  equal(sanitized.remainingSeconds, THARTHAREON_TARGET_HOLD_MAX_SECONDS);
  equal(
    THARTHAREON_BITE_FINAL_HOLD_SECONDS,
    THARTHAREON_BITE_OPEN_HOLD_SECONDS + THARTHAREON_BITE_CLAMP_HOLD_SECONDS,
  );
});
