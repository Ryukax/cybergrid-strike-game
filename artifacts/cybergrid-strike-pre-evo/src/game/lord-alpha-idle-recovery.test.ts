import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  LORD_ALPHA_IDLE_RECOVERY_HP_CAP,
  LORD_ALPHA_MOBILE_RECOVERY_HP_CAP,
  LORD_ALPHA_MOBILE_RECOVERY_STANDSTILL_SECONDS,
  advanceLordAlphaIdleRecovery,
  consumeLordAlphaDamageNegation,
  createLordAlphaIdleRecoveryState,
  registerLordAlphaTileMove,
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

test("a real tile move at five HP starts mobile recovery up to ten HP", () => {
  let state = registerLordAlphaTileMove(createLordAlphaIdleRecoveryState(5), {
    hp: 5,
    enabled: true,
    movedToNewTile: true,
  });
  equal(state.mobileRecoveryActive, true);
  equal(state.damageNegationArmed, true);

  let hp = 5;
  for (let index = 0; index < 6; index++) {
    const result = advanceLordAlphaIdleRecovery(state, {
      deltaSeconds: 1,
      hp,
      idle: false,
      enabled: true,
    });
    hp = result.hp;
    state = registerLordAlphaTileMove(result.state, {
      hp,
      enabled: true,
      movedToNewTile: true,
    });
  }

  equal(hp, LORD_ALPHA_MOBILE_RECOVERY_HP_CAP);
  equal(state.mobileRecoveryActive, true);
});

test("blocked, same-tile, and sub-five movement cannot start the mobile stretch", () => {
  const initial = createLordAlphaIdleRecoveryState(5);
  const sameTile = registerLordAlphaTileMove(initial, {
    hp: 5,
    enabled: true,
    movedToNewTile: false,
  });
  const injuredMove = registerLordAlphaTileMove(
    createLordAlphaIdleRecoveryState(4),
    { hp: 4, enabled: true, movedToNewTile: true },
  );

  deepStrictEqual(sameTile, initial);
  equal(injuredMove.mobileRecoveryActive, false);
  equal(injuredMove.damageNegationArmed, false);
});

test("each new tile refreshes one non-stacking damage negation", () => {
  let state = registerLordAlphaTileMove(createLordAlphaIdleRecoveryState(5), {
    hp: 5,
    enabled: true,
    movedToNewTile: true,
  });
  const firstHit = consumeLordAlphaDamageNegation(state, {
    hp: 5,
    enabled: true,
  });
  equal(firstHit.negated, true);
  equal(firstHit.state.damageNegationArmed, false);

  const secondHit = consumeLordAlphaDamageNegation(firstHit.state, {
    hp: 5,
    enabled: true,
  });
  equal(secondHit.negated, false);

  state = registerLordAlphaTileMove(secondHit.state, {
    hp: 5,
    enabled: true,
    movedToNewTile: true,
  });
  state = registerLordAlphaTileMove(state, {
    hp: 5,
    enabled: true,
    movedToNewTile: true,
  });
  equal(state.damageNegationArmed, true);
  equal(
    consumeLordAlphaDamageNegation(state, { hp: 5, enabled: true }).negated,
    true,
  );
});

test("two seconds without a new tile cancels mobile recovery and negation", () => {
  const active = registerLordAlphaTileMove(createLordAlphaIdleRecoveryState(5), {
    hp: 5,
    enabled: true,
    movedToNewTile: true,
  });
  const preserved = advanceLordAlphaIdleRecovery(active, {
    deltaSeconds: LORD_ALPHA_MOBILE_RECOVERY_STANDSTILL_SECONDS - 0.01,
    hp: 5,
    idle: true,
    enabled: true,
  });
  const cancelled = advanceLordAlphaIdleRecovery(preserved.state, {
    deltaSeconds: 0.01,
    hp: preserved.hp,
    idle: true,
    enabled: true,
  });

  equal(preserved.state.mobileRecoveryActive, true);
  equal(cancelled.state.mobileRecoveryActive, false);
  equal(cancelled.state.damageNegationArmed, false);
  equal(cancelled.recovered, 0);
});

test("falling below five HP cancels the mobile stretch and restores idle recovery", () => {
  const active = registerLordAlphaTileMove(createLordAlphaIdleRecoveryState(5), {
    hp: 5,
    enabled: true,
    movedToNewTile: true,
  });
  const damaged = advanceLordAlphaIdleRecovery(active, {
    deltaSeconds: 0.25,
    hp: 4,
    idle: true,
    enabled: true,
  });
  const recovered = advanceLordAlphaIdleRecovery(damaged.state, {
    deltaSeconds: 1,
    hp: 4,
    idle: true,
    enabled: true,
  });

  equal(damaged.state.mobileRecoveryActive, false);
  equal(damaged.state.damageNegationArmed, false);
  equal(recovered.hp, LORD_ALPHA_IDLE_RECOVERY_HP_CAP);
});
