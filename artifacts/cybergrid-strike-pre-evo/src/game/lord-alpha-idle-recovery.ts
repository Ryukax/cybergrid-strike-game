export const LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS = 1;
export const LORD_ALPHA_IDLE_RECOVERY_HP_CAP = 5;
export const LORD_ALPHA_MOBILE_RECOVERY_HP_CAP = 10;
export const LORD_ALPHA_MOBILE_RECOVERY_STANDSTILL_SECONDS = 2;

export interface LordAlphaIdleRecoveryState {
  elapsedIdleSeconds: number;
  elapsedMobileRecoverySeconds: number;
  stationarySeconds: number;
  observedHp: number;
  mobileRecoveryActive: boolean;
  damageNegationArmed: boolean;
}

export interface LordAlphaIdleRecoveryResult {
  state: LordAlphaIdleRecoveryState;
  hp: number;
  recovered: number;
}

export interface LordAlphaDamageNegationResult {
  state: LordAlphaIdleRecoveryState;
  negated: boolean;
}

export const createLordAlphaIdleRecoveryState = (
  hp: number,
): LordAlphaIdleRecoveryState => ({
  elapsedIdleSeconds: 0,
  elapsedMobileRecoverySeconds: 0,
  stationarySeconds: 0,
  observedHp: hp,
  mobileRecoveryActive: false,
  damageNegationArmed: false,
});

/**
 * Starts or refreshes LASI's moving recovery stretch after a real tile change.
 * The damage-negation charge is intentionally boolean: later moves refresh the
 * one pending use instead of stacking a bank of invulnerable hits.
 */
export const registerLordAlphaTileMove = (
  state: LordAlphaIdleRecoveryState,
  input: {
    hp: number;
    enabled: boolean;
    movedToNewTile: boolean;
  },
): LordAlphaIdleRecoveryState => {
  const hp = Number.isFinite(input.hp) ? input.hp : state.observedHp;
  if (!input.enabled) return createLordAlphaIdleRecoveryState(hp);
  if (!input.movedToNewTile) return state;
  if (hp < LORD_ALPHA_IDLE_RECOVERY_HP_CAP) {
    return createLordAlphaIdleRecoveryState(hp);
  }

  return {
    ...state,
    elapsedIdleSeconds: 0,
    stationarySeconds: 0,
    observedHp: hp,
    mobileRecoveryActive: true,
    damageNegationArmed: true,
  };
};

/** Consume LASI's one pending moving-hit negation, if it is still eligible. */
export const consumeLordAlphaDamageNegation = (
  state: LordAlphaIdleRecoveryState,
  input: { hp: number; enabled: boolean },
): LordAlphaDamageNegationResult => {
  const hp = Number.isFinite(input.hp) ? input.hp : state.observedHp;
  const negated = input.enabled
    && hp >= LORD_ALPHA_IDLE_RECOVERY_HP_CAP
    && state.mobileRecoveryActive
    && state.damageNegationArmed;

  return {
    state: negated
      ? { ...state, observedHp: hp, damageNegationArmed: false }
      : state,
    negated,
  };
};

/**
 * Advances LASI's two-stage recovery without owning rendering or input state.
 * Idle recovery reaches five HP. A successful tile move at five HP or above
 * starts the moving stretch, which recovers once per second up to ten HP and
 * expires after two seconds without another tile transition.
 */
export const advanceLordAlphaIdleRecovery = (
  state: LordAlphaIdleRecoveryState,
  input: {
    deltaSeconds: number;
    hp: number;
    idle: boolean;
    enabled: boolean;
  },
): LordAlphaIdleRecoveryResult => {
  const hp = Number.isFinite(input.hp) ? input.hp : state.observedHp;
  if (!input.enabled) {
    return {
      state: createLordAlphaIdleRecoveryState(hp),
      hp,
      recovered: 0,
    };
  }

  const deltaSeconds = Number.isFinite(input.deltaSeconds)
    ? Math.max(0, input.deltaSeconds)
    : 0;
  const externalHpChange = hp !== state.observedHp;

  if (hp < LORD_ALPHA_IDLE_RECOVERY_HP_CAP && state.mobileRecoveryActive) {
    state = createLordAlphaIdleRecoveryState(hp);
  }

  if (state.mobileRecoveryActive) {
    const stationarySeconds = state.stationarySeconds + deltaSeconds;
    if (stationarySeconds >= LORD_ALPHA_MOBILE_RECOVERY_STANDSTILL_SECONDS) {
      return {
        state: {
          ...state,
          elapsedIdleSeconds: 0,
          elapsedMobileRecoverySeconds: 0,
          stationarySeconds: 0,
          observedHp: hp,
          mobileRecoveryActive: false,
          damageNegationArmed: false,
        },
        hp,
        recovered: 0,
      };
    }

    const accumulated = externalHpChange
      ? deltaSeconds
      : state.elapsedMobileRecoverySeconds + deltaSeconds;
    const availableTicks = Math.floor(
      (accumulated + Number.EPSILON) / LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS,
    );
    const recovered = Math.min(
      availableTicks,
      Math.max(0, LORD_ALPHA_MOBILE_RECOVERY_HP_CAP - hp),
    );
    const nextHp = hp + recovered;

    return {
      state: {
        ...state,
        elapsedIdleSeconds: 0,
        elapsedMobileRecoverySeconds: nextHp >= LORD_ALPHA_MOBILE_RECOVERY_HP_CAP
          ? 0
          : accumulated - recovered * LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS,
        stationarySeconds,
        observedHp: nextHp,
      },
      hp: nextHp,
      recovered,
    };
  }

  const interrupted = !input.idle
    || externalHpChange
    || hp >= LORD_ALPHA_IDLE_RECOVERY_HP_CAP;
  if (interrupted) {
    return {
      state: createLordAlphaIdleRecoveryState(hp),
      hp,
      recovered: 0,
    };
  }

  const accumulated = state.elapsedIdleSeconds + deltaSeconds;
  const availableTicks = Math.floor(
    (accumulated + Number.EPSILON) / LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS,
  );
  const recovered = Math.min(
    availableTicks,
    Math.max(0, LORD_ALPHA_IDLE_RECOVERY_HP_CAP - hp),
  );
  const nextHp = hp + recovered;

  return {
    state: {
      ...createLordAlphaIdleRecoveryState(nextHp),
      elapsedIdleSeconds: nextHp >= LORD_ALPHA_IDLE_RECOVERY_HP_CAP
        ? 0
        : accumulated - recovered * LORD_ALPHA_IDLE_RECOVERY_INTERVAL_SECONDS,
    },
    hp: nextHp,
    recovered,
  };
};
