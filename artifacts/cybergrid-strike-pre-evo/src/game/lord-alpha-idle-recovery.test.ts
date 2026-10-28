import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  LORD_ALPHA_IDLE_RECOVERY_HP_CAP,
  advanceLordAlphaIdleRecovery,
  createLordAlphaIdleRecoveryState,
} from "./lord-alpha-idle-recovery";

test("LASI recovers one HP after each uninterrupted idle second", () => {
  let state = createLordAlphaIdleRecoveryState(2);
  let result = advanceLordAlphaIdleRecovery(state, {
    deltaSeconds: 0.99,
    hp: 2,
    idle: true,
    enabled: true,
  });
  equal(result.hp, 2);
  equal(result.recovered, 0);

  state = result.state;
  result = advanceLordAlphaIdleRecovery(state, {
    deltaSeconds: 0.01,
    hp: 2,
    idle: true,
    enabled: true,
  });
  equal(result.hp, 3);
  equal(result.recovered, 1);

  result = advanceLordAlphaIdleRecovery(result.state, {
    deltaSeconds: 2,
    hp: 3,
    idle: true,
    enabled: true,
  });
  equal(result.hp, LORD_ALPHA_IDLE_RECOVERY_HP_CAP);
  equal(result.recovered, 2);
  equal(result.state.elapsedIdleSeconds, 0);
});

test("activity resets a partial idle interval", () => {
  const partial = advanceLordAlphaIdleRecovery(
    createLordAlphaIdleRecoveryState(3),
    { deltaSeconds: 0.8, hp: 3, idle: true, enabled: true },
  );
  const interrupted = advanceLordAlphaIdleRecovery(partial.state, {
    deltaSeconds: 0.3,
    hp: 3,
    idle: false,
    enabled: true,
  });
  const resumed = advanceLordAlphaIdleRecovery(interrupted.state, {
    deltaSeconds: 0.7,
    hp: 3,
    idle: true,
    enabled: true,
  });

  equal(interrupted.hp, 3);
  equal(interrupted.state.elapsedIdleSeconds, 0);
  equal(resumed.hp, 3);
});

test("damage resets idle recovery and non-LASI actors cannot recover", () => {
  const partial = advanceLordAlphaIdleRecovery(
    createLordAlphaIdleRecoveryState(4),
    { deltaSeconds: 0.75, hp: 4, idle: true, enabled: true },
  );
  const damaged = advanceLordAlphaIdleRecovery(partial.state, {
    deltaSeconds: 0.3,
    hp: 3,
    idle: true,
    enabled: true,
  });
  const disabled = advanceLordAlphaIdleRecovery(damaged.state, {
    deltaSeconds: 4,
    hp: 3,
    idle: true,
    enabled: false,
  });

  equal(damaged.hp, 3);
  equal(damaged.state.elapsedIdleSeconds, 0);
  deepStrictEqual(disabled, {
    state: createLordAlphaIdleRecoveryState(3),
    hp: 3,
    recovered: 0,
  });
});

test("recovery never lowers or raises HP beyond the five-point cap", () => {
  const capped = advanceLordAlphaIdleRecovery(
    createLordAlphaIdleRecoveryState(5),
    { deltaSeconds: 10, hp: 5, idle: true, enabled: true },
  );
  const aboveCap = advanceLordAlphaIdleRecovery(
    createLordAlphaIdleRecoveryState(7),
    { deltaSeconds: 10, hp: 7, idle: true, enabled: true },
  );

  equal(capped.hp, 5);
  equal(capped.recovered, 0);
  equal(aboveCap.hp, 7);
  equal(aboveCap.recovered, 0);
});
