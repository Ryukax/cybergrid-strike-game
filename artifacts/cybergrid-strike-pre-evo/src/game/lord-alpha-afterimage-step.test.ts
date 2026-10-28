import { deepStrictEqual, equal, strictEqual, throws } from "node:assert/strict";
import { test } from "node:test";

import {
  LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS,
  beginLordAlphaAfterimageStep,
  cancelLordAlphaAfterimageStep,
  completeLordAlphaAfterimageStep,
  isLordAlphaAfterimageStepEvasive,
  lordAlphaAfterimageStepProgress,
  queueLordAlphaAfterimageStepDestination,
} from "./lord-alpha-afterimage-step";

test("afterimage step begins anchored at its origin", () => {
  const state = beginLordAlphaAfterimageStep({ col: 1, row: 1 }, 100);

  deepStrictEqual(state.origin, { col: 1, row: 1 });
  equal(state.queuedDestination, null);
  equal(state.durationMs, 1_600);
  equal(state.durationMs, LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS);
  equal(state.phase, "active");
});

test("latest valid 3x3 destination replaces the previous intent", () => {
  const initial = beginLordAlphaAfterimageStep({ col: 1, row: 1 }, 0);
  const first = queueLordAlphaAfterimageStepDestination(initial, {
    col: 1,
    row: 0,
  });
  const latest = queueLordAlphaAfterimageStepDestination(first, {
    col: 2,
    row: 2,
  });
  const invalid = queueLordAlphaAfterimageStepDestination(latest, {
    col: 3,
    row: 2,
  });

  equal(initial.queuedDestination, null);
  deepStrictEqual(first.queuedDestination, { col: 1, row: 0 });
  deepStrictEqual(latest.queuedDestination, { col: 2, row: 2 });
  strictEqual(invalid, latest);
});

test("destination does not commit before the animation completes", () => {
  const startedAtMs = 1_000;
  const state = queueLordAlphaAfterimageStepDestination(
    beginLordAlphaAfterimageStep({ col: 1, row: 1 }, startedAtMs),
    { col: 0, row: 0 },
  );
  const early = completeLordAlphaAfterimageStep(
    state,
    startedAtMs + LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS - 1,
  );

  strictEqual(early.state, state);
  equal(early.destination, null);
  equal(early.didComplete, false);
  equal(early.didTeleport, false);
  equal(lordAlphaAfterimageStepProgress(state, startedAtMs), 0);
});

test("completion commits the queued destination exactly once", () => {
  const state = queueLordAlphaAfterimageStepDestination(
    beginLordAlphaAfterimageStep({ col: 1, row: 1 }, 20),
    { col: 2, row: 0 },
  );
  const completion = completeLordAlphaAfterimageStep(
    state,
    20 + LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS,
  );
  const repeated = completeLordAlphaAfterimageStep(
    completion.state,
    20 + LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS + 500,
  );

  deepStrictEqual(completion.destination, { col: 2, row: 0 });
  equal(completion.didComplete, true);
  equal(completion.didTeleport, true);
  equal(completion.state.phase, "completed");
  equal(completion.state.completedAtMs, 1_620);
  equal(repeated.destination, null);
  equal(repeated.didComplete, false);
  equal(repeated.didTeleport, false);
  strictEqual(repeated.state, completion.state);
});

test("a cycle without input resolves at the origin", () => {
  const state = beginLordAlphaAfterimageStep({ col: 0, row: 2 }, 0);
  const completion = completeLordAlphaAfterimageStep(
    state,
    LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS,
  );

  deepStrictEqual(completion.destination, { col: 0, row: 2 });
  equal(completion.didComplete, true);
  equal(completion.didTeleport, false);
});

test("cancellation clears the queued cycle", () => {
  const state = queueLordAlphaAfterimageStepDestination(
    beginLordAlphaAfterimageStep({ col: 1, row: 1 }, 0),
    { col: 2, row: 1 },
  );

  deepStrictEqual(state.queuedDestination, { col: 2, row: 1 });
  equal(cancelLordAlphaAfterimageStep(), null);
});

test("evasion exists only while the Afterimage Step animation is active", () => {
  const active = beginLordAlphaAfterimageStep({ col: 1, row: 1 }, 0);
  const completed = completeLordAlphaAfterimageStep(
    active,
    LORD_ALPHA_AFTERIMAGE_STEP_DURATION_MS,
  ).state;

  equal(isLordAlphaAfterimageStepEvasive(active), true);
  equal(isLordAlphaAfterimageStepEvasive(completed), false);
  equal(isLordAlphaAfterimageStepEvasive(null), false);
});

test("begin rejects invalid grid origins and durations", () => {
  throws(() => beginLordAlphaAfterimageStep({ col: -1, row: 1 }, 0));
  throws(() => beginLordAlphaAfterimageStep({ col: 1, row: 1 }, 0, 0));
});
